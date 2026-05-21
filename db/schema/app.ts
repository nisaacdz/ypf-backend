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
import { Committees, Constituents, citext } from "./core";

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

// Key/value store for runtime-mutable platform settings — maintenance mode,
// feature flags, vendor toggles. Read-mostly; super admin writes via /system.
// Value is JSONB so each key can carry its own shape (boolean, struct, etc).
export const SystemSettings = app.table("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => Constituents.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Per-committee maintenance notices. Presence of a row = maintenance ON for
// that committee. To disable, DELETE the row. Notice-only — does NOT block
// writes (we surface the message to members on login). Global maintenance
// continues to live in app.system_settings as a separate, independent flag.
export const CommitteeMaintenance = app.table("committee_maintenance", {
  committeeId: uuid("committee_id")
    .primaryKey()
    .references(() => Committees.id, { onDelete: "cascade" }),
  message: text("message"),
  since: timestamp("since", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => Constituents.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Audit trail for sensitive admin actions (system settings changes, job
// retry/cancel, integration probe runs, etc). Append-only; never updated.
export const AuditLogs = app.table(
  "audit_logs",
  {
    id: uuid().defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => Constituents.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    target: text("target"),
    metadata: jsonb("metadata"),
    sourceIp: inet("source_ip"),
    userAgent: text("user_agent"),
    statusCode: integer("status_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_logs_actor_created_idx").on(table.actorId, table.createdAt),
    index("audit_logs_action_created_idx").on(table.action, table.createdAt),
  ],
);

// SMS delivery log. One row per send attempt (one row per recipient when
// fanning out a bulk send). Used by the /sms admin page for analytics,
// usage history, and credit reconciliation against the Arkesel dashboard.
//
// `event` tags the originating flow (dues_reminder, manual_broadcast, etc.)
// so analytics can break usage down by purpose. `batchId` links every row
// from the same admin-triggered send so the UI can show "batch of 73 sent
// to chapter X" without joining on free-text.
export const SmsMessages = app.table(
  "sms_messages",
  {
    id: uuid().defaultRandom().primaryKey(),
    batchId: uuid("batch_id").notNull(),
    event: text("event").notNull(),
    recipient: text("recipient").notNull(),
    constituentId: uuid("constituent_id").references(() => Constituents.id, {
      onDelete: "set null",
    }),
    message: text("message").notNull(),
    messageLength: integer("message_length").notNull(),
    segmentCount: integer("segment_count").notNull(),
    status: text("status").notNull(), // QUEUED | SENT | FAILED | SKIPPED
    provider: text("provider").notNull().default("arkesel"),
    providerResponse: jsonb("provider_response"),
    triggeredBy: uuid("triggered_by").references(() => Constituents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sms_messages_created_idx").on(table.createdAt),
    index("sms_messages_event_created_idx").on(table.event, table.createdAt),
    index("sms_messages_status_created_idx").on(table.status, table.createdAt),
    index("sms_messages_batch_idx").on(table.batchId),
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
