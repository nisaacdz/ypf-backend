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
  inArray,
  ne,
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
import logger from "@/configs/logger";
import { ApiError } from "@/shared/types";

export async function getCommittees(
  query: z.infer<typeof GetCommitteesQuerySchema>,
): Promise<Paginated<YPFCommittee>> {
  const { page, pageSize, search, chapterId } = query;
  // Note: this function constructs three subqueries — member count, chair,
  // featured photo — and left-joins them to the committees table. The
  // alternate getCommitteesByConstituentId below shares the member_count
  // subquery name but is a separate query graph.

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

  // --- SUBQUERY FOR ACTIVE CHAIR ---
  // Returns one row per (committee, member) where the member currently holds
  // the committeechair title. The window function ranks active chairs so we
  // can pick the most recently-assigned one if the data ever has dupes.
  const chairSubquery = dbClient.db
    .select({
      committeeId: schema.MemberTitles.committeeId,
      memberId: schema.Members.id,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.MemberTitles.committeeId} ORDER BY ${schema.MemberTitlesAssignments.startedAt} DESC)`.as(
        "chair_rn",
      ),
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
    .where(
      and(
        eq(schema.MemberTitles.alias, "committeechair"),
        sql`${schema.MemberTitles.committeeId} IS NOT NULL`,
        sql`${schema.MemberTitlesAssignments.startedAt} <= now()`,
        sql`(${schema.MemberTitlesAssignments.endedAt} IS NULL OR ${schema.MemberTitlesAssignments.endedAt} >= now())`,
      ),
    )
    .as("active_chairs");

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
      alias: schema.Committees.alias,
      description: schema.Committees.description,
      featuredPhotoExternalId: featuredPhotoSubquery.externalId,
      chapterName: schema.Chapters.name,
      memberCount: memberCountSubquery.memberCount,
      chairMemberId: chairSubquery.memberId,
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
      chairSubquery,
      and(
        eq(schema.Committees.id, chairSubquery.committeeId),
        eq(chairSubquery.rn, 1),
      ),
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
    alias: c.alias,
    description: c.description ?? undefined,
    featuredPhotoUrl: c.featuredPhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(c.featuredPhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    chapterName: c.chapterName ?? undefined,
    memberCount: c.memberCount ?? 0,
    chairMemberId: c.chairMemberId ?? null,
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
      alias: schema.Committees.alias,
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
    alias: c.alias,
    description: c.description ?? undefined,
    featuredPhotoUrl: c.featuredPhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(c.featuredPhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    chapterName: c.chapterName ?? undefined,
    memberCount: c.memberCount ?? 0,
    // This endpoint is scoped to a single constituent's committees; chair
    // info isn't surfaced here. Callers that need chair use the main
    // GET /committees list which joins the chair subquery.
    chairMemberId: null,
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
 * Enrolls a constituent to a committee.
 * Finds the active member record and creates a CommitteeMembership.
 */
export async function enrollToCommittee(
  committeeId: string,
  constituentId: string,
  startedAt?: Date,
  titleAlias: "committeemember" | "committeechair" = "committeemember",
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

  const [title] = await dbClient.db
    .select({ id: schema.MemberTitles.id })
    .from(schema.MemberTitles)
    .where(
      and(
        eq(schema.MemberTitles.committeeId, committeeId),
        eq(schema.MemberTitles.alias, titleAlias),
      ),
    )
    .limit(1);

  if (!title) {
    throw new ApiError("Committee role title was not found", 404);
  }

  return await dbClient.db.transaction(async (tx) => {
    const [existingMembership] = await tx
      .select({ id: schema.CommitteeMemberships.id })
      .from(schema.CommitteeMemberships)
      .where(
        and(
          eq(schema.CommitteeMemberships.memberId, member.id),
          eq(schema.CommitteeMemberships.committeeId, committeeId),
          lte(schema.CommitteeMemberships.startedAt, now),
          or(
            isNull(schema.CommitteeMemberships.endedAt),
            gte(schema.CommitteeMemberships.endedAt, now),
          ),
        ),
      )
      .limit(1);

    const membershipId =
      existingMembership?.id ??
      (
        await tx
          .insert(schema.CommitteeMemberships)
          .values({
            memberId: member.id,
            committeeId,
            startedAt: startedAt ?? now,
          })
          .returning({ id: schema.CommitteeMemberships.id })
      )[0].id;

    const activeAssignments = await tx
      .select({
        id: schema.MemberTitlesAssignments.id,
        alias: schema.MemberTitles.alias,
      })
      .from(schema.MemberTitlesAssignments)
      .innerJoin(
        schema.MemberTitles,
        eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
      )
      .where(
        and(
          eq(schema.MemberTitlesAssignments.memberId, member.id),
          eq(schema.MemberTitles.committeeId, committeeId),
          lte(schema.MemberTitlesAssignments.startedAt, now),
          or(
            isNull(schema.MemberTitlesAssignments.endedAt),
            gte(schema.MemberTitlesAssignments.endedAt, now),
          ),
        ),
      );

    const existingTitle = activeAssignments.find(
      (assignment) => assignment.alias === titleAlias,
    );
    const assignmentsToEnd = activeAssignments
      .filter((assignment) => assignment.alias !== titleAlias)
      .map((assignment) => assignment.id);

    if (assignmentsToEnd.length > 0) {
      await tx
        .update(schema.MemberTitlesAssignments)
        .set({ endedAt: now })
        .where(inArray(schema.MemberTitlesAssignments.id, assignmentsToEnd));
    }

    if (titleAlias === "committeechair") {
      const otherActiveChairAssignments = await tx
        .select({ id: schema.MemberTitlesAssignments.id })
        .from(schema.MemberTitlesAssignments)
        .innerJoin(
          schema.MemberTitles,
          eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
        )
        .where(
          and(
            eq(schema.MemberTitles.committeeId, committeeId),
            eq(schema.MemberTitles.alias, "committeechair"),
            ne(schema.MemberTitlesAssignments.memberId, member.id),
            lte(schema.MemberTitlesAssignments.startedAt, now),
            or(
              isNull(schema.MemberTitlesAssignments.endedAt),
              gte(schema.MemberTitlesAssignments.endedAt, now),
            ),
          ),
        );

      if (otherActiveChairAssignments.length > 0) {
        await tx
          .update(schema.MemberTitlesAssignments)
          .set({ endedAt: now })
          .where(
            inArray(
              schema.MemberTitlesAssignments.id,
              otherActiveChairAssignments.map((assignment) => assignment.id),
            ),
          );
      }
    }

    if (!existingTitle) {
      await tx.insert(schema.MemberTitlesAssignments).values({
        memberId: member.id,
        titleId: title.id,
        startedAt: startedAt ?? now,
      });
    }

    return membershipId;
  });
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

  await dbClient.db.transaction(async (tx) => {
    const result = await tx
      .update(schema.CommitteeMemberships)
      .set({ endedAt: now })
      .where(
        and(
          eq(schema.CommitteeMemberships.memberId, member.id),
          eq(schema.CommitteeMemberships.committeeId, committeeId),
          lte(schema.CommitteeMemberships.startedAt, now),
          or(
            isNull(schema.CommitteeMemberships.endedAt),
            gte(schema.CommitteeMemberships.endedAt, now),
          ),
        ),
      )
      .returning({ id: schema.CommitteeMemberships.id });

    if (result.length === 0) {
      throw new ApiError("No active committee membership found", 404);
    }

    const activeTitleAssignments = await tx
      .select({ id: schema.MemberTitlesAssignments.id })
      .from(schema.MemberTitlesAssignments)
      .innerJoin(
        schema.MemberTitles,
        eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
      )
      .where(
        and(
          eq(schema.MemberTitlesAssignments.memberId, member.id),
          eq(schema.MemberTitles.committeeId, committeeId),
          lte(schema.MemberTitlesAssignments.startedAt, now),
          or(
            isNull(schema.MemberTitlesAssignments.endedAt),
            gte(schema.MemberTitlesAssignments.endedAt, now),
          ),
        ),
      );

    if (activeTitleAssignments.length > 0) {
      await tx
        .update(schema.MemberTitlesAssignments)
        .set({ endedAt: now })
        .where(
          inArray(
            schema.MemberTitlesAssignments.id,
            activeTitleAssignments.map((assignment) => assignment.id),
          ),
        );
    }
  });
}

// ─── Committee media (Phase 1.3) ────────────────────────────────────────────

export async function fetchCommitteeMedia(
  committeeId: string,
  query: { page: number; pageSize: number },
) {
  const { page, pageSize } = query;

  const [rows, total] = await Promise.all([
    dbClient.db
      .select({
        id: schema.CommitteeMedia.id,
        caption: schema.CommitteeMedia.caption,
        isFeatured: schema.CommitteeMedia.isFeatured,
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
      .from(schema.CommitteeMedia)
      .innerJoin(
        schema.Media,
        eq(schema.CommitteeMedia.mediumId, schema.Media.id),
      )
      .where(eq(schema.CommitteeMedia.committeeId, committeeId))
      .orderBy(desc(schema.CommitteeMedia.isFeatured))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbClient.db
      .select({ count: count() })
      .from(schema.CommitteeMedia)
      .where(eq(schema.CommitteeMedia.committeeId, committeeId))
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
      dimensions: { width: m.medium.width, height: m.medium.height },
    },
  }));

  return { items, total };
}

export async function updateCommitteeMedium(
  committeeId: string,
  mediumId: string,
  data: { caption?: string; isFeatured?: boolean },
): Promise<void> {
  if (data.isFeatured === true) {
    await dbClient.db
      .update(schema.CommitteeMedia)
      .set({ isFeatured: false })
      .where(eq(schema.CommitteeMedia.committeeId, committeeId));
  }

  const [updated] = await dbClient.db
    .update(schema.CommitteeMedia)
    .set(data)
    .where(
      and(
        eq(schema.CommitteeMedia.committeeId, committeeId),
        eq(schema.CommitteeMedia.id, mediumId),
      ),
    )
    .returning({ id: schema.CommitteeMedia.id });

  if (!updated) {
    throw new ApiError("Committee medium not found", 404);
  }
}

export async function removeCommitteeMedium(
  committeeId: string,
  mediumId: string,
): Promise<void> {
  const [removed] = await dbClient.db
    .delete(schema.CommitteeMedia)
    .where(
      and(
        eq(schema.CommitteeMedia.committeeId, committeeId),
        eq(schema.CommitteeMedia.id, mediumId),
      ),
    )
    .returning({ mediumId: schema.CommitteeMedia.mediumId });

  if (!removed) {
    throw new ApiError("Committee medium not found", 404);
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
