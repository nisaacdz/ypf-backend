import {
  pgSchema,
  uuid,
  text,
  timestamp,
  decimal,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Constituents } from "./core";
import { Projects } from "./activities";

const impact = pgSchema("impact");

// === TABLES ===

export const ImpactReports = impact.table("impact_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => Projects.id, { onDelete: "restrict" }),
  reportTitle: text("report_title").notNull(),
  narrative: text("narrative").notNull(),
  dateCreated: timestamp("date_created", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "restrict" }),
});

export const ImpactAreas = impact.table("impact_areas", {
  id: uuid("id").defaultRandom().primaryKey(),
  areaName: text("area_name").notNull().unique(),
  description: text("description"),
});

export const Outcomes = impact.table("outcomes", {
  id: uuid("id").defaultRandom().primaryKey(),
  impactAreaId: uuid("impact_area_id")
    .notNull()
    .references(() => ImpactAreas.id, { onDelete: "restrict" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => Projects.id, { onDelete: "cascade" }),
  outcomeName: text("outcome_name").notNull(),
  targetValue: decimal("target_value", { precision: 12, scale: 2 }),
  isQuantitative: boolean("is_quantitative").notNull(),
});

export const Metrics = impact.table("metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  outcomeId: uuid("outcome_id")
    .notNull()
    .references(() => Outcomes.id, { onDelete: "cascade" }),
  measurementDate: date("measurement_date").notNull(),
  value: decimal("value", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  dataSource: text("data_source"),
});

// === RELATIONS ===

export const impactReportsRelations = relations(ImpactReports, ({ one }) => ({
  project: one(Projects, {
    fields: [ImpactReports.projectId],
    references: [Projects.id],
  }),
  createdBy: one(Constituents, {
    fields: [ImpactReports.createdById],
    references: [Constituents.id],
  }),
}));

export const outcomesRelations = relations(Outcomes, ({ one, many }) => ({
  impactArea: one(ImpactAreas, {
    fields: [Outcomes.impactAreaId],
    references: [ImpactAreas.id],
  }),
  project: one(Projects, {
    fields: [Outcomes.projectId],
    references: [Projects.id],
  }),
  metrics: many(Metrics),
}));

export const metricsRelations = relations(Metrics, ({ one }) => ({
  outcome: one(Outcomes, {
    fields: [Metrics.outcomeId],
    references: [Outcomes.id],
  }),
}));
