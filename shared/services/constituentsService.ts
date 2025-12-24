import { eq, and, lte, gte, isNull, or, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError, Profile } from "@/shared/types";
import {
  YPFConstituent,
  YPFConstituentDetail,
} from "@/features/api/v1/constituents/dtos";
import { generatePublicMediaUrl } from "@/shared/utils/files";

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
    profilePhoto,
    firstName: constituent.firstName,
    lastName: constituent.lastName,
    preferredName: constituent.preferredName ?? undefined,
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
 * Fetches all current committee memberships for a constituent.
 */
async function fetchCommittees(constituentId: string): Promise<
  {
    id: string;
    name: string;
    featuredPhotoUrl?: string;
    chapterName?: string;
  }[]
> {
  const db = dbClient.db;
  const now = new Date();

  const committeeRows = await db
    .select({
      id: schema.Committees.id,
      name: schema.Committees.name,
      chapterName: schema.Chapters.name,
    })
    .from(schema.Members)
    .innerJoin(
      schema.CommitteeMemberships,
      eq(schema.Members.id, schema.CommitteeMemberships.memberId),
    )
    .innerJoin(
      schema.Committees,
      eq(schema.CommitteeMemberships.committeeId, schema.Committees.id),
    )
    .leftJoin(
      schema.Chapters,
      eq(schema.Committees.chapterId, schema.Chapters.id),
    )
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        lte(schema.CommitteeMemberships.startedAt, now),
        or(
          isNull(schema.CommitteeMemberships.endedAt),
          gte(schema.CommitteeMemberships.endedAt, now),
        ),
      ),
    );

  // Fetch featured photos for committees
  const committeeIds = committeeRows.map((c) => c.id);
  const featuredPhotos = committeeIds.length
    ? await db
        .select({
          committeeId: schema.CommitteeMedia.committeeId,
          externalId: schema.Media.externalId,
        })
        .from(schema.CommitteeMedia)
        .innerJoin(
          schema.Media,
          eq(schema.CommitteeMedia.mediumId, schema.Media.id),
        )
        .where(
          and(
            eq(schema.CommitteeMedia.isFeatured, true),
            sql`${schema.CommitteeMedia.committeeId} = ANY(${committeeIds})`,
          ),
        )
    : [];

  const photoMap = new Map(
    featuredPhotos.map((p) => [p.committeeId, p.externalId]),
  );

  return committeeRows.map((c) => ({
    id: c.id,
    name: c.name,
    featuredPhotoUrl: photoMap.has(c.id)
      ? generatePublicMediaUrl(photoMap.get(c.id)!)
      : undefined,
    chapterName: c.chapterName ?? undefined,
  }));
}

/**
 * Fetches all current chapter memberships for a constituent.
 */
async function fetchChapters(
  constituentId: string,
): Promise<
  { id: string; name: string; country: string; featuredPhotoUrl?: string }[]
> {
  const db = dbClient.db;
  const now = new Date();

  const chapterRows = await db
    .select({
      id: schema.Chapters.id,
      name: schema.Chapters.name,
      country: schema.Chapters.country,
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
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        lte(schema.ChapterMemberships.startedAt, now),
        or(
          isNull(schema.ChapterMemberships.endedAt),
          gte(schema.ChapterMemberships.endedAt, now),
        ),
      ),
    );

  // Fetch featured photos for chapters
  const chapterIds = chapterRows.map((c) => c.id);
  const featuredPhotos = chapterIds.length
    ? await db
        .select({
          chapterId: schema.ChapterMedia.chapterId,
          externalId: schema.Media.externalId,
        })
        .from(schema.ChapterMedia)
        .innerJoin(
          schema.Media,
          eq(schema.ChapterMedia.mediumId, schema.Media.id),
        )
        .where(
          and(
            eq(schema.ChapterMedia.isFeatured, true),
            sql`${schema.ChapterMedia.chapterId} = ANY(${chapterIds})`,
          ),
        )
    : [];

  const photoMap = new Map(
    featuredPhotos.map((p) => [p.chapterId, p.externalId]),
  );

  return chapterRows.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    featuredPhotoUrl: photoMap.has(c.id)
      ? generatePublicMediaUrl(photoMap.get(c.id)!)
      : undefined,
  }));
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
      `${constituent.firstName} ${constituent.firstName}`,
    profiles: profilePeriods.map((p) => p.name),
    roles: roles.map((r) => r.title),
    isActive: true,
    createdAt: constituent.createdAt,
  };
}
