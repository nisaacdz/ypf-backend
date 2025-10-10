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
import { Constituents } from "./core";

export const shop = pgSchema("shop");

export const orderStatus = shop.enum("shop_order_status", [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
]);

export const Products = shop.table("products", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(), // e.g., "YPF Supporter T-Shirt - Red, M"
  sku: text().notNull().unique(), // e.g., "YPF-TSH-RED-M"
  description: text(),
  price: decimal({ precision: 10, scale: 2 }).notNull(),
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

export const ProductPhotos = shop.table("product_photos", {
  id: uuid().defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => Products.id, { onDelete: "cascade" }),
  photoUrl: text("photo_url").notNull(), // deliberate, not mediumId
  caption: text(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const Orders = shop.table("orders", {
  id: uuid().defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "restrict" }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: orderStatus().default("PENDING").notNull(),
  deliveryAddress: jsonb("delivery_address"), // self pickup
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const OrderItems = shop.table("order_items", {
  id: uuid().defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => Orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => Products.id, { onDelete: "restrict" }),
  quantity: integer().notNull(),
  priceAtPurchase: decimal("price_at_purchase", {
    precision: 10,
    scale: 2,
  }).notNull(),
});

// === RELATIONS ===

export const ordersRelations = relations(Orders, ({ one, many }) => ({
  customer: one(Constituents, {
    fields: [Orders.customerId],
    references: [Constituents.id],
  }),
  items: many(OrderItems),
}));

export const productsRelations = relations(Products, ({ many }) => ({
  orderItems: many(OrderItems),
}));

export const productPhotosRelations = relations(ProductPhotos, ({ one }) => ({
  product: one(Products, {
    fields: [ProductPhotos.productId],
    references: [Products.id],
  }),
}));

export const orderItemsRelations = relations(OrderItems, ({ one }) => ({
  order: one(Orders, {
    fields: [OrderItems.orderId],
    references: [Orders.id],
  }),
  product: one(Products, {
    fields: [OrderItems.productId],
    references: [Products.id],
  }),
}));
