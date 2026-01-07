import {
  boolean,
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { Chapters, Constituents, Documents, Media } from "./core";
import { TargetingFilter } from "@/shared/types/targeting";

export const activities = pgSchema("activities");

export const ProjectStatusEnum = activities.enum("project_status", [
  "UPCOMING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
export const ProjectTypeEnum = activities.enum("project_type", [
  "WELFARE",
  "COMMUNITY",
  "ADVOCACY",
  "OTHER",
]);
export const EventStatusEnum = activities.enum("event_status", [
  "UPCOMING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
export const EventTypeEnum = activities.enum("event_type", [
  "MENTORSHIP",
  "WORKSHOP",
  "CHILDCARE",
  "NETWORKING",
  "STREETCARE",
]);
export const AttendanceStatusEnum = activities.enum("attendance_status", [
  "INVITED",
  "ACCEPTED",
  "DECLINED",
  "ATTENDED",
]);

export const Projects = activities.table("projects", {
  id: uuid().defaultRandom().primaryKey(),
  publicId: text("public_id")
    .default(sql`generate_public_id('YPFP-', 8)`)
    .unique()
    .notNull(),
  title: text().notNull(),
  abstract: text(),
  type: ProjectTypeEnum().notNull(),
  category: text(),
  description: text(),
  scheduledStart: timestamp("scheduled_start", {
    withTimezone: true,
  }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  status: ProjectStatusEnum().default("UPCOMING").notNull(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "set null",
  }),
});

// Set at most one of [projectId, chapterId] non-null
// Most important table
//
export const Events = activities.table("events", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  scheduledStart: timestamp("scheduled_start", {
    withTimezone: true,
  }).notNull(),
  type: EventTypeEnum().notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  location: text(),
  objective: text(),
  status: EventStatusEnum().default("UPCOMING").notNull(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "set null",
  }),
});

export const ProjectBeneficiaries = activities.table(
  "project_beneficiaries",
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => Projects.id, { onDelete: "restrict" }),
    beneficiaryId: uuid("beneficiary_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "restrict" }),
  },
  (table) => [unique().on(table.projectId, table.beneficiaryId)],
);

export const ProjectMedia = activities.table("project_media", {
  id: uuid().defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "cascade",
  }),
  mediumId: uuid("medium_id").references(() => Media.id, {
    onDelete: "cascade",
  }),
  caption: text(),
  isFeatured: boolean("is_featured").notNull().default(false),
});

export const EventMedia = activities.table("event_media", {
  id: uuid().defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => Events.id, {
    onDelete: "cascade",
  }),
  mediumId: uuid("medium_id").references(() => Media.id, {
    onDelete: "cascade",
  }),
  caption: text(),
  isFeatured: boolean("is_featured").notNull().default(false),
});

export const EventDocuments = activities.table("event_documents", {
  id: uuid().defaultRandom().primaryKey(),
  eventId: uuid("event_id").references(() => Events.id, {
    onDelete: "cascade",
  }),
  documentId: uuid("document_id").references(() => Documents.id, {
    onDelete: "cascade",
  }),
  title: text().notNull(),
});

export const projectsRelations = relations(Projects, ({ one, many }) => ({
  chapter: one(Chapters, {
    fields: [Projects.chapterId],
    references: [Chapters.id],
  }),
  events: many(Events),
}));

export const Announcements = activities.table("announcements", {
  id: uuid().defaultRandom().primaryKey(),
  title: text().notNull(),
  content: text().notNull(), // Markdown or HTML

  // Targeting Rules (The "Who")
  targetCriteria: jsonb("target_criteria").$type<TargetingFilter>().notNull(),

  authorId: uuid("author_id").references(() => Constituents.id),

  // Scheduling & Status
  status: text().default("DRAFT"), // DRAFT, PUBLISHED, ARCHIVED
  publishedAt: timestamp("published_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const ConstituentAnnouncements = activities.table(
  "constituent_announcements",
  {
    id: uuid().defaultRandom().primaryKey(),
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => Announcements.id, { onDelete: "cascade" }),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),

    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),

    // Optional: Channel delivery status
    emailSent: boolean("email_sent").default(false).notNull(),
  },
  (table) => [
    // Ensure a user only gets an announcement once
    unique().on(table.announcementId, table.constituentId),
  ],
);

// === RELATIONS ===

export const announcementsRelations = relations(
  Announcements,
  ({ one, many }) => ({
    author: one(Constituents, {
      fields: [Announcements.authorId],
      references: [Constituents.id],
    }),
    constituentAnnouncements: many(ConstituentAnnouncements),
  }),
);

export const constituentAnnouncementsRelations = relations(
  ConstituentAnnouncements,
  ({ one }) => ({
    announcement: one(Announcements, {
      fields: [ConstituentAnnouncements.announcementId],
      references: [Announcements.id],
    }),
    constituent: one(Constituents, {
      fields: [ConstituentAnnouncements.constituentId],
      references: [Constituents.id],
    }),
  }),
);
