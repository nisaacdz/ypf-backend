import { eq, and, lte, gte, isNull, or, sql, count, ilike } from "drizzle-orm";
import z from "zod";
import dbClient from "@/configs/db";
import logger from "@/configs/logger";
import schema from "@/db/schema";
import { ApiError, Profile } from "@/shared/types";
import {
  YPFConstituent,
  YPFConstituentDetail,
} from "@/features/api/v1/constituents/dtos";
import { generatePublicMediaUrl } from "@/shared/utils/files";
import { Paginated } from "@/shared/dtos";
import { GetConstituentsQuerySchema } from "@/features/api/v1/constituents/schemas";
import { InviteConstituentSchema } from "@/features/api/v1/constituents/schemas";
import * as membersService from "@/shared/services/membersService";
import * as chaptersService from "@/shared/services/chaptersService";

interface ProfilePeriod {
  name: Profile;
  startedAt: Date;
  endedAt?: Date;
}

interface RolePeriod {
  profile: Profile;
  title: string;
  startedAt: Date;
  endedAt?: Date;
}

/**
 * Fetches detailed constituent information including profiles, roles, committees, and chapters.
 *
 * @param constituentId The ID of the constituent.
 * @returns A promise that resolves to the full YPFConstituentDetail object.
 * @throws ApiError if constituent is not found.
 */
export async function getDetailedConstituent(
  constituentId: string,
): Promise<YPFConstituentDetail | null> {
  // Fetch the constituent with profile photo
  const constituent = await dbClient.db.query.Constituents.findFirst({
    where: eq(schema.Constituents.id, constituentId),
    columns: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      email: true,
      phone: true,
      whatsapp: true,
      occupation: true,
      skills: true,
      country: true,
      region: true,
      city: true,
      campus: true,
      linkedinProfile: true,
      twitterHandle: true,
      previousVolunteerExperience: true,
    },
    with: {
      profilePhoto: true,
    },
  });

  if (!constituent) {
    return null;
  }

  // Fetch all profile periods, roles, committees, and chapters in parallel
  const [profilePeriods, roles, committees, chapters] = await Promise.all([
    fetchProfilePeriods(constituentId),
    fetchRoles(constituentId),
    fetchCommittees(constituentId),
    fetchChapters(constituentId),
  ]);

  // Build the Medium object for profile photo
  const profilePhoto = constituent.profilePhoto
    ? {
        url: generatePublicMediaUrl(constituent.profilePhoto.externalId),
        type: constituent.profilePhoto.type,
        dimensions: {
          width: constituent.profilePhoto.width,
          height: constituent.profilePhoto.height,
        },
        size: constituent.profilePhoto.size,
        uploadedAt: constituent.profilePhoto.uploadedAt,
      }
    : undefined;

  return {
    id: constituent.id,
    publicId: constituent.publicId,
    profilePhoto,
    firstName: constituent.firstName,
    lastName: constituent.lastName,
    preferredName: constituent.preferredName ?? undefined,
    email: constituent.email ?? undefined,
    phone: constituent.phone ?? undefined,
    whatsapp: constituent.whatsapp ?? undefined,
    occupation: constituent.occupation ?? undefined,
    skills: constituent.skills ?? undefined,
    country: constituent.country ?? undefined,
    region: constituent.region ?? undefined,
    city: constituent.city ?? undefined,
    campus: constituent.campus ?? undefined,
    linkedinProfile: constituent.linkedinProfile ?? undefined,
    twitterHandle: constituent.twitterHandle ?? undefined,
    previousVolunteerExperience:
      constituent.previousVolunteerExperience ?? undefined,
    profiles: profilePeriods,
    roles,
    committees,
    chapters,
  };
}

/**
 * Fetches all profile periods (MEMBER, ADMIN, VOLUNTEER, AUDITOR, DIRECTOR) for a constituent.
 */
async function fetchProfilePeriods(
  constituentId: string,
): Promise<ProfilePeriod[]> {
  const db = dbClient.db;
  const profiles: ProfilePeriod[] = [];

  // Fetch all periods from each profile table
  const [
    memberPeriods,
    adminPeriods,
    volunteerPeriods,
    auditorPeriods,
    directorPeriods,
  ] = await Promise.all([
    db
      .select({
        startedAt: schema.Members.startedAt,
        endedAt: schema.Members.endedAt,
      })
      .from(schema.Members)
      .where(eq(schema.Members.constituentId, constituentId)),
    db
      .select({
        startedAt: schema.Admins.startedAt,
        endedAt: schema.Admins.endedAt,
      })
      .from(schema.Admins)
      .where(eq(schema.Admins.constituentId, constituentId)),
    db
      .select({
        startedAt: schema.Volunteers.startedAt,
        endedAt: schema.Volunteers.endedAt,
      })
      .from(schema.Volunteers)
      .where(eq(schema.Volunteers.constituentId, constituentId)),
    db
      .select({
        startedAt: schema.Auditors.startedAt,
        endedAt: schema.Auditors.endedAt,
      })
      .from(schema.Auditors)
      .where(eq(schema.Auditors.constituentId, constituentId)),
    db
      .select({
        startedAt: schema.Directors.startedAt,
        endedAt: schema.Directors.endedAt,
      })
      .from(schema.Directors)
      .where(eq(schema.Directors.constituentId, constituentId)),
  ]);

  memberPeriods.forEach((p) =>
    profiles.push({
      name: "MEMBER",
      startedAt: p.startedAt,
      endedAt: p.endedAt ?? undefined,
    }),
  );
  adminPeriods.forEach((p) =>
    profiles.push({
      name: "ADMIN",
      startedAt: p.startedAt,
      endedAt: p.endedAt ?? undefined,
    }),
  );
  volunteerPeriods.forEach((p) =>
    profiles.push({
      name: "VOLUNTEER",
      startedAt: p.startedAt,
      endedAt: p.endedAt ?? undefined,
    }),
  );
  auditorPeriods.forEach((p) =>
    profiles.push({
      name: "AUDITOR",
      startedAt: p.startedAt,
      endedAt: p.endedAt ?? undefined,
    }),
  );
  directorPeriods.forEach((p) =>
    profiles.push({
      name: "DIRECTOR",
      startedAt: p.startedAt,
      endedAt: p.endedAt ?? undefined,
    }),
  );

  return profiles;
}

/**
 * Fetches all role assignments for a constituent.
 */
async function fetchRoles(constituentId: string): Promise<RolePeriod[]> {
  const db = dbClient.db;

  const titleAssignments = await db
    .select({
      title: schema.MemberTitles.title,
      startedAt: schema.MemberTitlesAssignments.startedAt,
      endedAt: schema.MemberTitlesAssignments.endedAt,
    })
    .from(schema.Members)
    .innerJoin(
      schema.MemberTitlesAssignments,
      eq(schema.Members.id, schema.MemberTitlesAssignments.memberId),
    )
    .innerJoin(
      schema.MemberTitles,
      eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
    )
    .where(eq(schema.Members.constituentId, constituentId));

  return titleAssignments.map((t) => ({
    profile: "MEMBER" as Profile,
    title: t.title,
    startedAt: t.startedAt,
    endedAt: t.endedAt ?? undefined,
  }));
}

/**
 * Fetches all current committee involvements for a constituent.
 *
 * Source of truth is `MemberTitlesAssignments` joined through `MemberTitles`
 * scoped to a committee — every committee involvement (chair OR member) has
 * a title assignment, so this captures both. Each returned row includes the
 * committee's stable `alias` and the user's `titleAlias` so the frontend can
 * route to `/dashboard/workspaces/<alias>` and gate UI on `committeechair`
 * vs `committeemember`.
 */
async function fetchCommittees(constituentId: string) {
  const db = dbClient.db;
  const now = new Date();

  const rows = await db
    .select({
      id: schema.Committees.id,
      name: schema.Committees.name,
      alias: schema.Committees.alias,
      titleAlias: schema.MemberTitles.alias,
      chapterName: schema.Chapters.name,
      photoExternalId: schema.Media.externalId,
    })
    .from(schema.Members)
    .innerJoin(
      schema.MemberTitlesAssignments,
      eq(schema.Members.id, schema.MemberTitlesAssignments.memberId),
    )
    .innerJoin(
      schema.MemberTitles,
      eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
    )
    .innerJoin(
      schema.Committees,
      eq(schema.MemberTitles.committeeId, schema.Committees.id),
    )
    .leftJoin(
      schema.Chapters,
      eq(schema.Committees.chapterId, schema.Chapters.id),
    )
    .leftJoin(
      schema.CommitteeMedia,
      and(
        eq(schema.CommitteeMedia.committeeId, schema.Committees.id),
        eq(schema.CommitteeMedia.isFeatured, true),
      ),
    )
    .leftJoin(
      schema.Media,
      eq(schema.CommitteeMedia.mediumId, schema.Media.id),
    )
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        lte(schema.Members.startedAt, now),
        or(
          isNull(schema.Members.endedAt),
          gte(schema.Members.endedAt, now),
        ),
        lte(schema.MemberTitlesAssignments.startedAt, now),
        or(
          isNull(schema.MemberTitlesAssignments.endedAt),
          gte(schema.MemberTitlesAssignments.endedAt, now),
        ),
      ),
    );

  // Dedupe by (committeeId, titleAlias) — same person could have multiple
  // assignments to the same title across overlapping periods (shouldn't, but
  // the DB-level exclusion constraint covers a different shape).
  const seen = new Map<
    string,
    {
      id: string;
      name: string;
      alias?: string;
      titleAlias?: string;
      chapterName?: string;
      featuredPhotoUrl?: string;
    }
  >();
  for (const row of rows) {
    const key = `${row.id}::${row.titleAlias}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      id: row.id,
      name: row.name,
      alias: row.alias ?? undefined,
      titleAlias: row.titleAlias ?? undefined,
      chapterName: row.chapterName ?? undefined,
      featuredPhotoUrl: row.photoExternalId
        ? generatePublicMediaUrl(row.photoExternalId)
        : undefined,
    });
  }
  return Array.from(seen.values());
}

/**
 * Fetches all current chapter memberships for a constituent.
 */
async function fetchChapters(constituentId: string) {
  const db = dbClient.db;
  const now = new Date();

  return await db
    .select({
      id: schema.Chapters.id,
      name: schema.Chapters.name,
      country: schema.Chapters.country,
      photoExternalId: schema.Media.externalId,
    })
    .from(schema.Members)
    .innerJoin(
      schema.ChapterMemberships,
      eq(schema.Members.id, schema.ChapterMemberships.memberId),
    )
    .innerJoin(
      schema.Chapters,
      eq(schema.ChapterMemberships.chapterId, schema.Chapters.id),
    )
    // Direct join to media
    .leftJoin(
      schema.ChapterMedia,
      and(
        eq(schema.ChapterMedia.chapterId, schema.Chapters.id),
        eq(schema.ChapterMedia.isFeatured, true),
      ),
    )
    .leftJoin(schema.Media, eq(schema.ChapterMedia.mediumId, schema.Media.id))
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        lte(schema.ChapterMemberships.startedAt, now),
        or(
          isNull(schema.ChapterMemberships.endedAt),
          gte(schema.ChapterMemberships.endedAt, now),
        ),
      ),
    )
    .then((rows) =>
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        country: c.country,
        featuredPhotoUrl: c.photoExternalId
          ? generatePublicMediaUrl(c.photoExternalId)
          : undefined,
      })),
    );
}

export async function getConstituent(
  constituentId: string,
): Promise<YPFConstituent | null> {
  // Fetch the constituent with profile photo
  const constituent = await dbClient.db.query.Constituents.findFirst({
    where: eq(schema.Constituents.id, constituentId),
    with: {
      profilePhoto: true,
    },
  });

  if (!constituent) {
    return null;
  }

  // Fetch all profile periods, roles, committees, and chapters in parallel
  const [profilePeriods, roles] = await Promise.all([
    fetchProfilePeriods(constituentId),
    fetchRoles(constituentId),
  ]);

  // Build the Medium object for profile photo
  const profilePhotoUrl = constituent.profilePhoto
    ? generatePublicMediaUrl(constituent.profilePhoto.externalId)
    : undefined;

  return {
    id: constituent.id,
    profilePhotoUrl,
    fullName:
      constituent.preferredName ??
      `${constituent.firstName} ${constituent.lastName}`,
    profiles: profilePeriods.map((p) => p.name),
    roles: roles.map((r) => r.title),
    isActive: true,
    createdAt: constituent.createdAt,
  };
}

/**
 * Gets a paginated list of all constituents.
 */
export async function getConstituents(
  query: z.infer<typeof GetConstituentsQuerySchema>,
): Promise<Paginated<YPFConstituent>> {
  const { page = 1, pageSize = 20, search } = query;
  const offset = (page - 1) * pageSize;

  // Build where clauses
  const whereClauses = [];
  if (search) {
    const fullName = sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`;
    whereClauses.push(ilike(fullName, `%${search}%`));
  }

  // Get total count
  const [totalResult] = await dbClient.db
    .select({ total: count() })
    .from(schema.Constituents)
    .where(and(...whereClauses));

  const total = totalResult?.total ?? 0;

  // Get paginated constituents
  const constituents = await dbClient.db
    .select({
      id: schema.Constituents.id,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      preferredName: schema.Constituents.preferredName,
      createdAt: schema.Constituents.createdAt,
      profilePhotoExternalId: schema.Media.externalId,
    })
    .from(schema.Constituents)
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id),
    )
    .where(and(...whereClauses))
    .limit(pageSize)
    .offset(offset)
    .orderBy(schema.Constituents.createdAt);

  const items: YPFConstituent[] = constituents.map((c) => ({
    id: c.id,
    fullName: c.preferredName ?? `${c.firstName} ${c.lastName}`,
    profilePhotoUrl: c.profilePhotoExternalId
      ? generatePublicMediaUrl(c.profilePhotoExternalId, { resolution: 360 })
      : undefined,
    profiles: [], // Would need additional queries for full population
    roles: [],
    isActive: true,
    createdAt: c.createdAt,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Onboards a single constituent by creating a User record and sending an invitation email.
 *
 * @param constituentId The ID of the constituent to onboard
 * @param dashboardUrl Base URL for the dashboard
 * @throws Error if constituent not found, has no email, or is already onboarded
 */
export async function onboardConstituent(
  constituentId: string,
  dashboardUrl: string,
): Promise<{ id: string }> {
  const { sendOnboardingInvitationEmail } = await import(
    "@/shared/utils/email"
  );

  const constituent = await dbClient.db.query.Constituents.findFirst({
    where: eq(schema.Constituents.id, constituentId),
    columns: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      publicId: true,
    },
  });

  if (!constituent) {
    throw new Error("Constituent not found");
  }

  if (!constituent.email) {
    throw new Error("Constituent does not have an email address");
  }

  const existingUser = await dbClient.db.query.Users.findFirst({
    where: eq(schema.Users.constituentId, constituentId),
    columns: {
      id: true,
      password: true,
      googleId: true,
      appleId: true,
      facebookId: true,
    },
  });

  if (existingUser) {
    const hasAuthMethod = Boolean(
      existingUser.password ||
        existingUser.googleId ||
        existingUser.appleId ||
        existingUser.facebookId,
    );
    if (hasAuthMethod) return { id: existingUser.id };

    const name =
      constituent.preferredName ??
      `${constituent.firstName} ${constituent.lastName}`;
    const onboardingUrl = `${dashboardUrl}/auth/onboard?user=${encodeURIComponent(
      constituent.publicId,
    )}`;

    sendOnboardingInvitationEmail({
      email: constituent.email,
      name,
      onboardingUrl,
    }).catch((error) => {
      logger.error(error, "Failed to send onboarding invitation email");
    });

    return { id: existingUser.id };
  }

  const [newUser] = await dbClient.db
    .insert(schema.Users)
    .values({
      email: constituent.email,
      username: constituent.email,
      constituentId: constituent.id,
    })
    .onConflictDoNothing({ target: schema.Users.constituentId })
    .returning({ id: schema.Users.id });

  if (!newUser) {
    throw new Error("User has already been onboarded");
  }

  const name =
    constituent.preferredName ??
    `${constituent.firstName} ${constituent.lastName}`;

  const onboardingUrl = `${dashboardUrl}/auth/onboard?user=${encodeURIComponent(
    constituent.publicId,
  )}`;

  sendOnboardingInvitationEmail({
    email: constituent.email,
    name,
    onboardingUrl,
  }).catch((error) => {
    logger.error(error, "Failed to send onboarding invitation email");
  });

  return newUser;
}

export async function inviteConstituent(
  input: z.infer<typeof InviteConstituentSchema>,
  dashboardUrl: string,
): Promise<{ constituentId: string; userId: string }> {
  const email = input.email.trim().toLowerCase();

  const existingConstituent = await dbClient.db.query.Constituents.findFirst({
    where: eq(schema.Constituents.email, email),
    columns: { id: true },
  });

  if (existingConstituent) {
    throw new ApiError("A constituent with this email already exists", 409);
  }

  const [constituent] = await dbClient.db
    .insert(schema.Constituents)
    .values({
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      preferredName: input.preferredName?.trim() || null,
      email,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      country: input.country?.trim() || null,
      region: input.region?.trim() || null,
      city: input.city?.trim() || null,
      campus: input.campus?.trim() || null,
      occupation: input.occupation?.trim() || null,
    })
    .returning({ id: schema.Constituents.id });

  await membersService.enrollGlobal(constituent.id);

  if (input.chapterId) {
    await chaptersService.enrollToChapter(input.chapterId, constituent.id);
  }

  const user = await onboardConstituent(constituent.id, dashboardUrl);

  return {
    constituentId: constituent.id,
    userId: user.id,
  };
}

export async function updateConstituent(
  constituentId: string,
  updates: Partial<{
    firstName: string;
    lastName: string;
    preferredName: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    campus: string | null;
    occupation: string | null;
    linkedinProfile: string | null;
    twitterHandle: string | null;
    skills: string[];
    previousVolunteerExperience: string | null;
  }>,
): Promise<string> {
  const [updated] = await dbClient.db
    .update(schema.Constituents)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(schema.Constituents.id, constituentId))
    .returning({ id: schema.Constituents.id });

  if (!updated) {
    throw new Error("Constituent not found");
  }

  if (updates.email) {
    await dbClient.db
      .update(schema.Users)
      .set({ email: updates.email, username: updates.email, updatedAt: new Date() })
      .where(eq(schema.Users.constituentId, constituentId));
  }

  return updated.id;
}

export async function updateConstituentProfilePhoto(
  constituentId: string,
  profilePhotoId: string,
): Promise<void> {
  const [updated] = await dbClient.db
    .update(schema.Constituents)
    .set({
      profilePhotoId,
      updatedAt: new Date(),
    })
    .where(eq(schema.Constituents.id, constituentId))
    .returning({ id: schema.Constituents.id });

  if (!updated) {
    throw new Error("Constituent not found");
  }
}
