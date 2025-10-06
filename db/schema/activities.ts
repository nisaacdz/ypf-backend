import { pgSchema, uuid, text, timestamp, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Chapters, Constituents } from "./core";
import { ProjectStatus, EventStatus } from "./enums";
import { unique } from "drizzle-orm/pg-core";

export const activities = pgSchema("activities");

// === TABLES ===

export const Projects = activities.table("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "set null",
  }),
  projectName: text("project_name").notNull(),
  projectObjective: text("project_objective"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  status: ProjectStatus("status").default("PLANNING").notNull(),
});

export const Events = activities.table("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  eventName: text("event_name").notNull(),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
  eventLocation: text("event_location"),
  eventObjectives: text("event_objectives"),
  status: EventStatus("status").default("UPCOMING").notNull(),
});

export type Event = typeof Events.$inferSelect;

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
