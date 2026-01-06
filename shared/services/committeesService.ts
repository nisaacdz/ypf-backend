import {
  sql,
  and,
  eq,
  count,
  ilike,
  isNull,
  desc,
  or,
  lte,
  gte,
} from "drizzle-orm";
import z from "zod";

import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { Paginated } from "@/shared/dtos";
import {
  YPFCommittee,
  YPFCommitteeDetail,
} from "@/features/api/v1/committees/dtos";
import {
  GetCommitteesQuerySchema,
  GetConstituentCommitteesQuerySchema,
} from "@/features/api/v1/committees/schemas";
import { YPFMember } from "@/features/api/v1/members/dtos";
import * as mediaUtils from "@/shared/utils/files";
import { ApiError } from "@/shared/types";

export async function getCommittees(
  query: z.infer<typeof GetCommitteesQuerySchema>,
): Promise<Paginated<YPFCommittee>> {
  const { page, pageSize, search, chapterId } = query;

  // --- SUBQUERY FOR MEMBER COUNT ---
  const memberCountSubquery = dbClient.db
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
  const featuredPhotoSubquery = dbClient.db
    .select({
      committeeId: schema.CommitteeMedia.committeeId,
      externalId: schema.Media.externalId,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.CommitteeMedia.committeeId} ORDER BY ${schema.Media.uploadedAt} DESC)`.as(
        "photo_rn",
      ),
    })
    .from(schema.CommitteeMedia)
    .innerJoin(
      schema.Media,
      eq(schema.CommitteeMedia.mediumId, schema.Media.id),
    )
    .where(
      and(
        eq(schema.CommitteeMedia.isFeatured, true),
        eq(schema.Media.type, "PICTURE"),
      ),
    )
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
  const baseQuery = dbClient.db
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
    dbClient.db.select({ total: count() }).from(baseQuery.as("sub")),
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
): Promise<YPFCommitteeDetail> {
  const [committee] = await dbClient.db
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
    throw new ApiError("Committee not found", 404);
  }

  const featuredMedia = await dbClient.db
    .select({
      caption: schema.CommitteeMedia.caption,
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
    .from(schema.CommitteeMedia)
    .innerJoin(
      schema.Media,
      eq(schema.CommitteeMedia.mediumId, schema.Media.id),
    )
    .leftJoin(
      schema.Constituents,
      eq(schema.Media.uploadedBy, schema.Constituents.id),
    )
    .where(
      and(
        eq(schema.CommitteeMedia.committeeId, committeeId),
        eq(schema.CommitteeMedia.isFeatured, true),
      ),
    )
    .orderBy(desc(schema.Media.uploadedAt))
    .limit(5);

  const detailedCommittee: YPFCommitteeDetail = {
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
        size: m.mediumSize,
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

export async function getCommitteesByConstituentId(
  constituentId: string,
  query: z.infer<typeof GetConstituentCommitteesQuerySchema>,
): Promise<Paginated<YPFCommittee>> {
  const { page, pageSize } = query;

  // --- SUBQUERY FOR MEMBER ID ---
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
  const featuredPhotoSubquery = dbClient.db
    .select({
      committeeId: schema.CommitteeMedia.committeeId,
      externalId: schema.Media.externalId,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.CommitteeMedia.committeeId} ORDER BY ${schema.Media.uploadedAt} DESC)`.as(
        "photo_rn",
      ),
    })
    .from(schema.CommitteeMedia)
    .innerJoin(
      schema.Media,
      eq(schema.CommitteeMedia.mediumId, schema.Media.id),
    )
    .where(
      and(
        eq(schema.CommitteeMedia.isFeatured, true),
        eq(schema.Media.type, "PICTURE"),
      ),
    )
    .as("featured_photos");

  // --- BASE QUERY ---
  const baseQuery = dbClient.db
    .select({
      id: schema.Committees.id,
      name: schema.Committees.name,
      description: schema.Committees.description,
      featuredPhotoExternalId: featuredPhotoSubquery.externalId,
      chapterName: schema.Chapters.name,
      memberCount: memberCountSubquery.memberCount,
    })
    .from(schema.CommitteeMemberships)
    .innerJoin(
      memberSubquery,
      eq(schema.CommitteeMemberships.memberId, memberSubquery.memberId),
    )
    .innerJoin(
      schema.Committees,
      eq(schema.CommitteeMemberships.committeeId, schema.Committees.id),
    )
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
    .where(
      and(
        isNull(schema.Committees.archivedAt),
        or(
          isNull(schema.Committees.chapterId),
          isNull(schema.Chapters.archivedAt),
        ),
        sql`${schema.CommitteeMemberships.startedAt} <= now()`,
        sql`(${schema.CommitteeMemberships.endedAt} IS NULL OR ${schema.CommitteeMemberships.endedAt} >= now())`,
      ),
    );

  // --- QUERY EXECUTION ---
  const [totalResult, dbCommittees] = await Promise.all([
    dbClient.db.select({ total: count() }).from(baseQuery.as("sub")),
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

export async function getCommitteeLeadership(
  committeeId: string,
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
        eq(schema.MemberTitles.committeeId, committeeId),
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
 * Enrolls a constituent to a committee.
 * Finds the active member record and creates a CommitteeMembership.
 */
export async function enrollToCommittee(
  committeeId: string,
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
    .insert(schema.CommitteeMemberships)
    .values({
      memberId: member.id,
      committeeId,
      startedAt: startedAt ?? now,
    })
    .returning({ id: schema.CommitteeMemberships.id });

  return membership.id;
}

/**
 * Unenrolls a constituent from a committee by setting endedAt on the active membership.
 */
export async function unenrollFromCommittee(
  committeeId: string,
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
    .update(schema.CommitteeMemberships)
    .set({ endedAt: now })
    .where(
      and(
        eq(schema.CommitteeMemberships.memberId, member.id),
        eq(schema.CommitteeMemberships.committeeId, committeeId),
        isNull(schema.CommitteeMemberships.endedAt),
        lte(schema.CommitteeMemberships.startedAt, now),
      ),
    )
    .returning({ id: schema.CommitteeMemberships.id });

  if (result.length === 0) {
    throw new ApiError("No active committee membership found", 404);
  }
}
