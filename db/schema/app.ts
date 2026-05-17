import {
  pgSchema,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  unique,
  integer,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Constituents, citext } from "./core";

// Postgres "inet" type for storing IPv4/IPv6 source addresses on contact submissions.
const inet = customType<{ data: string }>({
  dataType() {
    return "inet";
  },
});

export const app = pgSchema("app");

export const Users = app.table("users", {
  id: uuid().defaultRandom().primaryKey(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: text(),
  username: text().unique(),
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
  id: uuid().defaultRandom().primaryKey(),
  email: varchar({ length: 255 }).notNull(),
  code: text().notNull(),
  payload: jsonb(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const AppNotifications = app.table("notifications", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => Users.id, { onDelete: "cascade" }),
  title: text(),
  message: text(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const UserPreferences = app.table("user_preferences", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => Users.id, { onDelete: "cascade" }),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  sensitiveChangeAlerts: boolean("sensitive_change_alerts")
    .default(true)
    .notNull(),
  notifyAnnouncements: boolean("notify_announcements").default(true).notNull(),
  notifyEvents: boolean("notify_events").default(true).notNull(),
  notifyDues: boolean("notify_dues").default(true).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Public-site contact form submissions. Persisted so messages aren't lost even
// if the admin notification email fails. UMS exposes the inbox.
export const ContactSubmissions = app.table(
  "contact_submissions",
  {
    id: uuid().defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: citext("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("NEW"), // NEW | READ | REPLIED | SPAM
    sourceIp: inet("source_ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedBy: uuid("reviewed_by").references(() => Constituents.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("contact_submissions_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

// === RELATIONS ===

export const usersRelations = relations(Users, ({ one }) => ({
  constituent: one(Constituents, {
    fields: [Users.constituentId],
    references: [Constituents.id],
  }),
  preferences: one(UserPreferences, {
    fields: [Users.id],
    references: [UserPreferences.userId],
  }),
}));

export const userPreferencesRelations = relations(
  UserPreferences,
  ({ one }) => ({
    user: one(Users, {
      fields: [UserPreferences.userId],
      references: [Users.id],
    }),
  }),
);
