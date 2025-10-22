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
import { ApiResponse } from "@/shared/types";
import { Paginated, YPFMember } from "@/shared/dtos";
import { GetMembersQuerySchema } from "@/shared/validators/core";
import * as mediaUtils from "@/shared/utils/media";

export async function getMembers(
  query: z.infer<typeof GetMembersQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
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
    success: true,
    data: {
      items,
      page,
      pageSize,
      total,
    },
  };
}
