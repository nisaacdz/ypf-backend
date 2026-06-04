import {
  boolean,
  integer,
  numeric,
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { Chapters, Constituents, Documents, Media, citext } from "./core";
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
    .default(sql`'YPFP-' || generate_alphanumeric_combination(8)`)
    .unique()
    .notNull(),
  title: text().notNull(),
  abstract: text(),
  type: ProjectTypeEnum().notNull(),
  category: text(),
  description: text(),
  location: text("location"),
  objectives: jsonb("objectives"),
  impact: text("impact"),
  scheduledStart: timestamp("scheduled_start", {
    withTimezone: true,
  }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  status: ProjectStatusEnum().default("UPCOMING").notNull(),
  budget: numeric("budget", { precision: 12, scale: 2 }),
  targetVolunteers: integer("target_volunteers"),
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
  description: text(),
  status: EventStatusEnum().default("UPCOMING").notNull(),
  maxCapacity: integer("max_capacity"),
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

export const Announcements = activities.table(
  "announcements",
  {
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
  },
  (table) => [
    // Index for job queue queries on announcements
    index("idx_announcements_status_expires").on(table.status, table.expiresAt),
  ],
);

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

// === Certificates ===

export const CertificateTypeEnum = activities.enum("certificate_type", [
  "COMPLETION",
  "PARTICIPATION",
  "ACHIEVEMENT",
  "LEADERSHIP",
]);

export const CertificateStatusEnum = activities.enum("certificate_status", [
  "ACTIVE",
  "REVOKED",
  "EXPIRED",
]);

export const Certificates = activities.table(
  "certificates",
  {
    id: uuid().defaultRandom().primaryKey(),
    certificateNumber: text("certificate_number")
      .default(sql`'YPFC-' || generate_alphanumeric_combination(8)`)
      .unique()
      .notNull(),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    title: text().notNull(),
    programName: text("program_name").notNull(),
    projectId: uuid("project_id").references(() => Projects.id, {
      onDelete: "set null",
    }),
    type: CertificateTypeEnum().notNull().default("COMPLETION"),
    status: CertificateStatusEnum().notNull().default("ACTIVE"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    issuedBy: uuid("issued_by").references(() => Constituents.id, {
      onDelete: "set null",
    }),
    description: text(),
  },
  (table) => [
    index("idx_certificates_constituent").on(table.constituentId),
  ],
);

// === Event Attendance (registration/RSVP) ===

// Dual-mode: either constituentId (authenticated member) OR guest_* fields populated.
// Handler enforces: coalesce(constituent_id, guest_email) is not null.
export const EventAttendees = activities.table(
  "event_attendees",
  {
    id: uuid().defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => Events.id, { onDelete: "cascade" }),
    constituentId: uuid("constituent_id").references(() => Constituents.id, {
      onDelete: "cascade",
    }),
    guestName: text("guest_name"),
    guestEmail: citext("guest_email"),
    guestPhone: text("guest_phone"),
    status: AttendanceStatusEnum().default("ACCEPTED").notNull(),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique().on(table.eventId, table.constituentId),
    index("event_attendees_guest_email_idx").on(table.guestEmail),
  ],
);

// === Project Enrollment (volunteer participation) ===

// Dual-mode: either constituentId (authenticated member) OR guest_* fields populated.
// Handler enforces: coalesce(constituent_id, guest_email) is not null.
export const ProjectEnrollments = activities.table(
  "project_enrollments",
  {
    id: uuid().defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => Projects.id, { onDelete: "cascade" }),
    constituentId: uuid("constituent_id").references(() => Constituents.id, {
      onDelete: "cascade",
    }),
    guestName: text("guest_name"),
    guestEmail: citext("guest_email"),
    guestPhone: text("guest_phone"),
    guestProfile: jsonb("guest_profile"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    unenrolledAt: timestamp("unenrolled_at", { withTimezone: true }),
  },
  (table) => [
    unique().on(table.projectId, table.constituentId),
    index("project_enrollments_guest_email_idx").on(table.guestEmail),
  ],
);

export const certificatesRelations = relations(Certificates, ({ one }) => ({
  constituent: one(Constituents, {
    fields: [Certificates.constituentId],
    references: [Constituents.id],
  }),
  project: one(Projects, {
    fields: [Certificates.projectId],
    references: [Projects.id],
  }),
  issuer: one(Constituents, {
    fields: [Certificates.issuedBy],
    references: [Constituents.id],
    relationName: "certificateIssuer",
  }),
}));

export const eventAttendeesRelations = relations(EventAttendees, ({ one }) => ({
  event: one(Events, {
    fields: [EventAttendees.eventId],
    references: [Events.id],
  }),
  constituent: one(Constituents, {
    fields: [EventAttendees.constituentId],
    references: [Constituents.id],
  }),
}));

export const projectEnrollmentsRelations = relations(
  ProjectEnrollments,
  ({ one }) => ({
    project: one(Projects, {
      fields: [ProjectEnrollments.projectId],
      references: [Projects.id],
    }),
    constituent: one(Constituents, {
      fields: [ProjectEnrollments.constituentId],
      references: [Constituents.id],
    }),
  }),
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
