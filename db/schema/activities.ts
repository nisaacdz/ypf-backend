import { boolean, pgSchema, uuid, text, timestamp, decimal, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Chapters, Constituents, Media } from "./core";
import { ProjectStatus, EventStatus } from "./enums";
import { unique } from "drizzle-orm/pg-core";

export const activities = pgSchema("activities");

// === TABLES ===

export const Projects = activities.table("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  abstract: text("abstract").notNull(),
  objective: text("objective"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  status: ProjectStatus("status").default("UPCOMING").notNull(),
});

export const Events = activities.table("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  name: text("event_name").notNull(),
  date: timestamp("event_date", { withTimezone: true }).notNull(),
  location: text("event_location"),
  objectives: text("event_objectives"),
  status: EventStatus("status").default("UPCOMING").notNull(),
});

export const EventParticipations = activities.table(
  "event_participations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => Events.id, { onDelete: "cascade" }),
    volunteerHours: decimal("volunteer_hours", { precision: 5, scale: 2 }),
    roleDuringEvent: text("role_during_event"),
  },
  (table) => [unique().on(table.constituentId, table.eventId)],
);

export const ProjectMedia = activities.table(
  "project_media",
  {
    id: serial().primaryKey(),
    projectId: uuid("project_id").references(() => Projects.id, { onDelete: 'cascade'}),
    mediaId: uuid("media_id").references(() => Media.id, { onDelete: 'cascade' }),
    isFeatured: boolean("is_featured").notNull().default(false),
  }
);

export const EventMedia = activities.table(
  "event_media",
  {
    id: serial().primaryKey(),
    eventId: uuid("event_id").references(() => Events.id, { onDelete: 'cascade'}),
    mediaId: uuid("media_id").references(() => Media.id, { onDelete: 'cascade' }),
    isFeatured: boolean("is_featured").notNull().default(false),
  }
);

// === RELATIONS ===

export const projectsRelations = relations(Projects, ({ one, many }) => ({
  chapter: one(Chapters, {
    fields: [Projects.chapterId],
    references: [Chapters.id],
  }),
  events: many(Events),
}));

export const eventsRelations = relations(Events, ({ one, many }) => ({
  project: one(Projects, {
    fields: [Events.projectId],
    references: [Projects.id],
  }),
  participants: many(EventParticipations),
}));

export const eventParticipationsRelations = relations(
  EventParticipations,
  ({ one }) => ({
    constituent: one(Constituents, {
      fields: [EventParticipations.constituentId],
      references: [Constituents.id],
    }),
    event: one(Events, {
      fields: [EventParticipations.eventId],
      references: [Events.id],
    }),
  }),
);
