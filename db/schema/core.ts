/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  pgSchema,
  uuid,
  timestamp,
  text,
  boolean,
  serial,
  date,
  unique,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { MediaType, ContactType, MembershipType, Gender } from "./enums";

export const core = pgSchema("core");

// === TABLES ===

export const Media = core.table("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: text("external_id").notNull().unique(),
  mediaType: MediaType("media_type").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const Constituents = core.table("constituents", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredName: text("preferred_name"),
  profilePhotoId: uuid("profile_photo_id").references(() => Media.id, {
    onDelete: "set null",
  }),
  salutation: text("salutation"),
  dateOfBirth: date("date_of_birth"),
  gender: Gender("gender"),
  joinDate: timestamp("join_date", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Delibrate
export const ContactInformations = core.table(
  "contact_informations",
  {
    id: serial("id").primaryKey(),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    contactType: ContactType("contact_type").notNull(),
    value: text("value").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
  },
  (table) => [unique().on(table.constituentId, table.contactType, table.value)],
);

export const Memberships = core.table("memberships", {
  id: serial("id").primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  // we'll ensure that only one of this membership type is `active` for the constituent at a time
  type: MembershipType("type").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  assignerId: uuid("assigner_id").references(() => Constituents.id, {
    onDelete: "set null",
  }),
});

export const Chapters = core.table("chapters", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  description: text("description"),
  foundingDate: date("founding_date").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  parentId: uuid("parent_id").references((): any => Chapters.id, {
    onDelete: "set null",
  }),
});

export const ChapterMemberships = core.table(
  "chapter_memberships",
  {
    id: serial("id").primaryKey(),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => Chapters.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [unique().on(table.constituentId, table.chapterId)],
);

export const Committees = core.table("committees", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "cascade",
  }),
});

export const CommitteeMemberships = core.table(
  "committee_memberships",
  {
    id: serial("id").primaryKey(),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    committeeId: uuid("committee_id")
      .notNull()
      .references(() => Committees.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [unique().on(table.constituentId, table.committeeId)],
);

export const Roles = core.table("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  level: integer().notNull(), // roughly indicates seniority level, good for ordering by significance
  description: text("description"),
});

export const RoleAssignments = core.table("role_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  roleId: text("role_id")
    .notNull()
    .references(() => Roles.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "cascade",
  }),
  committeeId: uuid("committee_id").references(() => Committees.id, {
    onDelete: "cascade",
  }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const Organizations = core.table("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  website: text("website"),
  description: text("description"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const OrganizationContacts = core.table(
  "organization_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => Organizations.id, { onDelete: "cascade" }),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    title: text("title"), // their role at the org
    isPrimary: boolean("is_primary").default(false).notNull(),
  },
  (table) => [unique().on(table.organizationId, table.constituentId)],
);

export const ChapterMedia = core.table(
  "chapter_media",
  {
    id: serial().primaryKey(),
    chapterId: uuid("chapter_id").references(() => Chapters.id, { onDelete: 'cascade'}),
    mediaId: uuid("media_id").references(() => Media.id, { onDelete: 'cascade' }),
    isFeatured: boolean("is_featured").notNull().default(false),
  }
);

export const CommitteeMedia = core.table(
  "committee_media",
  {
    id: serial().primaryKey(),
    committeeId: uuid("committee_id").references(() => Committees.id, { onDelete: 'cascade'}),
    mediaId: uuid("media_id").references(() => Media.id, { onDelete: 'cascade' }),
    isFeatured: boolean("is_featured").notNull().default(false),
  }
);

// === RELATIONS ===

export const mediaRelations = relations(Media, ({ one }) => ({
  creator: one(Constituents, {
    fields: [Media.createdBy],
    references: [Constituents.id],
    relationName: "mediaCreator",
  }),
}));

export const constituentsRelations = relations(
  Constituents,
  ({ one, many }) => ({
    profilePhoto: one(Media, {
      fields: [Constituents.profilePhotoId],
      references: [Media.id],
    }),
    contactInfo: many(ContactInformations),
    memberships: many(Memberships),
    chapterMemberships: many(ChapterMemberships),
    committeeMemberships: many(CommitteeMemberships),
    roleAssignments: many(RoleAssignments),
  }),
);

export const contactInformationsRelations = relations(
  ContactInformations,
  ({ one }) => ({
    constituent: one(Constituents, {
      fields: [ContactInformations.constituentId],
      references: [Constituents.id],
    }),
  }),
);

export const membershipsRelations = relations(Memberships, ({ one }) => ({
  constituent: one(Constituents, {
    fields: [Memberships.constituentId],
    references: [Constituents.id],
  }),
  assigner: one(Constituents, {
    fields: [Memberships.assignerId],
    references: [Constituents.id],
    relationName: "membershipAssigner",
  }),
}));

export const chaptersRelations = relations(Chapters, ({ one, many }) => ({
  parentChapter: one(Chapters, {
    fields: [Chapters.parentId],
    references: [Chapters.id],
    relationName: "parentChapterRelation",
  }),
  childChapters: many(Chapters, { relationName: "parentChapterRelation" }),
  members: many(ChapterMemberships),
}));

export const chapterMembershipsRelations = relations(
  ChapterMemberships,
  ({ one }) => ({
    constituent: one(Constituents, {
      fields: [ChapterMemberships.constituentId],
      references: [Constituents.id],
    }),
    chapter: one(Chapters, {
      fields: [ChapterMemberships.chapterId],
      references: [Chapters.id],
    }),
  }),
);

export const committeesRelations = relations(Committees, ({ many }) => ({
  members: many(CommitteeMemberships),
}));

export const committeeMembershipsRelations = relations(
  CommitteeMemberships,
  ({ one }) => ({
    constituent: one(Constituents, {
      fields: [CommitteeMemberships.constituentId],
      references: [Constituents.id],
    }),
    committee: one(Committees, {
      fields: [CommitteeMemberships.committeeId],
      references: [Committees.id],
    }),
  }),
);

export const rolesRelations = relations(Roles, ({ many }) => ({
  assignments: many(RoleAssignments),
}));

export const roleAssignmentsRelations = relations(
  RoleAssignments,
  ({ one }) => ({
    constituent: one(Constituents, {
      fields: [RoleAssignments.constituentId],
      references: [Constituents.id],
    }),
    role: one(Roles, {
      fields: [RoleAssignments.roleId],
      references: [Roles.id],
    }),
    chapter: one(Chapters, {
      fields: [RoleAssignments.chapterId],
      references: [Chapters.id],
    }),
    committee: one(Committees, {
      fields: [RoleAssignments.committeeId],
      references: [Committees.id],
    }),
  }),
);
