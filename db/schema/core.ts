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
  AnyPgColumn,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { MediumType, ContactType, Gender } from "./enums";

export const core = pgSchema("core");

// === TABLES ===

export const Medium = core.table("media", {
  id: uuid().defaultRandom().primaryKey(),
  externalId: text("external_id").notNull().unique(),
  type: MediumType().notNull(),
  width: integer().notNull(),
  height: integer().notNull(),
  sizeInBytes: integer().notNull(),
  uploadedBy: uuid("uploaded_by").references(
    (): AnyPgColumn => Constituents.id,
    { onDelete: "set null" },
  ),
  uploadedAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const Constituents = core.table("constituents", {
  id: uuid().defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredName: text("preferred_name"),
  profilePhotoId: uuid("profile_photo_id").references(() => Medium.id, {
    onDelete: "set null",
  }),
  salutation: text(),
  dateOfBirth: date("date_of_birth"),
  gender: Gender(),
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
    id: serial().primaryKey(),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    contactType: ContactType("contact_type").notNull(),
    value: text().notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
  },
  (table) => [unique().on(table.constituentId, table.contactType, table.value)],
);

// ensure non overlapping periods of membership at dbms level
export const Members = core.table("members", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const Donors = core.table("donors", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .unique()
    .references(() => Constituents.id, { onDelete: "cascade" }),
});

// ensure non overlapping periods of volunteering at dbms level
export const Volunteers = core.table("volunteers", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

// ensure non overlapping periods of auditing at dbms level
export const Auditors = core.table("auditors", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

// ensure non overlapping periods of administration at dbms level
export const Admins = core.table("admins", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const MemberTitles = core.table(
  "member_titles",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    description: text(),
    _level: integer().notNull(), // roughly indicates relevance, 0 is highest
    chapterId: uuid("chapter_id").references(() => Chapters.id, {
      onDelete: "cascade",
    }),
    committeeId: uuid("committee_id").references(() => Committees.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [
    check(
      "at_most_one_scope",
      sql`num_nonnulls(${table.chapterId}, ${table.committeeId}) <= 1`,
    ),
    unique().on(table.title, table.chapterId, table.committeeId),
  ],
);

// add constraint at dbms level for non overlapping (memberId, titleId) assignments
export const MemberTitlesAssignments = core.table("member_titles_assignments", {
  id: serial().primaryKey(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => Members.id, { onDelete: "cascade" }),
  titleId: text("title_id")
    .notNull()
    .references(() => MemberTitles.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const AdminRoles = core.enum("admin_roles", [
  "SUPER_ADMIN",
  "REGULAR_ADMIN",
]);

// TODO review Roles and Assignments
export const AdminRolesAssignments = core.table("admin_roles_assignments", {
  id: serial().primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => Admins.id, { onDelete: "cascade" }),
  role: AdminRoles("role").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const Chapters = core.table("chapters", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  country: text().notNull(),
  description: text(),
  foundingDate: date("founding_date").notNull(),
  archivedAt: date("archived_at"),
  parentId: uuid("parent_id").references((): AnyPgColumn => Chapters.id, {
    onDelete: "set null",
  }),
});

// add constraint at dbms level for non overlapping (memberId, chapterId) assignment duration
export const ChapterMemberships = core.table("chapter_memberships", {
  id: serial().primaryKey(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => Members.id, { onDelete: "cascade" }),
  chapterId: uuid("chapter_id")
    .notNull()
    .references(() => Chapters.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

// if the committee.chapter is archived, the committee itself should be considered archived and excluded from lists
// ensure application level chooses the committee.chapter.archivedAt over committee.archivedAt when both are set
export const Committees = core.table("committees", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull().unique(),
  description: text(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "cascade",
  }),
  archivedAt: date("archived_at"),
});

// add constraint at dbms level for non overlapping (memberId, committeeId) assignments
export const CommitteeMemberships = core.table("committee_memberships", {
  id: serial().primaryKey(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => Members.id, { onDelete: "cascade" }),
  committeeId: uuid("committee_id")
    .notNull()
    .references(() => Committees.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const Organizations = core.table("organizations", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  website: text(),
  description: text(),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const OrganizationContacts = core.table(
  "organization_contacts",
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => Organizations.id, { onDelete: "cascade" }),
    constituentId: uuid("constituent_id")
      .notNull()
      .references(() => Constituents.id, { onDelete: "cascade" }),
    title: text(), // their role at the org
    isPrimary: boolean("is_primary").default(false).notNull(),
  },
  (table) => [unique().on(table.organizationId, table.constituentId)],
);

export const ChapterMedia = core.table("chapter_media", {
  id: serial().primaryKey(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "cascade",
  }),
  mediumId: uuid("medium_id").references(() => Medium.id, {
    onDelete: "cascade",
  }),
  caption: text(),
  isFeatured: boolean("is_featured").notNull().default(false),
});

export const CommitteeMedia = core.table("committee_media", {
  id: serial().primaryKey(),
  committeeId: uuid("committee_id").references(() => Committees.id, {
    onDelete: "cascade",
  }),
  mediumId: uuid("medium_id").references(() => Medium.id, {
    onDelete: "cascade",
  }),
  caption: text(),
  isFeatured: boolean("is_featured").notNull().default(false),
});

// === RELATIONS ===

export const mediaRelations = relations(Medium, ({ one }) => ({
  uploader: one(Constituents, {
    fields: [Medium.uploadedBy],
    references: [Constituents.id],
    relationName: "mediaUploader",
  }),
}));

export const constituentsRelations = relations(
  Constituents,
  ({ one, many }) => ({
    // A Constituent can have only ONE Donor profile (One-to-One)
    donorProfile: one(Donors, {
      fields: [Constituents.id],
      references: [Donors.constituentId],
    }),

    // A Constituent can have MANY historical periods for these roles (One-to-Many)
    membershipPeriods: many(Members),
    volunteerPeriods: many(Volunteers),
    auditorPeriods: many(Auditors),
    adminPeriods: many(Admins),

    // Standard relations for other entities
    profilePhoto: one(Medium, {
      fields: [Constituents.profilePhotoId],
      references: [Medium.id],
    }),
    contactInformations: many(ContactInformations),
    organizationContacts: many(OrganizationContacts),
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

export const membersRelations = relations(Members, ({ one, many }) => ({
  // Each membership period belongs to one constituent
  constituent: one(Constituents, {
    fields: [Members.constituentId],
    references: [Constituents.id],
  }),
  // A specific membership period can be associated with multiple chapter/committee memberships or titles
  chapterMemberships: many(ChapterMemberships),
  committeeMemberships: many(CommitteeMemberships),
  titleAssignments: many(MemberTitlesAssignments),
}));

export const donorsRelations = relations(Donors, ({ one }) => ({
  // Each donor profile belongs to one constituent
  constituent: one(Constituents, {
    fields: [Donors.constituentId],
    references: [Constituents.id],
  }),
}));

export const volunteersRelations = relations(Volunteers, ({ one }) => ({
  // Each volunteer period belongs to one constituent
  constituent: one(Constituents, {
    fields: [Volunteers.constituentId],
    references: [Constituents.id],
  }),
}));

export const auditorsRelations = relations(Auditors, ({ one }) => ({
  // Each auditor period belongs to one constituent
  constituent: one(Constituents, {
    fields: [Auditors.constituentId],
    references: [Constituents.id],
  }),
}));

export const adminsRelations = relations(Admins, ({ one, many }) => ({
  // Each admin period belongs to one constituent
  constituent: one(Constituents, {
    fields: [Admins.constituentId],
    references: [Constituents.id],
  }),
  // A specific admin period can have many role assignments
  roleAssignments: many(AdminRolesAssignments),
}));

export const memberTitlesRelations = relations(
  MemberTitles,
  ({ one, many }) => ({
    chapter: one(Chapters, {
      fields: [MemberTitles.chapterId],
      references: [Chapters.id],
    }),
    committee: one(Committees, {
      fields: [MemberTitles.committeeId],
      references: [Committees.id],
    }),
    assignments: many(MemberTitlesAssignments),
  }),
);

export const memberTitlesAssignmentsRelations = relations(
  MemberTitlesAssignments,
  ({ one }) => ({
    member: one(Members, {
      fields: [MemberTitlesAssignments.memberId],
      references: [Members.id],
    }),
    title: one(MemberTitles, {
      fields: [MemberTitlesAssignments.titleId],
      references: [MemberTitles.id],
    }),
  }),
);

export const adminRolesAssignmentsRelations = relations(
  AdminRolesAssignments,
  ({ one }) => ({
    admin: one(Admins, {
      fields: [AdminRolesAssignments.adminId],
      references: [Admins.id],
    }),
  }),
);

export const chaptersRelations = relations(Chapters, ({ one, many }) => ({
  parentChapter: one(Chapters, {
    fields: [Chapters.parentId],
    references: [Chapters.id],
    relationName: "parentChapterRelation",
  }),
  childChapters: many(Chapters, { relationName: "parentChapterRelation" }),
  memberships: many(ChapterMemberships),
  committees: many(Committees),
  titles: many(MemberTitles),
  media: many(ChapterMedia),
}));

export const chapterMembershipsRelations = relations(
  ChapterMemberships,
  ({ one }) => ({
    member: one(Members, {
      fields: [ChapterMemberships.memberId],
      references: [Members.id],
    }),
    chapter: one(Chapters, {
      fields: [ChapterMemberships.chapterId],
      references: [Chapters.id],
    }),
  }),
);

export const committeesRelations = relations(Committees, ({ one, many }) => ({
  chapter: one(Chapters, {
    fields: [Committees.chapterId],
    references: [Chapters.id],
  }),
  memberships: many(CommitteeMemberships),
  titles: many(MemberTitles),
  media: many(CommitteeMedia),
}));

export const committeeMembershipsRelations = relations(
  CommitteeMemberships,
  ({ one }) => ({
    member: one(Members, {
      fields: [CommitteeMemberships.memberId],
      references: [Members.id],
    }),
    committee: one(Committees, {
      fields: [CommitteeMemberships.committeeId],
      references: [Committees.id],
    }),
  }),
);

export const organizationsRelations = relations(Organizations, ({ many }) => ({
  contacts: many(OrganizationContacts),
}));

export const organizationContactsRelations = relations(
  OrganizationContacts,
  ({ one }) => ({
    organization: one(Organizations, {
      fields: [OrganizationContacts.organizationId],
      references: [Organizations.id],
    }),
    constituent: one(Constituents, {
      fields: [OrganizationContacts.constituentId],
      references: [Constituents.id],
    }),
  }),
);

export const chapterMediaRelations = relations(ChapterMedia, ({ one }) => ({
  chapter: one(Chapters, {
    fields: [ChapterMedia.chapterId],
    references: [Chapters.id],
  }),
  medium: one(Medium, {
    fields: [ChapterMedia.mediumId],
    references: [Medium.id],
  }),
}));

export const committeeMediaRelations = relations(CommitteeMedia, ({ one }) => ({
  committee: one(Committees, {
    fields: [CommitteeMedia.committeeId],
    references: [Committees.id],
  }),
  medium: one(Medium, {
    fields: [CommitteeMedia.mediumId],
    references: [Medium.id],
  }),
}));
