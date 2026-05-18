import {
  sql,
  and,
  eq,
  count,
  ilike,
  isNull,
  desc,
  lte,
  gte,
  or,
} from "drizzle-orm";
import z from "zod";

import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { Paginated } from "@/shared/dtos";
import { YPFChapter, YPFChapterDetail } from "@/features/api/v1/chapters/dtos";
import {
  CreateChapterSchema,
  GetChaptersQuerySchema,
  GetConstituentChaptersQuerySchema,
  UpdateChapterSchema,
} from "@/features/api/v1/chapters/schemas";
import { YPFMember } from "@/features/api/v1/members/dtos";
import * as mediaUtils from "@/shared/utils/files";
import logger from "@/configs/logger";
import { ApiError } from "@/shared/types";

export async function getChapters(
  query: z.infer<typeof GetChaptersQuerySchema>,
): Promise<Paginated<YPFChapter>> {
  const { page, pageSize, search } = query;

  // --- SUBQUERY FOR MEMBER COUNT ---
  const memberCountSubquery = dbClient.db
    .select({
      chapterId: schema.ChapterMemberships.chapterId,
      memberCount:
        sql<number>`COUNT(DISTINCT ${schema.Members.constituentId})`.as(
          "member_count",
        ),
    })
    .from(schema.ChapterMemberships)
    .innerJoin(
      schema.Members,
      eq(schema.ChapterMemberships.memberId, schema.Members.id),
    )
    .where(
      and(
        sql`${schema.ChapterMemberships.startedAt} <= now()`,
        sql`(${schema.ChapterMemberships.endedAt} IS NULL OR ${schema.ChapterMemberships.endedAt} >= now())`,
      ),
    )
    .groupBy(schema.ChapterMemberships.chapterId)
    .as("member_counts");

  // --- SUBQUERY FOR FEATURED PHOTO ---
  const featuredPhotoSubquery = dbClient.db
    .select({
      chapterId: schema.ChapterMedia.chapterId,
      externalId: schema.Media.externalId,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.ChapterMedia.chapterId} ORDER BY ${schema.Media.uploadedAt} DESC)`.as(
        "photo_rn",
      ),
    })
    .from(schema.ChapterMedia)
    .innerJoin(schema.Media, eq(schema.ChapterMedia.mediumId, schema.Media.id))
    .where(
      and(
        eq(schema.ChapterMedia.isFeatured, true),
        eq(schema.Media.type, "PICTURE"),
      ),
    )
    .as("featured_photos");

  // --- DYNAMIC FILTERS ---
  const whereClauses = [isNull(schema.Chapters.archivedAt)];

  if (search) {
    whereClauses.push(ilike(schema.Chapters.name, `%${search}%`));
  }

  // --- BASE QUERY ---
  const baseQuery = dbClient.db
    .select({
      id: schema.Chapters.id,
      name: schema.Chapters.name,
      country: schema.Chapters.country,
      featuredPhotoExternalId: featuredPhotoSubquery.externalId,
      memberCount: memberCountSubquery.memberCount,
      foundingDate: schema.Chapters.foundingDate,
    })
    .from(schema.Chapters)
    .leftJoin(
      memberCountSubquery,
      eq(schema.Chapters.id, memberCountSubquery.chapterId),
    )
    .leftJoin(
      featuredPhotoSubquery,
      and(
        eq(schema.Chapters.id, featuredPhotoSubquery.chapterId),
        eq(featuredPhotoSubquery.rn, 1),
      ),
    )
    .where(and(...whereClauses));

  // --- QUERY EXECUTION ---
  const [totalResult, dbChapters] = await Promise.all([
    dbClient.db.select({ total: count() }).from(baseQuery.as("sub")),
    baseQuery.limit(pageSize).offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.total ?? 0;

  // --- DATA MAPPING ---
  const items: YPFChapter[] = dbChapters.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    featuredPhotoUrl: c.featuredPhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(c.featuredPhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    memberCount: c.memberCount ?? 0,
    foundingDate: c.foundingDate,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

export async function getChapterById(
  chapterId: string,
): Promise<YPFChapterDetail> {
  const [chapter] = await dbClient.db
    .select({
      id: schema.Chapters.id,
      name: schema.Chapters.name,
      country: schema.Chapters.country,
      description: schema.Chapters.description,
      foundingDate: schema.Chapters.foundingDate,
      archivedAt: schema.Chapters.archivedAt,
      parentChapterId: schema.Chapters.parentId,
    })
    .from(schema.Chapters)
    .where(eq(schema.Chapters.id, chapterId));

  if (!chapter) {
    throw new ApiError("Chapter not found", 404);
  }

  const [featuredMedia, parentChapter] = await Promise.all([
    dbClient.db
      .select({
        caption: schema.ChapterMedia.caption,
        mediumExternalId: schema.Media.externalId,
        mediumType: schema.Media.type,
        mediumWidth: schema.Media.width,
        mediumHeight: schema.Media.height,
        mediumSize: schema.Media.size,
        mediumUploadedAt: schema.Media.uploadedAt,
        mediumUploadedBy:
          sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`.as(
            "uploader_name",
          ),
      })
      .from(schema.ChapterMedia)
      .innerJoin(
        schema.Media,
        eq(schema.ChapterMedia.mediumId, schema.Media.id),
      )
      .leftJoin(
        schema.Constituents,
        eq(schema.Media.uploadedBy, schema.Constituents.id),
      )
      .where(
        and(
          eq(schema.ChapterMedia.chapterId, chapterId),
          eq(schema.ChapterMedia.isFeatured, true),
        ),
      )
      .orderBy(desc(schema.Media.uploadedAt))
      .limit(5),
    chapter.parentChapterId
      ? dbClient.db
          .select({
            id: schema.Chapters.id,
            name: schema.Chapters.name,
          })
          .from(schema.Chapters)
          .where(eq(schema.Chapters.id, chapter.parentChapterId))
          .then((rows) => rows[0])
      : Promise.resolve(undefined),
  ]);

  const detailedChapter: YPFChapterDetail = {
    id: chapter.id,
    name: chapter.name,
    country: chapter.country,
    description: chapter.description ?? undefined,
    foundingDate: chapter.foundingDate,
    featuredMedia: featuredMedia.map((m) => ({
      caption: m.caption ?? undefined,
      medium: {
        url: mediaUtils.generatePublicMediaUrl(m.mediumExternalId, {
          resolution: 720,
        }),
        type: m.mediumType,
        dimensions: {
          width: m.mediumWidth,
          height: m.mediumHeight,
        },
        size: m.mediumSize,
        uploadedAt: m.mediumUploadedAt,
        uploadedBy: m.mediumUploadedBy ?? undefined,
      },
    })),
    isActive: chapter.archivedAt === null,
    parentChapter: parentChapter
      ? {
          id: parentChapter.id,
          name: parentChapter.name,
        }
      : undefined,
  };

  return detailedChapter;
}

export async function createChapter(
  input: z.infer<typeof CreateChapterSchema>,
): Promise<{ id: string }> {
  const [chapter] = await dbClient.db
    .insert(schema.Chapters)
    .values({
      name: input.name,
      country: input.country,
      description: input.description,
      foundingDate: input.foundingDate,
      parentId: input.parentId,
    })
    .returning({ id: schema.Chapters.id });

  return chapter;
}

export async function updateChapter(
  chapterId: string,
  updates: z.infer<typeof UpdateChapterSchema>,
): Promise<{ id: string }> {
  const [updatedChapter] = await dbClient.db
    .update(schema.Chapters)
    .set(updates)
    .where(eq(schema.Chapters.id, chapterId))
    .returning({ id: schema.Chapters.id });

  if (!updatedChapter) {
    throw new ApiError("Chapter not found", 404);
  }

  return updatedChapter;
}

export async function archiveChapter(chapterId: string): Promise<void> {
  const [chapter] = await dbClient.db
    .update(schema.Chapters)
    .set({ archivedAt: new Date() })
    .where(eq(schema.Chapters.id, chapterId))
    .returning({ id: schema.Chapters.id });

  if (!chapter) {
    throw new ApiError("Chapter not found", 404);
  }
}

export async function getChaptersByConstituentId(
  constituentId: string,
  query: z.infer<typeof GetConstituentChaptersQuerySchema>,
): Promise<Paginated<YPFChapter>> {
  const { page, pageSize } = query;

  // --- SUBQUERY FOR MEMBER ID ---
  // First get the member record(s) for this constituent
  const memberSubquery = dbClient.db
    .select({
      memberId: schema.Members.id,
    })
    .from(schema.Members)
    .where(eq(schema.Members.constituentId, constituentId))
    .as("member_sub");

  // --- SUBQUERY FOR MEMBER COUNT ---
  const memberCountSubquery = dbClient.db
    .select({
      chapterId: schema.ChapterMemberships.chapterId,
      memberCount:
        sql<number>`COUNT(DISTINCT ${schema.Members.constituentId})`.as(
          "member_count",
        ),
    })
    .from(schema.ChapterMemberships)
    .innerJoin(
      schema.Members,
      eq(schema.ChapterMemberships.memberId, schema.Members.id),
    )
    .where(
      and(
        sql`${schema.ChapterMemberships.startedAt} <= now()`,
        sql`(${schema.ChapterMemberships.endedAt} IS NULL OR ${schema.ChapterMemberships.endedAt} >= now())`,
      ),
    )
    .groupBy(schema.ChapterMemberships.chapterId)
    .as("member_counts");

  // --- SUBQUERY FOR FEATURED PHOTO ---
  const featuredPhotoSubquery = dbClient.db
    .select({
      chapterId: schema.ChapterMedia.chapterId,
      externalId: schema.Media.externalId,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.ChapterMedia.chapterId} ORDER BY ${schema.Media.uploadedAt} DESC)`.as(
        "photo_rn",
      ),
    })
    .from(schema.ChapterMedia)
    .innerJoin(schema.Media, eq(schema.ChapterMedia.mediumId, schema.Media.id))
    .where(
      and(
        eq(schema.ChapterMedia.isFeatured, true),
        eq(schema.Media.type, "PICTURE"),
      ),
    )
    .as("featured_photos");

  // --- BASE QUERY ---
  // Get chapters where the constituent has an active membership
  const baseQuery = dbClient.db
    .select({
      id: schema.Chapters.id,
      name: schema.Chapters.name,
      country: schema.Chapters.country,
      featuredPhotoExternalId: featuredPhotoSubquery.externalId,
      memberCount: memberCountSubquery.memberCount,
      foundingDate: schema.Chapters.foundingDate,
    })
    .from(schema.ChapterMemberships)
    .innerJoin(
      memberSubquery,
      eq(schema.ChapterMemberships.memberId, memberSubquery.memberId),
    )
    .innerJoin(
      schema.Chapters,
      eq(schema.ChapterMemberships.chapterId, schema.Chapters.id),
    )
    .leftJoin(
      memberCountSubquery,
      eq(schema.Chapters.id, memberCountSubquery.chapterId),
    )
    .leftJoin(
      featuredPhotoSubquery,
      and(
        eq(schema.Chapters.id, featuredPhotoSubquery.chapterId),
        eq(featuredPhotoSubquery.rn, 1),
      ),
    )
    .where(
      and(
        isNull(schema.Chapters.archivedAt),
        sql`${schema.ChapterMemberships.startedAt} <= now()`,
        sql`(${schema.ChapterMemberships.endedAt} IS NULL OR ${schema.ChapterMemberships.endedAt} >= now())`,
      ),
    );

  // --- QUERY EXECUTION ---
  const [totalResult, dbChapters] = await Promise.all([
    dbClient.db.select({ total: count() }).from(baseQuery.as("sub")),
    baseQuery.limit(pageSize).offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.total ?? 0;

  // --- DATA MAPPING ---
  const items: YPFChapter[] = dbChapters.map((c) => ({
    id: c.id,
    name: c.name,
    country: c.country,
    featuredPhotoUrl: c.featuredPhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(c.featuredPhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    memberCount: c.memberCount ?? 0,
    foundingDate: c.foundingDate,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

export async function getChapterLeadership(
  chapterId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<Paginated<YPFMember>> {
  const { page = 1, pageSize = 20 } = query;
  const offset = (page - 1) * pageSize;

  const baseQuery = dbClient.db
    .select({
      memberId: schema.Members.id,
      constituentId: schema.Constituents.id,
      publicId: schema.Constituents.publicId,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      preferredName: schema.Constituents.preferredName,
      profilePhotoExternalId: schema.Media.externalId,
      country: schema.Constituents.country,
      title: schema.MemberTitles.title,
      startedAt: schema.Members.startedAt,
    })
    .from(schema.MemberTitlesAssignments)
    .innerJoin(
      schema.MemberTitles,
      eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
    )
    .innerJoin(
      schema.Members,
      eq(schema.MemberTitlesAssignments.memberId, schema.Members.id),
    )
    .innerJoin(
      schema.Constituents,
      eq(schema.Members.constituentId, schema.Constituents.id),
    )
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id),
    )
    .where(
      and(
        eq(schema.MemberTitles.chapterId, chapterId),
        sql`${schema.MemberTitlesAssignments.startedAt} <= now()`,
        sql`(${schema.MemberTitlesAssignments.endedAt} IS NULL OR ${schema.MemberTitlesAssignments.endedAt} >= now())`,
        // Ensure the underlying membership is also active
        sql`${schema.Members.startedAt} <= now()`,
        sql`(${schema.Members.endedAt} IS NULL OR ${schema.Members.endedAt} >= now())`,
      ),
    )
    // Order by rank (lower is higher rank) then alphabetical
    .orderBy(schema.MemberTitles._level, schema.MemberTitles.title);

  const [totalResult, users] = await Promise.all([
    dbClient.db.select({ total: count() }).from(baseQuery.as("sub")),
    baseQuery.limit(pageSize).offset(offset),
  ]);

  const total = totalResult[0]?.total ?? 0;

  const items: YPFMember[] = users.map((u) => ({
    id: u.memberId,
    constituentId: u.constituentId,
    publicId: u.publicId,
    fullName: u.preferredName ?? `${u.firstName} ${u.lastName}`,
    profilePhotoUrl: u.profilePhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(u.profilePhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    title: u.title,
    country: u.country ?? undefined,
    startedAt: u.startedAt,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Enrolls a constituent to a chapter.
 * Finds the active member record and creates a ChapterMembership.
 */
export async function enrollToChapter(
  chapterId: string,
  constituentId: string,
  startedAt?: Date,
): Promise<string> {
  const now = new Date();

  // Find active member record
  const [member] = await dbClient.db
    .select({ id: schema.Members.id })
    .from(schema.Members)
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        lte(schema.Members.startedAt, now),
        or(isNull(schema.Members.endedAt), gte(schema.Members.endedAt, now)),
      ),
    )
    .limit(1);

  if (!member) {
    throw new ApiError("No active membership found for constituent", 404);
  }

  const [membership] = await dbClient.db
    .insert(schema.ChapterMemberships)
    .values({
      memberId: member.id,
      chapterId,
      startedAt: startedAt ?? now,
    })
    .returning({ id: schema.ChapterMemberships.id });

  return membership.id;
}

/**
 * Unenrolls a constituent from a chapter by setting endedAt on the active membership.
 */
export async function unenrollFromChapter(
  chapterId: string,
  constituentId: string,
): Promise<void> {
  const now = new Date();

  // Find active member record
  const [member] = await dbClient.db
    .select({ id: schema.Members.id })
    .from(schema.Members)
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        lte(schema.Members.startedAt, now),
        or(isNull(schema.Members.endedAt), gte(schema.Members.endedAt, now)),
      ),
    )
    .limit(1);

  if (!member) {
    throw new ApiError("No active membership found for constituent", 404);
  }

  const result = await dbClient.db
    .update(schema.ChapterMemberships)
    .set({ endedAt: now })
    .where(
      and(
        eq(schema.ChapterMemberships.memberId, member.id),
        eq(schema.ChapterMemberships.chapterId, chapterId),
        isNull(schema.ChapterMemberships.endedAt),
        lte(schema.ChapterMemberships.startedAt, now),
      ),
    )
    .returning({ id: schema.ChapterMemberships.id });

  if (result.length === 0) {
    throw new ApiError("No active chapter membership found", 404);
  }
}

/**
 * Canonical chapter-scoped role aliases. Matches the convention documented in
 * `constituents/dtos.ts` and the authorizer's `MEMBER.chapterlead.<id>` /
 * `MEMBER.chapterhead.<id>` role-string format. The remaining slots use
 * `chapter_*` underscore form so they never collide with existing
 * global / committee titles.
 */
export const CHAPTER_ROLE_ALIASES = [
  "chapterlead",
  "chapterhead",
  "chapter_secretary",
  "chapter_finance",
  "chapter_programs",
  "chapter_welfare",
  "chapter_media",
  "chapter_records",
] as const;

export type ChapterRoleAlias = (typeof CHAPTER_ROLE_ALIASES)[number];

const CHAPTER_ROLE_TITLES: Record<ChapterRoleAlias, string> = {
  chapterlead: "Chapter Lead",
  chapterhead: "Chapter Head",
  chapter_secretary: "Chapter Secretary",
  chapter_finance: "Finance Coordinator",
  chapter_programs: "Programs Coordinator",
  chapter_welfare: "Welfare Coordinator",
  chapter_media: "Media Liaison",
  chapter_records: "Records Officer",
};

const CHAPTER_ROLE_LEVELS: Record<ChapterRoleAlias, number> = {
  chapterlead: 10,
  chapterhead: 15,
  chapter_secretary: 30,
  chapter_finance: 30,
  chapter_programs: 30,
  chapter_welfare: 30,
  chapter_media: 30,
  chapter_records: 30,
};

export type ChapterRoleHolder = {
  alias: ChapterRoleAlias;
  title: string;
  member?: {
    memberId: string;
    constituentId: string;
    publicId: string;
    fullName: string;
    email?: string;
    profilePhotoUrl?: string;
    startedAt: Date;
  };
};

/**
 * Fetches all eight canonical chapter role slots for `chapterId`. Slots that
 * have an active assignment include the holder; empty slots are returned
 * without a `member`. Always returns 8 entries in the alias declaration order
 * so the frontend can render the full list without filling in gaps itself.
 */
export async function getChapterRoles(
  chapterId: string,
): Promise<ChapterRoleHolder[]> {
  const db = dbClient.db;

  // Pull the active holder for every chapter-scoped title in one shot.
  const rows = await db
    .select({
      alias: schema.MemberTitles.alias,
      title: schema.MemberTitles.title,
      memberId: schema.Members.id,
      constituentId: schema.Constituents.id,
      publicId: schema.Constituents.publicId,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      preferredName: schema.Constituents.preferredName,
      email: schema.Constituents.email,
      profilePhotoExternalId: schema.Media.externalId,
      startedAt: schema.MemberTitlesAssignments.startedAt,
    })
    .from(schema.MemberTitles)
    .innerJoin(
      schema.MemberTitlesAssignments,
      eq(schema.MemberTitles.id, schema.MemberTitlesAssignments.titleId),
    )
    .innerJoin(
      schema.Members,
      eq(schema.MemberTitlesAssignments.memberId, schema.Members.id),
    )
    .innerJoin(
      schema.Constituents,
      eq(schema.Members.constituentId, schema.Constituents.id),
    )
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id),
    )
    .where(
      and(
        eq(schema.MemberTitles.chapterId, chapterId),
        sql`${schema.MemberTitlesAssignments.startedAt} <= now()`,
        sql`(${schema.MemberTitlesAssignments.endedAt} IS NULL OR ${schema.MemberTitlesAssignments.endedAt} >= now())`,
        sql`${schema.Members.startedAt} <= now()`,
        sql`(${schema.Members.endedAt} IS NULL OR ${schema.Members.endedAt} >= now())`,
      ),
    );

  const byAlias = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    // First active row wins per alias — should be unique under normal use
    // but a defensive filter avoids surprising "double role" displays.
    if (!byAlias.has(row.alias)) byAlias.set(row.alias, row);
  }

  return CHAPTER_ROLE_ALIASES.map((alias) => {
    const row = byAlias.get(alias);
    if (!row) {
      return { alias, title: CHAPTER_ROLE_TITLES[alias] };
    }
    return {
      alias,
      title: row.title || CHAPTER_ROLE_TITLES[alias],
      member: {
        memberId: row.memberId,
        constituentId: row.constituentId,
        publicId: row.publicId,
        fullName: row.preferredName ?? `${row.firstName} ${row.lastName}`,
        email: row.email ?? undefined,
        profilePhotoUrl: row.profilePhotoExternalId
          ? mediaUtils.generatePublicMediaUrl(row.profilePhotoExternalId, {
              resolution: 360,
            })
          : undefined,
        startedAt: row.startedAt,
      },
    };
  });
}

/**
 * Finds the chapter-scoped MemberTitle for `alias`, creating it on demand if
 * the row hasn't been provisioned yet. Idempotent — repeated calls return the
 * same row.
 */
async function ensureChapterRoleTitle(
  tx: typeof dbClient.db,
  chapterId: string,
  alias: ChapterRoleAlias,
): Promise<{ id: string }> {
  const existing = await tx.query.MemberTitles.findFirst({
    where: and(
      eq(schema.MemberTitles.chapterId, chapterId),
      eq(schema.MemberTitles.alias, alias),
    ),
    columns: { id: true },
  });
  if (existing) return existing;

  const [created] = await tx
    .insert(schema.MemberTitles)
    .values({
      title: CHAPTER_ROLE_TITLES[alias],
      alias,
      _level: CHAPTER_ROLE_LEVELS[alias],
      chapterId,
    })
    .returning({ id: schema.MemberTitles.id });

  return created;
}

/**
 * Assigns a chapter role to a constituent. The constituent must already have
 * an active `Members` record. If a different person currently holds the role,
 * their assignment is closed out (`endedAt = now`) before the new one is
 * inserted, so each slot has at most one active holder.
 *
 * Returns the holder snapshot for the new assignment.
 */
export async function assignChapterRole(
  chapterId: string,
  alias: ChapterRoleAlias,
  constituentId: string,
): Promise<ChapterRoleHolder> {
  // Verify chapter exists and isn't archived first — cheap check, friendlier 404.
  const [chapter] = await dbClient.db
    .select({ id: schema.Chapters.id })
    .from(schema.Chapters)
    .where(and(eq(schema.Chapters.id, chapterId), isNull(schema.Chapters.archivedAt)))
    .limit(1);
  if (!chapter) {
    throw new ApiError("Chapter not found", 404);
  }

  await dbClient.db.transaction(async (tx) => {
    const now = new Date();

    const [member] = await tx
      .select({ id: schema.Members.id })
      .from(schema.Members)
      .where(
        and(
          eq(schema.Members.constituentId, constituentId),
          lte(schema.Members.startedAt, now),
          or(
            isNull(schema.Members.endedAt),
            gte(schema.Members.endedAt, now),
          ),
        ),
      )
      .limit(1);

    if (!member) {
      throw new ApiError(
        "Constituent has no active member record — invite them as a member first.",
        400,
      );
    }

    const title = await ensureChapterRoleTitle(
      tx as typeof dbClient.db,
      chapterId,
      alias,
    );

    // Close out any active holders of this role (might be the same member —
    // we still end + reinsert so startedAt reflects the latest assignment).
    await tx
      .update(schema.MemberTitlesAssignments)
      .set({ endedAt: now })
      .where(
        and(
          eq(schema.MemberTitlesAssignments.titleId, title.id),
          isNull(schema.MemberTitlesAssignments.endedAt),
        ),
      );

    await tx.insert(schema.MemberTitlesAssignments).values({
      memberId: member.id,
      titleId: title.id,
      startedAt: now,
    });

    // Ensure the member is enrolled in the chapter — feels surprising for a
    // chapter role-holder to not also appear in the chapter roster.
    const [existingMembership] = await tx
      .select({ id: schema.ChapterMemberships.id })
      .from(schema.ChapterMemberships)
      .where(
        and(
          eq(schema.ChapterMemberships.memberId, member.id),
          eq(schema.ChapterMemberships.chapterId, chapterId),
          isNull(schema.ChapterMemberships.endedAt),
        ),
      )
      .limit(1);

    if (!existingMembership) {
      await tx.insert(schema.ChapterMemberships).values({
        memberId: member.id,
        chapterId,
        startedAt: now,
      });
    }
  });

  const roles = await getChapterRoles(chapterId);
  const holder = roles.find((r) => r.alias === alias);
  if (!holder) {
    // Practically unreachable — we just inserted the assignment.
    throw new ApiError("Failed to reload role after assignment", 500);
  }
  return holder;
}

/**
 * Ends the active assignment for a chapter role slot. The role title row is
 * kept so the next assignment reuses the same id (and the seeded level).
 */
export async function clearChapterRole(
  chapterId: string,
  alias: ChapterRoleAlias,
): Promise<void> {
  const now = new Date();

  const title = await dbClient.db.query.MemberTitles.findFirst({
    where: and(
      eq(schema.MemberTitles.chapterId, chapterId),
      eq(schema.MemberTitles.alias, alias),
    ),
    columns: { id: true },
  });

  if (!title) {
    // Nothing to clear — slot was never assigned. Treat as success.
    return;
  }

  await dbClient.db
    .update(schema.MemberTitlesAssignments)
    .set({ endedAt: now })
    .where(
      and(
        eq(schema.MemberTitlesAssignments.titleId, title.id),
        isNull(schema.MemberTitlesAssignments.endedAt),
      ),
    );
}

// ─── Chapter media (Phase 1.2) ──────────────────────────────────────────────

export async function fetchChapterMedia(
  chapterId: string,
  query: { page: number; pageSize: number },
) {
  const { page, pageSize } = query;

  const [rows, total] = await Promise.all([
    dbClient.db
      .select({
        id: schema.ChapterMedia.id,
        caption: schema.ChapterMedia.caption,
        isFeatured: schema.ChapterMedia.isFeatured,
        medium: {
          id: schema.Media.id,
          externalId: schema.Media.externalId,
          type: schema.Media.type,
          width: schema.Media.width,
          height: schema.Media.height,
          size: schema.Media.size,
          uploadedAt: schema.Media.uploadedAt,
        },
      })
      .from(schema.ChapterMedia)
      .innerJoin(
        schema.Media,
        eq(schema.ChapterMedia.mediumId, schema.Media.id),
      )
      .where(eq(schema.ChapterMedia.chapterId, chapterId))
      .orderBy(desc(schema.ChapterMedia.isFeatured))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbClient.db
      .select({ count: count() })
      .from(schema.ChapterMedia)
      .where(eq(schema.ChapterMedia.chapterId, chapterId))
      .then((res) => res[0].count),
  ]);

  const items = rows.map((m) => ({
    id: m.id,
    caption: m.caption ?? undefined,
    isFeatured: m.isFeatured,
    medium: {
      id: m.medium.id,
      type: m.medium.type,
      size: m.medium.size,
      uploadedAt: m.medium.uploadedAt,
      url: mediaUtils.generateSignedMediaUrl(m.medium.externalId, {
        resolution: 1080,
        expireSeconds: 60 * 60 * 24,
      }),
      dimensions: {
        width: m.medium.width,
        height: m.medium.height,
      },
    },
  }));

  return { items, total };
}

export async function updateChapterMedium(
  chapterId: string,
  mediumId: string,
  data: { caption?: string; isFeatured?: boolean },
): Promise<void> {
  if (data.isFeatured === true) {
    await dbClient.db
      .update(schema.ChapterMedia)
      .set({ isFeatured: false })
      .where(eq(schema.ChapterMedia.chapterId, chapterId));
  }

  const [updated] = await dbClient.db
    .update(schema.ChapterMedia)
    .set(data)
    .where(
      and(
        eq(schema.ChapterMedia.chapterId, chapterId),
        eq(schema.ChapterMedia.id, mediumId),
      ),
    )
    .returning({ id: schema.ChapterMedia.id });

  if (!updated) {
    throw new ApiError("Chapter medium not found", 404);
  }
}

export async function removeChapterMedium(
  chapterId: string,
  mediumId: string,
): Promise<void> {
  const [removed] = await dbClient.db
    .delete(schema.ChapterMedia)
    .where(
      and(
        eq(schema.ChapterMedia.chapterId, chapterId),
        eq(schema.ChapterMedia.id, mediumId),
      ),
    )
    .returning({ mediumId: schema.ChapterMedia.mediumId });

  if (!removed) {
    throw new ApiError("Chapter medium not found", 404);
  }

  if (removed.mediumId) {
    try {
      const [media] = await dbClient.db
        .select({ externalId: schema.Media.externalId })
        .from(schema.Media)
        .where(eq(schema.Media.id, removed.mediumId))
        .limit(1);

      await dbClient.db
        .delete(schema.Media)
        .where(eq(schema.Media.id, removed.mediumId));

      if (media?.externalId) {
        mediaUtils.deleteMediumFile(media.externalId).catch((err) => {
          logger.error(
            err,
            `Failed to delete external media asset ${media.externalId}`,
          );
        });
      }
    } catch (err) {
      logger.warn(err, "Failed to remove orphan media row");
    }
  }
}
