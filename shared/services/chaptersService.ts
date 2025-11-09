import { sql, and, eq, count, ilike, isNull, desc } from "drizzle-orm";
import z from "zod";

import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { Paginated, YPFChapter, YPFChapterDetail } from "@/shared/dtos";
import { GetChaptersQuerySchema } from "@/shared/validators/core";
import * as mediaUtils from "@/shared/utils/media";
import { ApiError } from "@/shared/types";

export async function getChapters(
  query: z.infer<typeof GetChaptersQuerySchema>
): Promise<Paginated<YPFChapter>> {
  const { page, pageSize, search } = query;

  // --- SUBQUERY FOR MEMBER COUNT ---
  const memberCountSubquery = dbClient.db
    .select({
      chapterId: schema.ChapterMemberships.chapterId,
      memberCount:
        sql<number>`COUNT(DISTINCT ${schema.Members.constituentId})`.as(
          "member_count"
        ),
    })
    .from(schema.ChapterMemberships)
    .innerJoin(
      schema.Members,
      eq(schema.ChapterMemberships.memberId, schema.Members.id)
    )
    .where(
      and(
        sql`${schema.ChapterMemberships.startedAt} <= now()`,
        sql`(${schema.ChapterMemberships.endedAt} IS NULL OR ${schema.ChapterMemberships.endedAt} >= now())`
      )
    )
    .groupBy(schema.ChapterMemberships.chapterId)
    .as("member_counts");

  // --- SUBQUERY FOR FEATURED PHOTO ---
  const featuredPhotoSubquery = dbClient.db
    .select({
      chapterId: schema.ChapterMedia.chapterId,
      externalId: schema.Media.externalId,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.ChapterMedia.chapterId} ORDER BY ${schema.Media.uploadedAt} DESC)`.as(
        "photo_rn"
      ),
    })
    .from(schema.ChapterMedia)
    .innerJoin(schema.Media, eq(schema.ChapterMedia.mediumId, schema.Media.id))
    .where(eq(schema.ChapterMedia.isFeatured, true))
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
      eq(schema.Chapters.id, memberCountSubquery.chapterId)
    )
    .leftJoin(
      featuredPhotoSubquery,
      and(
        eq(schema.Chapters.id, featuredPhotoSubquery.chapterId),
        eq(featuredPhotoSubquery.rn, 1)
      )
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
  chapterId: string
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
            "uploader_name"
          ),
      })
      .from(schema.ChapterMedia)
      .innerJoin(
        schema.Media,
        eq(schema.ChapterMedia.mediumId, schema.Media.id)
      )
      .leftJoin(
        schema.Constituents,
        eq(schema.Media.uploadedBy, schema.Constituents.id)
      )
      .where(
        and(
          eq(schema.ChapterMedia.chapterId, chapterId),
          eq(schema.ChapterMedia.isFeatured, true)
        )
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
