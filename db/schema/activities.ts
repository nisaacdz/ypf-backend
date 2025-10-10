import {
  boolean,
  pgSchema,
  uuid,
  text,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Chapters, Medium } from "./core";
import { ProjectStatus, EventStatus } from "./enums";

export const activities = pgSchema("activities");

// === TABLES ===

export const Projects = activities.table("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "set null",
  }),
  title: text().notNull(),
  abstract: text(),
  description: text(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  status: ProjectStatus().default("UPCOMING").notNull(),
});

export const Events = activities.table("events", {
  id: uuid().defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
  name: text().notNull(),
  startedAt: timestamp({ withTimezone: true }).notNull(),
  endedAt: timestamp({ withTimezone: true }).notNull(),
  location: text(),
  objective: text(),
  status: EventStatus().default("UPCOMING").notNull(),
});

export const ProjectMedia = activities.table("project_media", {
  id: serial().primaryKey(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "cascade",
  }),
  mediumId: uuid("medium_id").references(() => Medium.id, {
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
  mediumId: uuid("medium_id").references(() => Medium.id, {
    onDelete: "cascade",
  }),
  caption: text(),
  isFeatured: boolean("is_featured").notNull().default(false),
});

// === RELATIONS ===

export const projectsRelations = relations(Projects, ({ one, many }) => ({
  chapter: one(Chapters, {
    fields: [Projects.chapterId],
    references: [Chapters.id],
  }),
  events: many(Events),
}));
