import {
  pgSchema,
  uuid,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Users } from "./app";

export const shop = pgSchema("shop");

// === ENUMS ===

export const orderStatus = shop.enum("shop_order_status", [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
]);

// === TABLES ===

/**
 * 1. Customers Table
 * Stores customer info, separate from your main users and constituents.
 * This allows for guest checkouts while also supporting logged-in user purchases.
 */
export const Customers = shop.table("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => Users.id, { onDelete: "set null" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * 2. Products Table
 * A simple list of items you sell. Each unique variation (e.g., size/color)
 * is a separate product record for simplicity.
 */
export const Products = shop.table("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(), // e.g., "YPF Supporter T-Shirt - Red, M"
  sku: text("sku").notNull().unique(), // e.g., "YPF-TSH-RED-M"
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").default(0).notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * 3. Orders Table
 * Records every purchase. It's linked to a customer and contains a snapshot
 * of their shipping address to preserve order history accurately.
 */
export const Orders = shop.table("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => Customers.id, { onDelete: "restrict" }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: orderStatus("status").default("PENDING").notNull(),
  deliveryAddress: jsonb("delivery_address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * 4. Order Items Table
 * The line items for each order. It connects an order to the specific products
 * that were purchased and captures their price at the time of the transaction.
 */
export const OrderItems = shop.table("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => Orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => Products.id, { onDelete: "restrict" }), // Restrict deletion of a product if it has been ordered
  quantity: integer("quantity").notNull(),
  priceAtPurchase: decimal("price_at_purchase", {
    precision: 10,
    scale: 2,
  }).notNull(),
});

// === RELATIONS ===
// Define how tables are connected for easier querying with the Drizzle ORM.

export const customersRelations = relations(Customers, ({ one, many }) => ({
  // A customer can have many orders.
  orders: many(Orders),
  // A customer might be linked to one user account.
  user: one(Users, {
    fields: [Customers.userId],
    references: [Users.id],
  }),
}));

export const ordersRelations = relations(Orders, ({ one, many }) => ({
  // An order belongs to one customer.
  customer: one(Customers, {
    fields: [Orders.customerId],
    references: [Customers.id],
  }),
  // An order is made up of many items.
  items: many(OrderItems),
}));

export const productsRelations = relations(Products, ({ many }) => ({
  // A product can appear in many different order items.
  orderItems: many(OrderItems),
}));

export const orderItemsRelations = relations(OrderItems, ({ one }) => ({
  // Each order item is part of one order.
  order: one(Orders, {
    fields: [OrderItems.orderId],
    references: [Orders.id],
  }),
  // Each order item refers to one product.
  product: one(Products, {
    fields: [OrderItems.productId],
    references: [Products.id],
  }),
}));
