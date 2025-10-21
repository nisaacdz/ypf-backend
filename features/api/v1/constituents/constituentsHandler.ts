import {
  sql,
  and,
  eq,
  min,
  countDistinct,
  ilike,
  isNull,
  gt,
  or,
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

  // --- SUBQUERIES ---

  // 1. Subquery to find the earliest "MEMBER" membership start date for each constituent.
  const firstMembershipSubquery = pgPool.db
    .select({
      constituentId: schema.Memberships.constituentId,
      joinedAt: min(schema.Memberships.startedAt).as("joined_at"),
    })
    .from(schema.Memberships)
    .where(eq(schema.Memberships.type, "MEMBER"))
    .groupBy(schema.Memberships.constituentId)
    .as("first_membership");

  // 2. Subquery to find the most recent "MEMBER" membership to determine active status.
  const latestMembershipSubquery = pgPool.db
    .select({
      constituentId: schema.Memberships.constituentId,
      endedAt: schema.Memberships.endedAt,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.Memberships.constituentId} ORDER BY ${schema.Memberships.startedAt} DESC)`.as(
        "membership_rn",
      ),
    })
    .from(schema.Memberships)
    .where(eq(schema.Memberships.type, "MEMBER"))
    .as("latest_membership");

  // 3. Subquery to find the role with the highest priority (lowest _level).
  const topRoleSubquery = pgPool.db
    .select({
      constituentId: schema.RoleAssignments.constituentId,
      roleName: schema.Roles.name,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.RoleAssignments.constituentId} ORDER BY ${schema.Roles._level} ASC)`.as(
        "role_rn",
      ),
    })
    .from(schema.RoleAssignments)
    .innerJoin(schema.Roles, eq(schema.RoleAssignments.roleId, schema.Roles.id))
    .as("top_role");

  // --- DYNAMIC FILTERS ---

  const whereClauses = [];

  if (search) {
    const fullName = sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`;
    whereClauses.push(ilike(fullName, `%${search}%`));
  }

  if (chapterId) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.ChapterMemberships}
        WHERE ${schema.ChapterMemberships.constituentId} = ${schema.Constituents.id}
        AND ${schema.ChapterMemberships.chapterId} = ${chapterId}
      )`,
    );
  }

  if (committeeId) {
    whereClauses.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.CommitteeMemberships}
        WHERE ${schema.CommitteeMemberships.constituentId} = ${schema.Constituents.id}
        AND ${schema.CommitteeMemberships.committeeId} = ${committeeId}
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
      isActive: sql<boolean>`${or(
        isNull(latestMembershipSubquery.endedAt),
        gt(latestMembershipSubquery.endedAt, new Date()),
      )}`.as("is_active"),
      joinedAt: firstMembershipSubquery.joinedAt,
      role: topRoleSubquery.roleName,
    })
    .from(schema.Constituents)
    .innerJoin(
      firstMembershipSubquery,
      eq(schema.Constituents.id, firstMembershipSubquery.constituentId),
    )
    .innerJoin(
      latestMembershipSubquery,
      and(
        eq(schema.Constituents.id, latestMembershipSubquery.constituentId),
        eq(latestMembershipSubquery.rn, 1),
      ),
    )
    .leftJoin(
      schema.Medium,
      eq(schema.Constituents.profilePhotoId, schema.Medium.id),
    )
    .leftJoin(
      topRoleSubquery,
      and(
        eq(schema.Constituents.id, topRoleSubquery.constituentId),
        eq(topRoleSubquery.rn, 1),
      ),
    )
    .where(and(...whereClauses));

  // --- QUERY EXECUTION ---
  const [totalResult, dbMembers] = await Promise.all([
    pgPool.db
      .select({ total: countDistinct(schema.Constituents.id) })
      .from(baseQuery.as("sub")),
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
    role: m.role ?? undefined,
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
