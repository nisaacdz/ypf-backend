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
} from "drizzle-orm/pg-core";
import { InferSelectModel, relations } from "drizzle-orm";
import { Constituents } from "./core";
import { AnnouncementBroadCasts } from "./communications";

export const app = pgSchema("app");

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
  constituentId: uuid("constituent_id")
    .unique()
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
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

// We m Ensure that message and broadcastId are not simultaneously null
export const Notifications = app.table(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => Users.id, { onDelete: "cascade" }),
    title: text("title"),
    message: text("message"),
    broadcastId: serial("broadcast_id").references(
      () => AnnouncementBroadCasts.id,
      { onDelete: "cascade" },
    ),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index().on(table.broadcastId)],
);

// === RELATIONS ===

export const usersRelations = relations(Users, ({ one }) => ({
  constituent: one(Constituents, {
    fields: [Users.constituentId],
    references: [Constituents.id],
  }),
}));
