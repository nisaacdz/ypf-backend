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

export const Projects = activities.table("projects", {
  id: uuid().defaultRandom().primaryKey(),
  title: text().notNull(),
  abstract: text(),
  description: text(),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  status: ProjectStatus().default("UPCOMING").notNull(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "set null",
  })
});

export const Events = activities.table("events", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
  scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
  location: text(),
  objective: text(),
  status: EventStatus().default("UPCOMING").notNull(),
  projectId: uuid("project_id").references(() => Projects.id, {
    onDelete: "set null",
  }),
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

export const projectsRelations = relations(Projects, ({ one, many }) => ({
  chapter: one(Chapters, {
    fields: [Projects.chapterId],
    references: [Chapters.id],
  }),
  events: many(Events),
}));
