import {
  pgSchema,
  uuid,
  text,
  timestamp,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Chapters, Committees, Constituents } from "./core";
import { AttendanceStatus } from "./enums";
import { unique } from "drizzle-orm/pg-core";

const communications = pgSchema("communications");

// === TABLES ===
export const Announcements = communications.table("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => Constituents.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// sparse table
// for broadcasting announcement to a chapter
// set chapterId
// for broadcasting announcement to a committee
// set committeeId
// for broadcasting announcement to a committee within a chapter
// set chapterId, committeeId
// for broadcasting announcement globally
// unset chapterId, committeeId
export const AnnouncementBroadCasts = communications.table("announcement_broadcasts", {
  id: serial().primaryKey(),
  announcementId: uuid("id").notNull(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, { onDelete: 'cascade'}),
  committeeId: uuid("committee_id").references(() => Committees.id, { onDelete: 'cascade' }),
  isArchived: boolean("is_archived").notNull().default(false),
});

export const Meetings = communications.table("meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  agenda: text("agenda"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  locationUrl: text("location_url"),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "cascade",
  }),
  committeeId: uuid("committee_id").references(() => Committees.id, {
    onDelete: "cascade",
  }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const MeetingAttendees = communications.table(
  "meeting_attendees",
  {
    id: serial("id").primaryKey(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => Meetings.id, { onDelete: "cascade" }),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    status: AttendanceStatus("status").default("INVITED").notNull(),
    isRequired: boolean("is_required").default(true).notNull(),
  },
  (table) => [unique().on(table.meetingId, table.constituentId)],
);

// === RELATIONS ===

export const meetingsRelations = relations(Meetings, ({ one, many }) => ({
  chapter: one(Chapters, {
    fields: [Meetings.chapterId],
    references: [Chapters.id],
  }),
  committee: one(Committees, {
    fields: [Meetings.committeeId],
    references: [Committees.id],
  }),
  createdBy: one(Constituents, {
    fields: [Meetings.createdById],
    references: [Constituents.id],
  }),
  attendees: many(MeetingAttendees),
}));

export const meetingAttendeesRelations = relations(
  MeetingAttendees,
  ({ one }) => ({
    meeting: one(Meetings, {
      fields: [MeetingAttendees.meetingId],
      references: [Meetings.id],
    }),
    constituent: one(Constituents, {
      fields: [MeetingAttendees.constituentId],
      references: [Constituents.id],
    }),
  }),
);
