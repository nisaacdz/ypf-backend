import {
  pgSchema,
  uuid,
  varchar,
  text,
  timestamp,
  serial,
  jsonb,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Constituents } from "./core";
import { AnnouncementBroadCasts } from "./communications";
import { NotificationType } from "./enums";

export const app = pgSchema("app");

export const Users = app.table("users", {
  id: uuid().defaultRandom().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: text(),
  username: text().unique(), // Initially set to Constituent.email
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
  constituentId: uuid("constituent_id")
    .unique()
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
});

export const Otps = app.table("otps", {
  id: serial().primaryKey(),
  email: varchar({ length: 255 }).notNull(),
  code: text().notNull(),
  payload: jsonb(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const Notifications = app.table(
  "notifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => Users.id, { onDelete: "cascade" }),
    type: NotificationType().notNull(),
    title: text(),
    message: text(),
    broadcastId: serial("broadcast_id").references(
      () => AnnouncementBroadCasts.id,
      { onDelete: "cascade" }
    ),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index().on(table.broadcastId),
    unique().on(table.userId, table.broadcastId),
  ]
);

// === RELATIONS ===

export const usersRelations = relations(Users, ({ one }) => ({
  constituent: one(Constituents, {
    fields: [Users.constituentId],
    references: [Constituents.id],
  }),
}));
