/* eslint-disable @typescript-eslint/no-explicit-any */
import { pgEnum } from "drizzle-orm/pg-core";
import {
  pgSchema,
  uuid,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  jsonb,
  serial,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Constituents, Organizations } from "./core";
import { FinancialTransactions } from "./finance";
import { Projects } from "./activities";
import { Users } from "./app";

const shop = pgSchema("shop");

// === ENUMS ===
export const ProductType = pgEnum("product_type", [
  "PHYSICAL", 
  "DIGITAL", 
  "SERVICE"
]);

export const OrderStatus = pgEnum("order_status", [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export const FulfillmentStatus = pgEnum("fulfillment_status", [
  "UNFULFILLED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
]);

// === TABLES ===

// Product Categories (hierarchical)
export const Categories = shop.table("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  parentId: uuid("parent_id").references((): any => Categories.id, {
    onDelete: "set null",
  }),
  displayOrder: integer("display_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// Main Products table
export const Products = shop.table("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  productType: ProductType("product_type").default("PHYSICAL").notNull(),
  
  // Optional: Track if product is from partner organization
  supplierId: uuid("supplier_id").references(() => Organizations.id, {
    onDelete: "set null",
  }),
  
  // For cause-related marketing: "% of proceeds go to X project"
  linkedProjectId: uuid("linked_project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  proceedsPercentage: integer("proceeds_percentage"), // 0-100
  
  // SEO & Marketing
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  
  // Flags
  isActive: boolean("is_active").default(true).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isDonationItem: boolean("is_donation_item").default(false).notNull(), // Pay-what-you-want
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index().on(table.isActive, table.isFeatured),
]);

// Product-Category junction
export const ProductCategories = shop.table("product_categories", {
  id: serial("id").primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => Products.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => Categories.id, { onDelete: "cascade" }),
}, (table) => [
  unique().on(table.productId, table.categoryId),
]);

// Product Variants (SKU level - size, color, etc.)
export const ProductVariants = shop.table("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => Products.id, { onDelete: "cascade" }),
  
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(), // e.g., "Large / Red"
  
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }), // Original price for showing discounts
  cost: decimal("cost", { precision: 10, scale: 2 }), // Your cost (for profit tracking)
  
  // Physical attributes
  attributes: jsonb("attributes"), // { "size": "L", "color": "Red", "material": "Cotton" }
  
  // Inventory
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  lowStockThreshold: integer("low_stock_threshold").default(5),
  allowBackorder: boolean("allow_backorder").default(false).notNull(),
  
  // Physical shipping info
  weight: decimal("weight", { precision: 8, scale: 2 }), // in kg
  weightUnit: text("weight_unit").default("kg"),
  requiresShipping: boolean("requires_shipping").default(true).notNull(),
  
  // Digital product info
  digitalFileUrl: text("digital_file_url"), // For digital products
  downloadLimit: integer("download_limit"), // How many times can be downloaded
  
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index().on(table.productId),
  index().on(table.isActive),
]);

// Product Images
export const ProductImages = shop.table("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => Products.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => ProductVariants.id, {
    onDelete: "cascade",
  }), // null = applies to all variants
  
  url: text("url").notNull(),
  altText: text("alt_text"),
  displayOrder: integer("display_order").default(0).notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
}, (table) => [
  index().on(table.productId, table.displayOrder),
]);

// Discount Codes
export const DiscountCodes = shop.table("discount_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  
  // Discount configuration
  discountType: text("discount_type").notNull(), // 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  
  // Constraints
  minimumPurchaseAmount: decimal("minimum_purchase_amount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"), // null = unlimited
  usageCount: integer("usage_count").default(0).notNull(),
  perCustomerLimit: integer("per_customer_limit").default(1),
  
  // Specific applicability
  applicableProductIds: uuid("applicable_product_ids").array(), // null = all products
  applicableCategoryIds: uuid("applicable_category_ids").array(),
  
  // Member-only discounts
  membershipTypeRequired: text("membership_type_required"), // e.g., 'MEMBER' - links to MembershipTiers.category
  
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
  index().on(table.code),
  index().on(table.isActive),
]);

// Shopping Cart
export const Carts = shop.table("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => Users.id, { onDelete: "cascade" }),
  sessionId: text("session_id"), // For anonymous users
  
  discountCodeId: uuid("discount_code_id").references(() => DiscountCodes.id, {
    onDelete: "set null",
  }),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }), // Auto-cleanup old carts
}, (table) => [
  index().on(table.userId),
  index().on(table.sessionId),
]);

export const CartItems = shop.table("cart_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  cartId: uuid("cart_id")
    .notNull()
    .references(() => Carts.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => ProductVariants.id, { onDelete: "cascade" }),
  
  quantity: integer("quantity").notNull(),
  priceAtAdd: decimal("price_at_add", { precision: 10, scale: 2 }).notNull(), // Snapshot price
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique().on(table.cartId, table.variantId),
]);

// Orders
export const Orders = shop.table("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // Human-readable: ORD-2024-001
  
  // Customer info
  customerId: uuid("customer_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "restrict" }),
  
  // Linked to finance
  transactionId: uuid("transaction_id")
    .notNull()
    .unique()
    .references(() => FinancialTransactions.id, { onDelete: "restrict" }),
  
  // Pricing breakdown
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0").notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  
  // Discount applied
  discountCodeId: uuid("discount_code_id").references(() => DiscountCodes.id, {
    onDelete: "set null",
  }),
  
  // Status
  orderStatus: OrderStatus("order_status").default("PENDING").notNull(),
  fulfillmentStatus: FulfillmentStatus("fulfillment_status").default("UNFULFILLED").notNull(),
  
  // Shipping Address (snapshot - don't reference constituent address)
  shippingAddress: jsonb("shipping_address").notNull(), 
  // { name, line1, line2, city, state, postal, country, phone }
  
  billingAddress: jsonb("billing_address"), // Can be same as shipping
  
  // Shipping info
  shippingMethod: text("shipping_method"),
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  
  // Notes
  customerNotes: text("customer_notes"),
  internalNotes: text("internal_notes"), // Staff notes
  
  // Metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index().on(table.customerId),
  index().on(table.orderStatus),
  index().on(table.createdAt),
]);

// Order Items (snapshot of what was purchased)
export const OrderItems = shop.table("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => Orders.id, { onDelete: "restrict" }),
  
  // Product snapshot (in case product/variant deleted later)
  variantId: uuid("variant_id").references(() => ProductVariants.id, {
    onDelete: "set null",
  }),
  productName: text("product_name").notNull(),
  variantName: text("variant_name").notNull(),
  sku: text("sku").notNull(),
  
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  
  // If this was linked to a cause
  linkedProjectId: uuid("linked_project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  proceedsAmount: decimal("proceeds_amount", { precision: 10, scale: 2 }), // Amount going to cause
  
  // Digital product delivery
  downloadUrl: text("download_url"),
  downloadCount: integer("download_count").default(0),
  downloadExpiresAt: timestamp("download_expires_at", { withTimezone: true }),
  
  // Fulfillment
  isFulfilled: boolean("is_fulfilled").default(false).notNull(),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  fulfilledBy: uuid("fulfilled_by").references(() => Constituents.id, {
    onDelete: "set null",
  }),
}, (table) => [
  index().on(table.orderId),
  index().on(table.variantId),
]);

// Inventory Adjustments (for tracking stock changes)
export const InventoryAdjustments = shop.table("inventory_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  variantId: uuid("variant_id")
    .notNull()
    .references(() => ProductVariants.id, { onDelete: "cascade" }),
  
  quantityChange: integer("quantity_change").notNull(), // +/- value
  newQuantity: integer("new_quantity").notNull(),
  reason: text("reason").notNull(), // 'SALE', 'RESTOCK', 'DAMAGED', 'CORRECTION', 'RETURN'
  
  // Reference to order if this was due to a sale
  orderItemId: uuid("order_item_id").references(() => OrderItems.id, {
    onDelete: "set null",
  }),
  
  adjustedBy: uuid("adjusted_by").references(() => Constituents.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index().on(table.variantId, table.createdAt),
]);

// Reviews (optional but valuable)
export const ProductReviews = shop.table("product_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => Products.id, { onDelete: "cascade" }),
  
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  
  // Must have purchased to review
  orderId: uuid("order_id").references(() => Orders.id, {
    onDelete: "set null",
  }),
  
  rating: integer("rating").notNull(), // 1-5
  title: text("title"),
  content: text("content"),
  
  isVerifiedPurchase: boolean("is_verified_purchase").default(false).notNull(),
  isApproved: boolean("is_approved").default(false).notNull(), // Moderation
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index().on(table.productId, table.isApproved),
  unique().on(table.reviewerId, table.orderId, table.productId), // One review per product per order
]);

// === RELATIONS ===

export const categoriesRelations = relations(Categories, ({ one, many }) => ({
  parent: one(Categories, {
    fields: [Categories.parentId],
    references: [Categories.id],
    relationName: "categoryHierarchy",
  }),
  children: many(Categories, { relationName: "categoryHierarchy" }),
  productCategories: many(ProductCategories),
}));

export const productsRelations = relations(Products, ({ one, many }) => ({
  supplier: one(Organizations, {
    fields: [Products.supplierId],
    references: [Organizations.id],
  }),
  linkedProject: one(Projects, {
    fields: [Products.linkedProjectId],
    references: [Projects.id],
  }),
  variants: many(ProductVariants),
  images: many(ProductImages),
  categories: many(ProductCategories),
  reviews: many(ProductReviews),
}));

export const productVariantsRelations = relations(ProductVariants, ({ one, many }) => ({
  product: one(Products, {
    fields: [ProductVariants.productId],
    references: [Products.id],
  }),
  images: many(ProductImages),
  cartItems: many(CartItems),
  orderItems: many(OrderItems),
  inventoryAdjustments: many(InventoryAdjustments),
}));

export const ordersRelations = relations(Orders, ({ one, many }) => ({
  customer: one(Constituents, {
    fields: [Orders.customerId],
    references: [Constituents.id],
  }),
  transaction: one(FinancialTransactions, {
    fields: [Orders.transactionId],
    references: [FinancialTransactions.id],
  }),
  discountCode: one(DiscountCodes, {
    fields: [Orders.discountCodeId],
    references: [DiscountCodes.id],
  }),
  items: many(OrderItems),
}));

export const orderItemsRelations = relations(OrderItems, ({ one }) => ({
  order: one(Orders, {
    fields: [OrderItems.orderId],
    references: [Orders.id],
  }),
  variant: one(ProductVariants, {
    fields: [OrderItems.variantId],
    references: [ProductVariants.id],
  }),
  linkedProject: one(Projects, {
    fields: [OrderItems.linkedProjectId],
    references: [Projects.id],
  }),
  fulfilledByConstituent: one(Constituents, {
    fields: [OrderItems.fulfilledBy],
    references: [Constituents.id],
  }),
}));

export const cartsRelations = relations(Carts, ({ one, many }) => ({
  user: one(Users, {
    fields: [Carts.userId],
    references: [Users.id],
  }),
  items: many(CartItems),
  discountCode: one(DiscountCodes, {
    fields: [Carts.discountCodeId],
    references: [DiscountCodes.id],
  }),
}));

export const cartItemsRelations = relations(CartItems, ({ one }) => ({
  cart: one(Carts, {
    fields: [CartItems.cartId],
    references: [Carts.id],
  }),
  variant: one(ProductVariants, {
    fields: [CartItems.variantId],
    references: [ProductVariants.id],
  }),
}));

export const productReviewsRelations = relations(ProductReviews, ({ one }) => ({
  product: one(Products, {
    fields: [ProductReviews.productId],
    references: [Products.id],
  }),
  reviewer: one(Constituents, {
    fields: [ProductReviews.reviewerId],
    references: [Constituents.id],
  }),
  order: one(Orders, {
    fields: [ProductReviews.orderId],
    references: [Orders.id],
  }),
}));