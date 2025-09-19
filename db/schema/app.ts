import {
  pgSchema,
  uuid,
  varchar,
  text,
  timestamp,
  serial,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { InferSelectModel, relations } from "drizzle-orm";
import { Constituents } from "./core";
import { Announcements } from "./communications";

const app = pgSchema("app");

export const Users = app.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password"),
  username: text("username").unique(), // Initially set to Constituent.email
  avatarUrl: text("avatar_url"),
  googleId: text("google_id").unique(),
  appleId: text("apple_id").unique(),
  facebookId: text("facebook_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = Omit<InferSelectModel<typeof Users>, "password">;

export const Otps = app.table("otps", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  code: text("code").notNull(),
  payload: jsonb("payload"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
});

export const Notifications = app.table("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => Users.id, { onDelete: "cascade" }),
  title: text("title"),
  message: text("message"),
  announcementId: uuid("announcement_id").references(() => Announcements.id, {
    onDelete: "set null",
  }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// === RELATIONS ===

export const usersRelations = relations(Users, ({ one }) => ({
  constituent: one(Constituents, {
    fields: [Users.id],
    references: [Constituents.userId],
  }),
}));

export const notificationsRelations = relations(Notifications, ({ one }) => ({
  user: one(Users, {
    fields: [Notifications.userId],
    references: [Users.id],
  }),
  announcement: one(Announcements, {
    fields: [Notifications.announcementId],
    references: [Announcements.id],
  }),
}));
