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
  exists,
} from "drizzle-orm";
import z from "zod";

import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { Paginated } from "@/shared/dtos";
import {
  MemberRole,
  YPFMember,
  YPFMemberDetail,
} from "@/features/api/v1/members/dtos";
import { GetMembersQuerySchema } from "@/features/api/v1/members/schemas";
import * as mediaUtils from "@/shared/utils/files";
import { ApiError } from "@/shared/types";

export async function getMembers(
  query: z.infer<typeof GetMembersQuerySchema>,
): Promise<Paginated<YPFMember>> {
  const { page, pageSize, search, chapterId, committeeId } = query;
  const now = sql<Date>`now()`;

  // --- SUBQUERIES ---

  // 1. Subquery to find the most significant (highest priority) active title for each constituent.
  const topTitleSubquery = dbClient.db
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

  if (chapterId) {
    whereClauses.push(
      exists(
        dbClient.db
          .select()
          .from(schema.ChapterMemberships)
          .innerJoin(
            schema.Members,
            eq(schema.ChapterMemberships.memberId, schema.Members.id),
          )
          .where(
            and(
              eq(schema.Members.constituentId, schema.Constituents.id),
              eq(schema.ChapterMemberships.chapterId, chapterId),
              lte(schema.ChapterMemberships.startedAt, now),
              or(
                isNull(schema.ChapterMemberships.endedAt),
                gte(schema.ChapterMemberships.endedAt, now),
              ),
            ),
          ),
      ),
    );
  }

  if (committeeId) {
    whereClauses.push(
      exists(
        dbClient.db
          .select()
          .from(schema.CommitteeMemberships)
          .innerJoin(
            schema.Members,
            eq(schema.CommitteeMemberships.memberId, schema.Members.id),
          )
          .where(
            and(
              eq(schema.Members.constituentId, schema.Constituents.id),
              eq(schema.CommitteeMemberships.committeeId, committeeId),
              lte(schema.CommitteeMemberships.startedAt, now),
              or(
                isNull(schema.CommitteeMemberships.endedAt),
                gte(schema.CommitteeMemberships.endedAt, now),
              ),
            ),
          ),
      ),
    );
  }

  // --- BASE QUERY CONSTRUCTION ---
  const baseQuery = dbClient.db
    .select({
      id: schema.Constituents.id,
      publicId: schema.Constituents.publicId,
      profilePhotoExternalId: schema.Media.externalId,
      fullName:
        sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`.as(
          "full_name",
        ),
      startedAt: schema.Members.startedAt,
      title: topTitleSubquery.titleName,
    })
    .from(schema.Constituents)
    // Join active membership
    .leftJoin(
      schema.Members,
      and(
        eq(schema.Constituents.id, schema.Members.constituentId),
        lte(schema.Members.startedAt, now),
        or(isNull(schema.Members.endedAt), gte(schema.Members.endedAt, now)),
      ),
    )
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id),
    )
    .leftJoin(
      topTitleSubquery,
      and(
        eq(schema.Constituents.id, topTitleSubquery.constituentId),
        eq(topTitleSubquery.rn, 1),
      ),
    )
    .where(
      and(
        ...whereClauses,
        // Ensure they have at least one membership record (past or present)
        exists(
          dbClient.db
            .select()
            .from(schema.Members)
            .where(eq(schema.Members.constituentId, schema.Constituents.id)),
        ),
      ),
    );

  // --- QUERY EXECUTION ---
  const [totalResult, dbMembers] = await Promise.all([
    dbClient.db.select({ total: count() }).from(baseQuery.as("sub")),
    baseQuery.limit(pageSize).offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.total ?? 0;

  // --- DATA MAPPING ---
  const items: YPFMember[] = dbMembers.map((m) => ({
    id: m.id,
    publicId: m.publicId,
    fullName: m.fullName,
    profilePhotoUrl: m.profilePhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(m.profilePhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    startedAt: m.startedAt ?? undefined,
    title: m.title ?? undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

export async function getMemberByConstituentId(
  constituentId: string,
): Promise<YPFMemberDetail> {
  const now = sql`now()`;

  const [constituent] = await dbClient.db
    .select({
      id: schema.Constituents.id,
      publicId: schema.Constituents.publicId,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      salutation: schema.Constituents.salutation,
      phone: schema.Constituents.phone,
      whatsapp: schema.Constituents.whatsapp,
      email: schema.Constituents.email,
      profilePhotoExternalId: schema.Media.externalId,
      profilePhotoType: schema.Media.type,
      profilePhotoWidth: schema.Media.width,
      profilePhotoHeight: schema.Media.height,
      profilePhotoSize: schema.Media.size,
      profilePhotoUploadedAt: schema.Media.uploadedAt,
      profilePhotoUploadedBy: schema.Media.uploadedBy,
      startedAt: schema.Members.startedAt,
      endedAt: schema.Members.endedAt,
    })
    .from(schema.Constituents)
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id),
    )
    .leftJoin(
      schema.Members,
      and(
        eq(schema.Constituents.id, schema.Members.constituentId),
        lte(schema.Members.startedAt, now),
        or(isNull(schema.Members.endedAt), gte(schema.Members.endedAt, now)),
      ),
    )
    .where(eq(schema.Constituents.id, constituentId));

  if (!constituent) {
    throw new ApiError("Member not found", 404);
  }

  const titles = await dbClient.db
    .select({
      name: schema.MemberTitles.title,
      _level: schema.MemberTitles._level,
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

  const memberDetail: YPFMemberDetail = {
    id: constituent.id,
    publicId: constituent.publicId,
    firstName: constituent.firstName,
    lastName: constituent.lastName,
    salutation: constituent.salutation ?? undefined,
    profilePhoto:
      constituent.profilePhotoExternalId &&
      constituent.profilePhotoType &&
      constituent.profilePhotoWidth !== null &&
      constituent.profilePhotoHeight !== null &&
      constituent.profilePhotoSize !== null &&
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
            size: constituent.profilePhotoSize,
            uploadedAt: constituent.profilePhotoUploadedAt,
          }
        : undefined,
    contactInfo: {
      phone: constituent.phone ?? undefined,
      whatsapp: constituent.whatsapp ?? undefined,
      email: constituent.email ?? undefined,
    },
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
      _level: t._level,
      startedAt: t.startedAt,
      endedAt: t.endedAt ?? undefined,
    })),
    startedAt: constituent.startedAt ?? undefined,
    endedAt: constituent.endedAt ?? undefined,
  };

  return memberDetail;
}

/**
 * Enrolls a constituent as a global member (creates a new Members record).
 */
export async function enrollGlobal(
  constituentId: string,
  startedAt?: Date,
): Promise<string> {
  const [member] = await dbClient.db
    .insert(schema.Members)
    .values({
      constituentId,
      startedAt: startedAt ?? new Date(),
    })
    .returning({ id: schema.Members.id });

  return member.id;
}

/**
 * Unenrolls a constituent from global membership by setting endedAt on active record.
 * Uses a single query with WHERE clause - returns nothing if no active record found.
 */
export async function unenrollGlobal(constituentId: string): Promise<void> {
  const now = new Date();

  const result = await dbClient.db
    .update(schema.Members)
    .set({ endedAt: now })
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        isNull(schema.Members.endedAt),
        lte(schema.Members.startedAt, now),
      ),
    )
    .returning({ id: schema.Members.id });

  if (result.length === 0) {
    throw new ApiError("No active membership found for constituent", 404);
  }
}

/**
 * Gets paginated member titles (roles) with search support.
 * Search applies to title and alias fields.
 */
export async function getRoles(query: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<Paginated<MemberRole>> {
  const { page = 1, pageSize = 20, search } = query;
  const offset = (page - 1) * pageSize;

  // Build where clauses
  const whereClauses = [];
  if (search) {
    whereClauses.push(
      or(
        ilike(schema.MemberTitles.title, `%${search}%`),
        ilike(schema.MemberTitles.alias, `%${search}%`),
      ),
    );
  }

  // Get total count
  const [totalResult] = await dbClient.db
    .select({ total: count() })
    .from(schema.MemberTitles)
    .where(and(...whereClauses));

  const total = totalResult?.total ?? 0;

  // Get paginated roles with scope info
  const roles = await dbClient.db
    .select({
      id: schema.MemberTitles.id,
      title: schema.MemberTitles.title,
      alias: schema.MemberTitles.alias,
      _level: schema.MemberTitles._level,
      chapterId: schema.MemberTitles.chapterId,
      chapterName: schema.Chapters.name,
      committeeId: schema.MemberTitles.committeeId,
      committeeName: schema.Committees.name,
    })
    .from(schema.MemberTitles)
    .leftJoin(
      schema.Chapters,
      eq(schema.MemberTitles.chapterId, schema.Chapters.id),
    )
    .leftJoin(
      schema.Committees,
      eq(schema.MemberTitles.committeeId, schema.Committees.id),
    )
    .where(and(...whereClauses))
    .orderBy(schema.MemberTitles._level, schema.MemberTitles.title)
    .limit(pageSize)
    .offset(offset);

  const items: MemberRole[] = roles.map((r) => ({
    id: r.id,
    title: r.title,
    alias: r.alias,
    _level: r._level,
    scope:
      r.chapterId && r.chapterName
        ? { type: "chapter" as const, id: r.chapterId, name: r.chapterName }
        : r.committeeId && r.committeeName
          ? {
              type: "committee" as const,
              id: r.committeeId,
              name: r.committeeName,
            }
          : undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Gets global leadership - members with active role assignments to global roles
 * (roles where chapterId and committeeId are both null).
 */
export async function getLeadership(query: {
  page?: number;
  pageSize?: number;
}): Promise<Paginated<YPFMember>> {
  const { page = 1, pageSize = 20 } = query;
  const offset = (page - 1) * pageSize;

  const baseQuery = dbClient.db
    .select({
      id: schema.Constituents.id,
      publicId: schema.Constituents.publicId, // Added publicId
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      preferredName: schema.Constituents.preferredName,
      profilePhotoExternalId: schema.Media.externalId,
      title: schema.MemberTitles.title,
      startedAt: schema.Members.startedAt, // Renamed joinedAt to startedAt
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
        // Global roles only (no chapter or committee scope)
        isNull(schema.MemberTitles.chapterId),
        isNull(schema.MemberTitles.committeeId),
        // Active assignment
        sql`${schema.MemberTitlesAssignments.startedAt} <= now()`,
        sql`(${schema.MemberTitlesAssignments.endedAt} IS NULL OR ${schema.MemberTitlesAssignments.endedAt} >= now())`,
        // Active membership
        sql`${schema.Members.startedAt} <= now()`,
        sql`(${schema.Members.endedAt} IS NULL OR ${schema.Members.endedAt} >= now())`,
      ),
    )
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
 * Assigns a role (MemberTitle) to a constituent.
 * Finds the active member record and creates a MemberTitlesAssignment.
 */
export async function assignRole(
  constituentId: string,
  titleId: string,
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

  const [assignment] = await dbClient.db
    .insert(schema.MemberTitlesAssignments)
    .values({
      memberId: member.id,
      titleId,
      startedAt: startedAt ?? now,
    })
    .returning({ id: schema.MemberTitlesAssignments.id });

  return assignment.id;
}

/**
 * Unassigns a role from a constituent by setting endedAt on the active assignment.
 */
export async function unassignRole(
  constituentId: string,
  titleId: string,
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
    .update(schema.MemberTitlesAssignments)
    .set({ endedAt: now })
    .where(
      and(
        eq(schema.MemberTitlesAssignments.memberId, member.id),
        eq(schema.MemberTitlesAssignments.titleId, titleId),
        isNull(schema.MemberTitlesAssignments.endedAt),
        lte(schema.MemberTitlesAssignments.startedAt, now),
      ),
    )
    .returning({ id: schema.MemberTitlesAssignments.id });

  if (result.length === 0) {
    throw new ApiError("No active role assignment found", 404);
  }
}
