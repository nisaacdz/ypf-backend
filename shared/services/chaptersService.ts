import {
  sql,
  and,
  eq,
  count,
  ilike,
  isNull,
  desc,
} from "drizzle-orm";
import z from "zod";

import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { Paginated, YPFChapter, DetailedChapter } from "@/shared/dtos";
import { GetChaptersQuerySchema } from "@/shared/validators/core";
import * as mediaUtils from "@/shared/utils/media";
import { AppError } from "@/shared/types";

export async function getChapters(
  query: z.infer<typeof GetChaptersQuerySchema>,
): Promise<Paginated<YPFChapter>> {
  const { page, pageSize, search } = query;

  // --- SUBQUERY FOR MEMBER COUNT ---
  const memberCountSubquery = pgPool.db
    .select({
      chapterId: schema.ChapterMemberships.chapterId,
      memberCount: sql<number>`COUNT(DISTINCT ${schema.Members.constituentId})`.as(
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
  const featuredPhotoSubquery = pgPool.db
    .select({
      chapterId: schema.ChapterMedia.chapterId,
      externalId: schema.Medium.externalId,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.ChapterMedia.chapterId} ORDER BY ${schema.Medium.uploadedAt} DESC)`.as(
        "photo_rn",
      ),
    })
    .from(schema.ChapterMedia)
    .innerJoin(
      schema.Medium,
      eq(schema.ChapterMedia.mediumId, schema.Medium.id),
    )
    .where(eq(schema.ChapterMedia.isFeatured, true))
    .as("featured_photos");

  // --- DYNAMIC FILTERS ---
  const whereClauses = [isNull(schema.Chapters.archivedAt)];

  if (search) {
    whereClauses.push(ilike(schema.Chapters.name, `%${search}%`));
  }

  // --- BASE QUERY ---
  const baseQuery = pgPool.db
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
    pgPool.db.select({ total: count() }).from(baseQuery.as("sub")),
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
): Promise<DetailedChapter> {
  const [chapter] = await pgPool.db
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
    throw new AppError("Chapter not found", 404);
  }

  const [featuredMedia, parentChapter] = await Promise.all([
    pgPool.db
      .select({
        caption: schema.ChapterMedia.caption,
        mediumExternalId: schema.Medium.externalId,
        mediumType: schema.Medium.type,
        mediumWidth: schema.Medium.width,
        mediumHeight: schema.Medium.height,
        mediumSizeInBytes: schema.Medium.sizeInBytes,
        mediumUploadedAt: schema.Medium.uploadedAt,
        mediumUploadedBy: sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`.as(
          "uploader_name",
        ),
      })
      .from(schema.ChapterMedia)
      .innerJoin(
        schema.Medium,
        eq(schema.ChapterMedia.mediumId, schema.Medium.id),
      )
      .leftJoin(
        schema.Constituents,
        eq(schema.Medium.uploadedBy, schema.Constituents.id),
      )
      .where(
        and(
          eq(schema.ChapterMedia.chapterId, chapterId),
          eq(schema.ChapterMedia.isFeatured, true),
        ),
      )
      .orderBy(desc(schema.Medium.uploadedAt))
      .limit(5),
    chapter.parentChapterId
      ? pgPool.db
          .select({
            id: schema.Chapters.id,
            name: schema.Chapters.name,
          })
          .from(schema.Chapters)
          .where(eq(schema.Chapters.id, chapter.parentChapterId))
          .then((rows) => rows[0])
      : Promise.resolve(undefined),
  ]);

  const detailedChapter: DetailedChapter = {
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
        sizeInBytes: m.mediumSizeInBytes,
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
