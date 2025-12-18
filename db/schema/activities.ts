import {
  boolean,
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
  unique,
  decimal,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Chapters, Constituents, Media, Committees, Members } from "./core";
import { AudienceRule } from "@/shared/types/targeting";

export const activities = pgSchema("activities");

export const ProjectStatusEnum = activities.enum("project_status", [
  "UPCOMING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
export const EventStatusEnum = activities.enum("event_status", [
  "UPCOMING",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
]);
export const AttendanceStatusEnum = activities.enum("attendance_status", [
  "INVITED",
  "ACCEPTED",
  "DECLINED",
  "ATTENDED",
]);

export const Projects = activities.table("projects", {
  id: uuid().defaultRandom().primaryKey(),
  title: text().notNull(),
  abstract: text(),
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

export const Events = activities.table("events", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  scheduledStart: timestamp("scheduled_start", {
    withTimezone: true,
  }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  location: text(),
  objective: text(),
  status: EventStatusEnum().default("UPCOMING").notNull(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
});

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
  targetCriteria: jsonb("target_criteria").$type<AudienceRule>().notNull(),

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

export const Programs = activities.table("programs", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  description: text(),
  type: text().notNull(), // mentorship, village_childcare, welfare, leadership, networking
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: text().notNull().default('active'), // active, completed, paused
  budget: decimal("budget", { precision: 12, scale: 2 }),
  maxParticipants: integer("max_participants"),
  committeeId: uuid("committee_id").references(() => Committees.id),
  chapterId: uuid("chapter_id").references(() => Chapters.id),
  createdBy: uuid("created_by").references(() => Constituents.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const ProgramEnrollments = activities.table("program_enrollments", {
  id: uuid().defaultRandom().primaryKey(),
  programId: uuid("program_id").notNull().references(() => Programs.id, { onDelete: "cascade" }),
  memberId: uuid("member_id").notNull().references(() => Members.id, { onDelete: "cascade" }),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow(),
  status: text().notNull().default('enrolled'), // enrolled, active, completed, withdrawn
  progress: integer().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  certificateId: uuid("certificate_id"),
}, (t) => ({
  unq: unique().on(t.programId, t.memberId),
}));

export const programsRelations = relations(Programs, ({ one, many }) => ({
  committee: one(Committees, {
    fields: [Programs.committeeId],
    references: [Committees.id],
  }),
  chapter: one(Chapters, {
    fields: [Programs.chapterId],
    references: [Chapters.id],
  }),
  creator: one(Constituents, {
    fields: [Programs.createdBy],
    references: [Constituents.id],
  }),
  enrollments: many(ProgramEnrollments),
}));

export const programEnrollmentsRelations = relations(ProgramEnrollments, ({ one }) => ({
  program: one(Programs, {
    fields: [ProgramEnrollments.programId],
    references: [Programs.id],
  }),
  member: one(Members, {
    fields: [ProgramEnrollments.memberId],
    references: [Members.id],
  }),
}));

// export const Meetings = communications.table("meetings", {
//   id: uuid().defaultRandom().primaryKey(),
//   title: text().notNull(),
//   agenda: text(),
//   startTime: timestamp("start_time", { withTimezone: true }).notNull(),
//   endTime: timestamp("end_time", { withTimezone: true }).notNull(),
//   locationUrl: text("location_url"),
//   chapterId: uuid("chapter_id").references(() => Chapters.id, {
//     onDelete: "cascade",
//   }),
//   committeeId: uuid("committee_id").references(() => Committees.id, {
//     onDelete: "cascade",
//   }),
//   createdById: uuid("created_by_id")
//     .notNull()
//     .references(() => Constituents.id, { onDelete: "restrict" }),
//   createdAt: timestamp("created_at", { withTimezone: true })
//     .defaultNow()
//     .notNull(),
// });

// export const MeetingAttendees = communications.table(
//   "meeting_attendees",
//   {
//     id: serial("id").primaryKey(),
//     meetingId: uuid("meeting_id")
//       .notNull()
//       .references(() => Meetings.id, { onDelete: "cascade" }),
//     constituentId: uuid("constituent_id")
//       .notNull()
//       .references(() => Constituents.id, { onDelete: "cascade" }),
//     status: AttendanceStatusEnum("status").default("INVITED").notNull(),
//     isRequired: boolean("is_required").default(true).notNull(),
//   },
//   (table) => [unique().on(table.meetingId, table.constituentId)],
// );

// // === RELATIONS ===

// export const meetingsRelations = relations(Meetings, ({ one, many }) => ({
//   chapter: one(Chapters, {
//     fields: [Meetings.chapterId],
//     references: [Chapters.id],
//   }),
//   committee: one(Committees, {
//     fields: [Meetings.committeeId],
//     references: [Committees.id],
//   }),
//   createdBy: one(Constituents, {
//     fields: [Meetings.createdById],
//     references: [Constituents.id],
//   }),
//   attendees: many(MeetingAttendees),
// }));

// export const meetingAttendeesRelations = relations(
//   MeetingAttendees,
//   ({ one }) => ({
//     meeting: one(Meetings, {
//       fields: [MeetingAttendees.meetingId],
//       references: [Meetings.id],
//     }),
//     constituent: one(Constituents, {
//       fields: [MeetingAttendees.constituentId],
//       references: [Constituents.id],
//     }),
//   }),
// );

export const CertificateTypeEnum = activities.enum("certificate_type", [
  "EVENT_PARTICIPATION",
  "PROGRAM_COMPLETION",
  "HONORARY",
  "MEMBERSHIP",
  "VOLUNTEER_APPRECIATION"
]);

export const Certificates = activities.table("certificates", {
  id: uuid().defaultRandom().primaryKey(),
  recipientId: uuid("recipient_id").references(() => Members.id, { onDelete: "cascade" }).notNull(),
  type: CertificateTypeEnum().notNull(),
  title: text().notNull(),
  description: text(),
  issueDate: timestamp("issue_date", { withTimezone: true }).defaultNow().notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  fileUrl: text("file_url"),
  metadata: jsonb("metadata"),
  eventId: uuid("event_id").references(() => Events.id, { onDelete: "set null" }),
  programId: uuid("program_id").references(() => Programs.id, { onDelete: "set null" }),
  issuedBy: uuid("issued_by").references(() => Members.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const certificatesRelations = relations(Certificates, ({ one }) => ({
  recipient: one(Members, {
    fields: [Certificates.recipientId],
    references: [Members.id],
    relationName: "recipient"
  }),
  event: one(Events, {
    fields: [Certificates.eventId],
    references: [Events.id],
  }),
  program: one(Programs, {
    fields: [Certificates.programId],
    references: [Programs.id],
  }),
  issuer: one(Members, {
    fields: [Certificates.issuedBy],
    references: [Members.id],
    relationName: "issuer"
  }),
}));

export const WelfareCaseTypeEnum = activities.enum("welfare_case_type", [
  "FINANCIAL_SUPPORT",
  "MEDICAL",
  "EDUCATIONAL",
  "EMERGENCY",
  "COUNSELING",
  "OTHER"
]);

export const WelfareCaseStatusEnum = activities.enum("welfare_case_status", [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "RESOLVED"
]);

export const WelfareCasePriorityEnum = activities.enum("welfare_case_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT"
]);

export const WelfareCases = activities.table("welfare_cases", {
  id: uuid().defaultRandom().primaryKey(),
  memberId: uuid("member_id").references(() => Members.id, { onDelete: "cascade" }).notNull(),
  type: WelfareCaseTypeEnum().notNull(),
  title: text().notNull(),
  description: text().notNull(),
  status: WelfareCaseStatusEnum().default("PENDING").notNull(),
  priority: WelfareCasePriorityEnum().default("MEDIUM").notNull(),
  requestedAmount: decimal("requested_amount", { precision: 10, scale: 2 }),
  approvedAmount: decimal("approved_amount", { precision: 10, scale: 2 }),
  assignedTo: uuid("assigned_to").references(() => Members.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  chapterId: uuid("chapter_id").references(() => Chapters.id, { onDelete: "set null" }),
});

export const welfareCasesRelations = relations(WelfareCases, ({ one }) => ({
  member: one(Members, {
    fields: [WelfareCases.memberId],
    references: [Members.id],
    relationName: "requester"
  }),
  assignee: one(Members, {
    fields: [WelfareCases.assignedTo],
    references: [Members.id],
    relationName: "assignee"
  }),
  chapter: one(Chapters, {
    fields: [WelfareCases.chapterId],
    references: [Chapters.id],
  }),
}));


