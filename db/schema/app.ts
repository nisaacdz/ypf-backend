import { pgTable, uuid, text, timestamp, serial, varchar, jsonb, boolean } from "drizzle-orm/pg-core";

export const Users = pgTable("users", {
    id: uuid().defaultRandom().primaryKey(),
    email: varchar({ length: 55 }).notNull(),
    username: varchar({ length: 55 }),
    password: text(),
    googleId: text("google_id").unique(),
    facebookId: text("facebook_id").unique(),
    appleId: text("apple_id").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const Otps = pgTable("otps", {
    id: serial().primaryKey(),
    email: varchar({ length: 55 }).notNull(),
    code: varchar({ length: 24 }).notNull(),
    payload: jsonb(),
    expiresAt: timestamp("expires_at").notNull(),
    isUsed: boolean("is_used").notNull().default(false),
})

export const Notifications = pgTable("notifications", {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid().references(() => Users.id, { onDelete: 'cascade' }).notNull(),
    title: text(),
    message: text(),
    announcementId: text("announcement_id"),
    isRead: boolean("is_read").notNull().default(false),
})
