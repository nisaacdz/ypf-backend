import {
  boolean,
  pgSchema,
  uuid,
  text,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Chapters, Committees, Constituents, Media } from "./core";

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
  id: serial().primaryKey(),
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
  id: serial().primaryKey(),
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
  content: text().notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => Constituents.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const AnnouncementBroadCasts = activities.table(
  "announcement_broadcasts",
  {
    id: serial().primaryKey(),
    announcementId: uuid("announcement_id").references(() => Announcements.id, {
      onDelete: "cascade",
    }),
    chapterId: uuid("chapter_id").references(() => Chapters.id, {
      onDelete: "cascade",
    }),
    committeeId: uuid("committee_id").references(() => Committees.id, {
      onDelete: "cascade",
    }),
  },
);

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
