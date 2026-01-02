import {
  pgSchema,
  uuid,
  timestamp,
  text,
  boolean,
  date,
  unique,
  integer,
  AnyPgColumn,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const core = pgSchema("core");

export const GenderEnum = core.enum("gender", ["MALE", "FEMALE", "OTHER"]);
export const MediumTypeEnum = core.enum("media_type", ["PICTURE", "VIDEO"]);
export const DocumentTypeEnum = core.enum("document_type", [
  "PDF",
  "DOC",
  "SPREADSHEET",
  "PRESENTATION",
  "IMAGE",
  "OTHER",
]);
export const NationalIdTypeEnum = core.enum("national_id_type", [
  "ECOWASIDCARD",
]);
export const MembershipApplicationStatusEnum = core.enum("application_status", [
  "DRAFT",
  "PENDING",
  "REJECTED",
  "REJECTED",
  "ACCEPTED",
]);

export const VolunteerApplicationStatusEnum = core.enum(
  "volunteer_application_status",
  ["PENDING", "ACCEPTED", "DECLINED"]
);

// === TABLES ===

export const Media = core.table("media", {
  id: uuid().defaultRandom().primaryKey(),
  externalId: text("external_id").notNull().unique(),
  type: MediumTypeEnum().notNull(),
  width: integer().notNull(),
  height: integer().notNull(),
  size: integer().notNull(),
  uploadedBy: uuid("uploaded_by").references(
    (): AnyPgColumn => Constituents.id,
    { onDelete: "set null" }
  ),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const Documents = core.table("documents", {
  id: uuid().defaultRandom().primaryKey(),
  externalId: text("external_id").notNull().unique(),
  type: DocumentTypeEnum().notNull(),
  size: integer().notNull(),
  uploadedBy: uuid("uploaded_by").references(
    (): AnyPgColumn => Constituents.id,
    { onDelete: "set null" }
  ),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const Constituents = core.table("constituents", {
  id: uuid().defaultRandom().primaryKey(),
  publicId: text("public_id")
    .default(sql`generate_public_id('YPFC-', 12)`)
    .unique()
    .notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredName: text("preferred_name"),

  // Contact Info (Flattened)
  email: text("email").unique(),
  phone: text("phone").unique(),
  whatsapp: text("whatsapp").unique(), // whatsapp number
  orgEmail: text("org_email").unique(),

  linkedinProfile: text("linkedin_profile"),
  twitterHandle: text("twitter_handle"),

  // Profile Fields
  profilePhotoId: uuid("profile_photo_id").references(() => Media.id, {
    onDelete: "set null",
  }),
  salutation: text(),
  dateOfBirth: date("date_of_birth", { mode: "date" }),
  gender: GenderEnum(),
  occupation: text(),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  campus: text("campus"),
  nationalIdType: NationalIdTypeEnum("national_id_type"),
  nationalIdDocumentId: uuid("national_id_document_id").references(
    () => Documents.id
  ),

  // missionPillars: text("mission_pillars").array(),

  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  skills: text("skills").array(),
  previousVolunteerExperience: text("previous_volunteer_experience"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const MembershipApplications = core.table("membership_applications", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  status: MembershipApplicationStatusEnum().notNull().default("PENDING"),
  declinedReason: text("declined_reason"),
  approvedBy: uuid("approved_by").references(() => Admins.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  // Application specific preferences
  // willingToServe: text("willing_to_serve"), I mean, this will implicitly be yes or true
  commitmentStatement: text("commitment_statement"),
  preferredChapterId: uuid("preferred_chapter_id").references(
    () => Chapters.id
  ),
  preferredCommitteeId: uuid("preferred_committee_id").references(
    () => Committees.id
  ),

  // Document Refs
  cvDocumentId: uuid("cv_document_id").references(() => Documents.id),

  referralSource: text("referral_source"),
  // referralOther: text("referral_other"),

  trackingNumber: text("tracking_number")
    .default(sql`generate_public_id('', 12)`)
    .notNull()
    .unique(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const VolunteerApplications = core.table("volunteer_applications", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  status: VolunteerApplicationStatusEnum().notNull().default("PENDING"),
  reason: text("reason"), // Motivation/Reason for applying
  notes: text(), // Internal admin notes

  trackingNumber: text("tracking_number")
    .default(sql`generate_public_id('', 12)`)
    .notNull()
    .unique(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ensure non overlapping periods of membership at dbms level
export const Members = core.table("members", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
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

// ensure non overlapping periods of board membership at dbms level
export const Directors = core.table("directors", {
  id: uuid().defaultRandom().primaryKey(),
  constituentId: uuid("constituent_id")
    .notNull()
    .references(() => Constituents.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});
// ensure that (title, alias) pairs are consistent. Same title should guarantee same alias and vice versa
export const MemberTitles = core.table(
  "member_titles",
  {
    id: uuid().defaultRandom().primaryKey(),
    title: text().notNull(), // for full displayable name
    alias: text().notNull(), // short alias for access control
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
      sql`num_nonnulls(${table.chapterId}, ${table.committeeId}) <= 1`
    ),
    unique().on(table.title, table.chapterId, table.committeeId),
  ]
);

// add constraint at dbms level for non overlapping (memberId, titleId) assignments
export const MemberTitlesAssignments = core.table("member_titles_assignments", {
  id: uuid().defaultRandom().primaryKey(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => Members.id, { onDelete: "cascade" }),
  titleId: uuid("title_id")
    .notNull()
    .references(() => MemberTitles.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const AdminRoles = core.enum("admin_roles", [
  "SUPER_ADMIN",
  "REGULAR_ADMIN",
]);

export const AdminRolesAssignments = core.table("admin_roles_assignments", {
  id: uuid().defaultRandom().primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => Admins.id, { onDelete: "cascade" }),
  role: AdminRoles().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const Chapters = core.table("chapters", {
  id: uuid().defaultRandom().primaryKey(),
  name: text().notNull(),
  country: text().notNull(),
  description: text(),
  foundingDate: date("founding_date", { mode: "date" }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  parentId: uuid("parent_id").references((): AnyPgColumn => Chapters.id, {
    onDelete: "set null",
  }),
});

// add constraint at dbms level for non overlapping (memberId, chapterId) assignment duration
export const ChapterMemberships = core.table("chapter_memberships", {
  id: uuid().defaultRandom().primaryKey(),
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
  id: uuid().defaultRandom().primaryKey(),
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
  (table) => [unique().on(table.organizationId, table.constituentId)]
);

export const ChapterMedia = core.table("chapter_media", {
  id: uuid().defaultRandom().primaryKey(),
  chapterId: uuid("chapter_id").references(() => Chapters.id, {
    onDelete: "cascade",
  }),
  mediumId: uuid("medium_id").references(() => Media.id, {
    onDelete: "cascade",
  }),
  caption: text(),
  isFeatured: boolean("is_featured").notNull().default(false),
});

export const CommitteeMedia = core.table("committee_media", {
  id: uuid().defaultRandom().primaryKey(),
  committeeId: uuid("committee_id").references(() => Committees.id, {
    onDelete: "cascade",
  }),
  mediumId: uuid("medium_id").references(() => Media.id, {
    onDelete: "cascade",
  }),
  caption: text(),
  isFeatured: boolean("is_featured").notNull().default(false),
});

// === RELATIONS ===

export const mediaRelations = relations(Media, ({ one }) => ({
  uploader: one(Constituents, {
    fields: [Media.uploadedBy],
    references: [Constituents.id],
    relationName: "mediaUploader",
  }),
}));

export const constituentsRelations = relations(
  Constituents,
  ({ one, many }) => ({
    // A Constituent can have MANY historical periods for these roles (One-to-Many)
    membershipPeriods: many(Members),
    volunteerPeriods: many(Volunteers),
    auditorPeriods: many(Auditors),
    adminPeriods: many(Admins),

    // Standard relations for other entities
    profilePhoto: one(Media, {
      fields: [Constituents.profilePhotoId],
      references: [Media.id],
    }),
    organizationContacts: many(OrganizationContacts),
  })
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
  })
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
  })
);

export const adminRolesAssignmentsRelations = relations(
  AdminRolesAssignments,
  ({ one }) => ({
    admin: one(Admins, {
      fields: [AdminRolesAssignments.adminId],
      references: [Admins.id],
    }),
  })
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
  })
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
  })
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
  })
);

export const chapterMediaRelations = relations(ChapterMedia, ({ one }) => ({
  chapter: one(Chapters, {
    fields: [ChapterMedia.chapterId],
    references: [Chapters.id],
  }),
  medium: one(Media, {
    fields: [ChapterMedia.mediumId],
    references: [Media.id],
  }),
}));

export const committeeMediaRelations = relations(CommitteeMedia, ({ one }) => ({
  committee: one(Committees, {
    fields: [CommitteeMedia.committeeId],
    references: [Committees.id],
  }),
  medium: one(Media, {
    fields: [CommitteeMedia.mediumId],
    references: [Media.id],
  }),
}));
