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
  GetChaptersQuerySchema,
  GetConstituentChaptersQuerySchema,
  UpdateChapterSchema,
} from "@/features/api/v1/chapters/schemas";
import { YPFMember } from "@/features/api/v1/members/dtos";
import * as mediaUtils from "@/shared/utils/files";
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
      id: schema.Constituents.id,
      publicId: schema.Constituents.publicId,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      preferredName: schema.Constituents.preferredName,
      profilePhotoExternalId: schema.Media.externalId,
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
    id: u.id,
    publicId: u.publicId,
    fullName: u.preferredName ?? `${u.firstName} ${u.lastName}`,
    profilePhotoUrl: u.profilePhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(u.profilePhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    startedAt: u.startedAt,
    title: u.title,
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
