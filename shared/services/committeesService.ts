import { sql, and, eq, count, ilike, isNull, desc, or } from "drizzle-orm";
import z from "zod";

import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { Paginated, YPFCommittee, DetailedCommittee } from "@/shared/dtos";
import { GetCommitteesQuerySchema } from "@/shared/validators/core";
import * as mediaUtils from "@/shared/utils/media";
import { AppError } from "@/shared/types";

export async function getCommittees(
  query: z.infer<typeof GetCommitteesQuerySchema>,
): Promise<Paginated<YPFCommittee>> {
  const { page, pageSize, search, chapterId } = query;

  // --- SUBQUERY FOR MEMBER COUNT ---
  const memberCountSubquery = pgPool.db
    .select({
      committeeId: schema.CommitteeMemberships.committeeId,
      memberCount:
        sql<number>`COUNT(DISTINCT ${schema.Members.constituentId})`.as(
          "member_count",
        ),
    })
    .from(schema.CommitteeMemberships)
    .innerJoin(
      schema.Members,
      eq(schema.CommitteeMemberships.memberId, schema.Members.id),
    )
    .where(
      and(
        sql`${schema.CommitteeMemberships.startedAt} <= now()`,
        sql`(${schema.CommitteeMemberships.endedAt} IS NULL OR ${schema.CommitteeMemberships.endedAt} >= now())`,
      ),
    )
    .groupBy(schema.CommitteeMemberships.committeeId)
    .as("member_counts");

  // --- SUBQUERY FOR FEATURED PHOTO ---
  const featuredPhotoSubquery = pgPool.db
    .select({
      committeeId: schema.CommitteeMedia.committeeId,
      externalId: schema.Medium.externalId,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.CommitteeMedia.committeeId} ORDER BY ${schema.Medium.uploadedAt} DESC)`.as(
        "photo_rn",
      ),
    })
    .from(schema.CommitteeMedia)
    .innerJoin(
      schema.Medium,
      eq(schema.CommitteeMedia.mediumId, schema.Medium.id),
    )
    .where(eq(schema.CommitteeMedia.isFeatured, true))
    .as("featured_photos");

  // --- DYNAMIC FILTERS ---
  const whereClauses = [
    isNull(schema.Committees.archivedAt),
    or(isNull(schema.Committees.chapterId), isNull(schema.Chapters.archivedAt)),
  ];

  if (search) {
    whereClauses.push(ilike(schema.Committees.name, `%${search}%`));
  }

  if (chapterId) {
    whereClauses.push(eq(schema.Committees.chapterId, chapterId));
  }

  // --- BASE QUERY ---
  const baseQuery = pgPool.db
    .select({
      id: schema.Committees.id,
      name: schema.Committees.name,
      description: schema.Committees.description,
      featuredPhotoExternalId: featuredPhotoSubquery.externalId,
      chapterName: schema.Chapters.name,
      memberCount: memberCountSubquery.memberCount,
    })
    .from(schema.Committees)
    .leftJoin(
      schema.Chapters,
      eq(schema.Committees.chapterId, schema.Chapters.id),
    )
    .leftJoin(
      memberCountSubquery,
      eq(schema.Committees.id, memberCountSubquery.committeeId),
    )
    .leftJoin(
      featuredPhotoSubquery,
      and(
        eq(schema.Committees.id, featuredPhotoSubquery.committeeId),
        eq(featuredPhotoSubquery.rn, 1),
      ),
    )
    .where(and(...whereClauses));

  // --- QUERY EXECUTION ---
  const [totalResult, dbCommittees] = await Promise.all([
    pgPool.db.select({ total: count() }).from(baseQuery.as("sub")),
    baseQuery.limit(pageSize).offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.total ?? 0;

  // --- DATA MAPPING ---
  const items: YPFCommittee[] = dbCommittees.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? undefined,
    featuredPhotoUrl: c.featuredPhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(c.featuredPhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    chapterName: c.chapterName ?? undefined,
    memberCount: c.memberCount ?? 0,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

export async function getCommitteeById(
  committeeId: string,
): Promise<DetailedCommittee> {
  const [committee] = await pgPool.db
    .select({
      id: schema.Committees.id,
      name: schema.Committees.name,
      description: schema.Committees.description,
      archivedAt: schema.Committees.archivedAt,
      chapterId: schema.Committees.chapterId,
      chapterName: schema.Chapters.name,
      chapterArchivedAt: schema.Chapters.archivedAt,
      createdAt: sql<Date>`(
        SELECT MIN(cm.started_at)
        FROM ${schema.CommitteeMemberships} cm
        WHERE cm.committee_id = ${schema.Committees.id}
      )`.as("created_at"),
    })
    .from(schema.Committees)
    .leftJoin(
      schema.Chapters,
      eq(schema.Committees.chapterId, schema.Chapters.id),
    )
    .where(eq(schema.Committees.id, committeeId));

  if (!committee) {
    throw new AppError("Committee not found", 404);
  }

  const featuredMedia = await pgPool.db
    .select({
      caption: schema.CommitteeMedia.caption,
      mediumExternalId: schema.Medium.externalId,
      mediumType: schema.Medium.type,
      mediumWidth: schema.Medium.width,
      mediumHeight: schema.Medium.height,
      mediumSizeInBytes: schema.Medium.sizeInBytes,
      mediumUploadedAt: schema.Medium.uploadedAt,
      mediumUploadedBy:
        sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`.as(
          "uploader_name",
        ),
    })
    .from(schema.CommitteeMedia)
    .innerJoin(
      schema.Medium,
      eq(schema.CommitteeMedia.mediumId, schema.Medium.id),
    )
    .leftJoin(
      schema.Constituents,
      eq(schema.Medium.uploadedBy, schema.Constituents.id),
    )
    .where(
      and(
        eq(schema.CommitteeMedia.committeeId, committeeId),
        eq(schema.CommitteeMedia.isFeatured, true),
      ),
    )
    .orderBy(desc(schema.Medium.uploadedAt))
    .limit(5);

  const detailedCommittee: DetailedCommittee = {
    id: committee.id,
    name: committee.name,
    description: committee.description ?? undefined,
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
    chapter:
      committee.chapterId && committee.chapterName
        ? {
            id: committee.chapterId,
            name: committee.chapterName,
          }
        : undefined,
    isActive:
      committee.archivedAt === null &&
      (committee.chapterArchivedAt === null || committee.chapterId === null),
    createdAt: committee.createdAt ?? new Date(),
  };

  return detailedCommittee;
}
