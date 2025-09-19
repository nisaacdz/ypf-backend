import {
  pgSchema,
  uuid,
  timestamp,
  text,
  boolean,
  serial,
  date,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { Users } from "./app";
import { MediaType, ContactType, MembershipType, Gender } from "./enums";

const core = pgSchema("core");

// === TABLES ===

export const Medias = core.table("media", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: text("url").notNull(),
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
  userId: uuid("user_id")
    .unique()
    .references(() => Users.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredName: text("preferred_name"),
  selfieId: uuid("selfie_id").references(() => Medias.id, {
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
  (table) => [unique().on(table.constituentId, table.contactType, table.value)]
);

export const Memberships = core.table("memberships", {
  id: serial("id").primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  // we'll ensure that only one of this membership type is `active` for the constituent at a time
  type: MembershipType("type").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }),
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
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [unique().on(table.constituentId, table.chapterId)]
);

export const Committees = core.table("committees", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
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
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => [unique().on(table.constituentId, table.committeeId)]
);

export const Roles = core.table("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const RoleAssignments = core.table("role_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  roleId: integer("role_id")
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

// === RELATIONS ===

export const mediasRelations = relations(Medias, ({ one }) => ({
  creator: one(Constituents, {
    fields: [Medias.createdBy],
    references: [Constituents.id],
    relationName: "mediaCreator",
  }),
}));

export const constituentsRelations = relations(
  Constituents,
  ({ one, many }) => ({
    user: one(Users, { fields: [Constituents.userId], references: [Users.id] }),
    selfie: one(Medias, {
      fields: [Constituents.selfieId],
      references: [Medias.id],
    }),
    contactInfo: many(ContactInformations),
    memberships: many(Memberships),
    chapterMemberships: many(ChapterMemberships),
    committeeMemberships: many(CommitteeMemberships),
    roleAssignments: many(RoleAssignments),
  })
);

export const contactInformationsRelations = relations(
  ContactInformations,
  ({ one }) => ({
    constituent: one(Constituents, {
      fields: [ContactInformations.constituentId],
      references: [Constituents.id],
    }),
  })
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
  })
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
  })
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
  })
);
