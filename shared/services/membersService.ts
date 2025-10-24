import {
  sql,
  and,
  eq,
  min,
  count,
  ilike,
  isNull,
  or,
  lte,
  gte,
} from "drizzle-orm";
import z from "zod";

import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { Paginated, YPFMember, MemberDetail } from "@/shared/dtos";
import { GetMembersQuerySchema } from "@/shared/validators/core";
import * as mediaUtils from "@/shared/utils/media";
import { AppError } from "@/shared/types";

export async function getMembers(
  query: z.infer<typeof GetMembersQuerySchema>,
): Promise<Paginated<YPFMember>> {
  const { page, pageSize, search, chapterId, committeeId } = query;
  const now = sql`now()`;

  // --- SUBQUERIES ---

  // 1. Subquery to find the earliest membership start date for each constituent.
  const firstMembershipSubquery = pgPool.db
    .select({
      constituentId: schema.Members.constituentId,
      joinedAt: min(schema.Members.startedAt).as("joined_at"),
    })
    .from(schema.Members)
    .groupBy(schema.Members.constituentId)
    .as("first_membership");

  // 2. Subquery to find the most significant (highest priority) active title for each constituent.
  const topTitleSubquery = pgPool.db
    .select({
      constituentId: schema.Members.constituentId,
      titleName: schema.MemberTitles.title,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.Members.constituentId} ORDER BY ${schema.MemberTitles._level} ASC)`.as(
        "title_rn",
      ),
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
    // Only consider titles that are currently active
    .where(
      and(
        lte(schema.MemberTitlesAssignments.startedAt, now),
        or(
          isNull(schema.MemberTitlesAssignments.endedAt),
          gte(schema.MemberTitlesAssignments.endedAt, now),
        ),
      ),
    )
    .as("top_title");

  // --- DYNAMIC FILTERS ---

  const whereClauses = [];

  if (search) {
    const fullName = sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`;
    whereClauses.push(ilike(fullName, `%${search}%`));
  }

  // Filter for members active in a specific chapter
  if (chapterId) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.ChapterMemberships} cm
        JOIN ${schema.Members} m ON cm.member_id = m.id
        WHERE m.constituent_id = ${schema.Constituents.id}
        AND cm.chapter_id = ${chapterId} AND cm.is_active = true
      )`,
    );
  }

  // Filter for members active in a specific committee
  if (committeeId) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.CommitteeMemberships} com
        JOIN ${schema.Members} m ON com.member_id = m.id
        WHERE m.constituent_id = ${schema.Constituents.id}
        AND com.committee_id = ${committeeId} AND com.is_active = true
      )`,
    );
  }

  // --- BASE QUERY CONSTRUCTION ---

  const baseQuery = pgPool.db
    .select({
      id: schema.Constituents.id,
      profilePhotoExternalId: schema.Medium.externalId,
      fullName:
        sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`.as(
          "full_name",
        ),
      // Check if any active membership period exists for the constituent
      isActive: sql<boolean>`EXISTS (
        SELECT 1 FROM ${schema.Members} m
        WHERE m.constituent_id = ${schema.Constituents.id}
        AND m.started_at <= ${now} AND (m.ended_at IS NULL OR m.ended_at >= ${now})
      )`.as("is_active"),
      joinedAt: firstMembershipSubquery.joinedAt,
      title: topTitleSubquery.titleName,
    })
    .from(schema.Constituents)
    .innerJoin(
      firstMembershipSubquery,
      eq(schema.Constituents.id, firstMembershipSubquery.constituentId),
    )
    .leftJoin(
      schema.Medium,
      eq(schema.Constituents.profilePhotoId, schema.Medium.id),
    )
    .leftJoin(
      topTitleSubquery,
      and(
        eq(schema.Constituents.id, topTitleSubquery.constituentId),
        eq(topTitleSubquery.rn, 1),
      ),
    )
    .where(and(...whereClauses));

  // --- QUERY EXECUTION ---
  const [totalResult, dbMembers] = await Promise.all([
    pgPool.db.select({ total: count() }).from(baseQuery.as("sub")),
    baseQuery.limit(pageSize).offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.total ?? 0;

  // --- DATA MAPPING ---
  const items: YPFMember[] = dbMembers.map((m) => ({
    id: m.id,
    fullName: m.fullName,
    profilePhotoUrl: m.profilePhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(m.profilePhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    isActive: m.isActive,
    joinedAt: m.joinedAt ?? undefined,
    title: m.title ?? undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

export async function getMemberById(
  constituentId: string,
): Promise<MemberDetail> {
  const now = sql`now()`;

  // Create an alias for the uploader constituent
  const uploaderConstituent = schema.Constituents;

  // Query to get basic constituent information and profile photo
  const [constituent] = await pgPool.db
    .select({
      id: schema.Constituents.id,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      salutation: schema.Constituents.salutation,
      profilePhotoExternalId: schema.Medium.externalId,
      profilePhotoType: schema.Medium.type,
      profilePhotoWidth: schema.Medium.width,
      profilePhotoHeight: schema.Medium.height,
      profilePhotoSizeInBytes: schema.Medium.sizeInBytes,
      profilePhotoUploadedAt: schema.Medium.uploadedAt,
      profilePhotoUploadedBy: schema.Medium.uploadedBy,
      joinedAt: min(schema.Members.startedAt).as("joined_at"),
      isActive: sql<boolean>`EXISTS (
        SELECT 1 FROM ${schema.Members} m
        WHERE m.constituent_id = ${schema.Constituents.id}
        AND m.started_at <= ${now} AND (m.ended_at IS NULL OR m.ended_at >= ${now})
      )`.as("is_active"),
    })
    .from(schema.Constituents)
    .leftJoin(
      schema.Medium,
      eq(schema.Constituents.profilePhotoId, schema.Medium.id),
    )
    .leftJoin(
      schema.Members,
      eq(schema.Constituents.id, schema.Members.constituentId),
    )
    .where(eq(schema.Constituents.id, constituentId))
    .groupBy(
      schema.Constituents.id,
      schema.Medium.externalId,
      schema.Medium.type,
      schema.Medium.width,
      schema.Medium.height,
      schema.Medium.sizeInBytes,
      schema.Medium.uploadedAt,
      schema.Medium.uploadedBy,
    );

  if (!constituent) {
    throw new AppError("Member not found", 404);
  }

  // Fetch uploader name if profile photo exists and has uploader
  let uploaderFullName: string | undefined;
  if (constituent.profilePhotoUploadedBy) {
    const [uploader] = await pgPool.db
      .select({
        firstName: uploaderConstituent.firstName,
        lastName: uploaderConstituent.lastName,
      })
      .from(uploaderConstituent)
      .where(eq(uploaderConstituent.id, constituent.profilePhotoUploadedBy));

    if (uploader) {
      uploaderFullName = `${uploader.firstName} ${uploader.lastName}`;
    }
  }

  // Query to get contact information
  const contacts = await pgPool.db
    .select({
      type: schema.ContactInformations.contactType,
      value: schema.ContactInformations.value,
    })
    .from(schema.ContactInformations)
    .where(
      and(
        eq(schema.ContactInformations.constituentId, constituentId),
        eq(schema.ContactInformations.isPrimary, true),
      ),
    );

  // Query to get current titles with their scopes
  const titles = await pgPool.db
    .select({
      name: schema.MemberTitles.title,
      level: schema.MemberTitles._level,
      startedAt: schema.MemberTitlesAssignments.startedAt,
      endedAt: schema.MemberTitlesAssignments.endedAt,
      chapterId: schema.Chapters.id,
      chapterName: schema.Chapters.name,
      committeeId: schema.Committees.id,
      committeeName: schema.Committees.name,
    })
    .from(schema.MemberTitlesAssignments)
    .innerJoin(
      schema.Members,
      eq(schema.MemberTitlesAssignments.memberId, schema.Members.id),
    )
    .innerJoin(
      schema.MemberTitles,
      eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
    )
    .leftJoin(
      schema.Chapters,
      eq(schema.MemberTitles.chapterId, schema.Chapters.id),
    )
    .leftJoin(
      schema.Committees,
      eq(schema.MemberTitles.committeeId, schema.Committees.id),
    )
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        lte(schema.MemberTitlesAssignments.startedAt, now),
        or(
          isNull(schema.MemberTitlesAssignments.endedAt),
          gte(schema.MemberTitlesAssignments.endedAt, now),
        ),
      ),
    );

  // Map the data to MemberDetail format
  const memberDetail: MemberDetail = {
    id: constituent.id,
    firstName: constituent.firstName,
    lastName: constituent.lastName,
    salutation: constituent.salutation ?? undefined,
    profilePhoto:
      constituent.profilePhotoExternalId &&
      constituent.profilePhotoType &&
      constituent.profilePhotoWidth !== null &&
      constituent.profilePhotoHeight !== null &&
      constituent.profilePhotoSizeInBytes !== null &&
      constituent.profilePhotoUploadedAt
        ? {
            url: mediaUtils.generatePublicMediaUrl(
              constituent.profilePhotoExternalId,
              { resolution: 720 },
            ),
            type: constituent.profilePhotoType,
            dimensions: {
              width: constituent.profilePhotoWidth,
              height: constituent.profilePhotoHeight,
            },
            sizeInBytes: constituent.profilePhotoSizeInBytes,
            uploadedAt: constituent.profilePhotoUploadedAt,
            uploadedBy: uploaderFullName,
          }
        : undefined,
    contactInfos: contacts.map((c) => ({
      type: c.type as "EMAIL" | "PHONE" | "WHATSAPP",
      value: c.value,
    })),
    titles: titles.map((t) => ({
      name: t.name,
      scope:
        t.chapterId && t.chapterName
          ? { type: "chapter" as const, name: t.chapterName, id: t.chapterId }
          : t.committeeId && t.committeeName
            ? {
                type: "committee" as const,
                name: t.committeeName,
                id: t.committeeId,
              }
            : undefined,
      _level: t.level,
      startedAt: t.startedAt,
      endedAt: t.endedAt ?? undefined,
    })),
    joinedAt: constituent.joinedAt ?? new Date(),
    isActive: constituent.isActive,
  };

  return memberDetail;
}
