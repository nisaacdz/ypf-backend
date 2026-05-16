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
  SQL,
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
  const { page, pageSize, search, chapterId, committeeId, country, hasTitle } =
    query;
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

  // 2. Subquery to find primary chapter for each member
  const primaryChapterSubquery = dbClient.db
    .select({
      constituentId: schema.Members.constituentId,
      chapterId: schema.Chapters.id,
      chapterName: schema.Chapters.name,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.Members.constituentId} ORDER BY ${schema.ChapterMemberships.startedAt} DESC)`.as(
        "chapter_rn",
      ),
    })
    .from(schema.ChapterMemberships)
    .innerJoin(
      schema.Members,
      eq(schema.ChapterMemberships.memberId, schema.Members.id),
    )
    .innerJoin(
      schema.Chapters,
      eq(schema.ChapterMemberships.chapterId, schema.Chapters.id),
    )
    .where(
      and(
        lte(schema.ChapterMemberships.startedAt, now),
        or(
          isNull(schema.ChapterMemberships.endedAt),
          gte(schema.ChapterMemberships.endedAt, now),
        ),
      ),
    )
    .as("primary_chapter");

  // 3. Subquery to find primary committee for each member
  const primaryCommitteeSubquery = dbClient.db
    .select({
      constituentId: schema.Members.constituentId,
      committeeId: schema.Committees.id,
      committeeName: schema.Committees.name,
      rn: sql<number>`row_number() OVER (PARTITION BY ${schema.Members.constituentId} ORDER BY ${schema.CommitteeMemberships.startedAt} DESC)`.as(
        "committee_rn",
      ),
    })
    .from(schema.CommitteeMemberships)
    .innerJoin(
      schema.Members,
      eq(schema.CommitteeMemberships.memberId, schema.Members.id),
    )
    .innerJoin(
      schema.Committees,
      eq(schema.CommitteeMemberships.committeeId, schema.Committees.id),
    )
    .where(
      and(
        lte(schema.CommitteeMemberships.startedAt, now),
        or(
          isNull(schema.CommitteeMemberships.endedAt),
          gte(schema.CommitteeMemberships.endedAt, now),
        ),
      ),
    )
    .as("primary_committee");

  // --- DYNAMIC FILTERS ---

  const whereClauses = [];

  if (search) {
    const fullName = sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`;
    whereClauses.push(ilike(fullName, `%${search}%`));
  }

  if (country) {
    whereClauses.push(eq(schema.Constituents.country, country));
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

  // Filter for members with active titles only
  if (hasTitle) {
    whereClauses.push(
      exists(
        dbClient.db
          .select()
          .from(schema.MemberTitlesAssignments)
          .innerJoin(
            schema.Members,
            eq(schema.MemberTitlesAssignments.memberId, schema.Members.id),
          )
          .where(
            and(
              eq(schema.Members.constituentId, schema.Constituents.id),
              lte(schema.MemberTitlesAssignments.startedAt, now),
              or(
                isNull(schema.MemberTitlesAssignments.endedAt),
                gte(schema.MemberTitlesAssignments.endedAt, now),
              ),
            ),
          ),
      ),
    );
  }

  // --- BASE QUERY CONSTRUCTION ---
  const baseQuery = dbClient.db
    .select({
      memberId: schema.Members.id,
      constituentId: schema.Constituents.id,
      publicId: schema.Constituents.publicId,
      email: schema.Constituents.email,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      preferredName: schema.Constituents.preferredName,
      profilePhotoExternalId: schema.Media.externalId,
      country: schema.Constituents.country,
      campus: schema.Constituents.campus,
      startedAt: schema.Members.startedAt,
      title: topTitleSubquery.titleName,
      chapterId: primaryChapterSubquery.chapterId,
      chapterName: primaryChapterSubquery.chapterName,
      committeeId: primaryCommitteeSubquery.committeeId,
      committeeName: primaryCommitteeSubquery.committeeName,
    })
    .from(schema.Constituents)
    // Join active membership
    .innerJoin(
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
    .leftJoin(
      primaryChapterSubquery,
      and(
        eq(schema.Constituents.id, primaryChapterSubquery.constituentId),
        eq(primaryChapterSubquery.rn, 1),
      ),
    )
    .leftJoin(
      primaryCommitteeSubquery,
      and(
        eq(schema.Constituents.id, primaryCommitteeSubquery.constituentId),
        eq(primaryCommitteeSubquery.rn, 1),
      ),
    )
    .where(and(...whereClauses));

  // --- QUERY EXECUTION ---
  const [totalResult, dbMembers] = await Promise.all([
    dbClient.db.select({ total: count() }).from(baseQuery.as("sub")),
    baseQuery.limit(pageSize).offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.total ?? 0;

  // --- DATA MAPPING ---
  const items: YPFMember[] = dbMembers.map((m) => ({
    id: m.memberId,
    constituentId: m.constituentId,
    publicId: m.publicId,
    email: m.email ?? undefined,
    fullName: m.preferredName ?? `${m.firstName} ${m.lastName}`,
    profilePhotoUrl: m.profilePhotoExternalId
      ? mediaUtils.generatePublicMediaUrl(m.profilePhotoExternalId, {
          resolution: 360,
        })
      : undefined,
    title: m.title ?? undefined,
    chapter:
      m.chapterId && m.chapterName
        ? { id: m.chapterId, name: m.chapterName }
        : undefined,
    committee:
      m.committeeId && m.committeeName
        ? { id: m.committeeId, name: m.committeeName }
        : undefined,
    country: m.country ?? undefined,
    campus: m.campus ?? undefined,
    startedAt: m.startedAt ?? undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

// 2. Check User Existence (Using SQL exists)
async function checkIsOnboarded(constituentId: string): Promise<boolean> {
  const result = await dbClient.db
    .select({ id: schema.Users.id })
    .from(schema.Users)
    .where(eq(schema.Users.constituentId, constituentId))
    .limit(1);

  return result.length > 0;
}

// 3. Fetch Titles
async function fetchMemberTitles(memberId: string, now: SQL) {
  return (
    dbClient.db
      .select({
        id: schema.MemberTitlesAssignments.id,
        name: schema.MemberTitles.title,
        startedAt: schema.MemberTitlesAssignments.startedAt,
        endedAt: schema.MemberTitlesAssignments.endedAt,
        chapterId: schema.Chapters.id,
        chapterName: schema.Chapters.name,
        committeeId: schema.Committees.id,
        committeeName: schema.Committees.name,
      })
      .from(schema.MemberTitlesAssignments)
      // Optimization: Filter directly by memberId, no need to join Members table again
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
          eq(schema.MemberTitlesAssignments.memberId, memberId),
          lte(schema.MemberTitlesAssignments.startedAt, now),
          or(
            isNull(schema.MemberTitlesAssignments.endedAt),
            gte(schema.MemberTitlesAssignments.endedAt, now),
          ),
        ),
      )
  );
}

// 4. Fetch Chapters
async function fetchChapterMemberships(memberId: string, now: SQL) {
  return (
    dbClient.db
      .select({
        id: schema.Chapters.id,
        name: schema.Chapters.name,
        country: schema.Chapters.country,
        startedAt: schema.ChapterMemberships.startedAt,
        endedAt: schema.ChapterMemberships.endedAt,
      })
      .from(schema.ChapterMemberships)
      // Optimization: Filter directly by memberId
      .innerJoin(
        schema.Chapters,
        eq(schema.ChapterMemberships.chapterId, schema.Chapters.id),
      )
      .where(
        and(
          eq(schema.ChapterMemberships.memberId, memberId),
          lte(schema.ChapterMemberships.startedAt, now),
          or(
            isNull(schema.ChapterMemberships.endedAt),
            gte(schema.ChapterMemberships.endedAt, now),
          ),
        ),
      )
  );
}

// 5. Fetch Committees
async function fetchCommitteeMemberships(memberId: string, now: SQL) {
  return (
    dbClient.db
      .select({
        id: schema.Committees.id,
        name: schema.Committees.name,
        chapterName: schema.Chapters.name,
        startedAt: schema.CommitteeMemberships.startedAt,
        endedAt: schema.CommitteeMemberships.endedAt,
      })
      .from(schema.CommitteeMemberships)
      // Optimization: Filter directly by memberId
      .innerJoin(
        schema.Committees,
        eq(schema.CommitteeMemberships.committeeId, schema.Committees.id),
      )
      .leftJoin(
        schema.Chapters,
        eq(schema.Committees.chapterId, schema.Chapters.id),
      )
      .where(
        and(
          eq(schema.CommitteeMemberships.memberId, memberId),
          lte(schema.CommitteeMemberships.startedAt, now),
          or(
            isNull(schema.CommitteeMemberships.endedAt),
            gte(schema.CommitteeMemberships.endedAt, now),
          ),
        ),
      )
  );
}

// --- MAIN FUNCTION ---

export async function getMemberByConstituentId(
  constituentId: string,
): Promise<YPFMemberDetail> {
  const now = sql`now()`;

  const [basicInfo] = await dbClient.db
    .select({
      memberId: schema.Members.id,
      constituentId: schema.Constituents.id,
      publicId: schema.Constituents.publicId,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
      preferredName: schema.Constituents.preferredName,
      salutation: schema.Constituents.salutation,
      occupation: schema.Constituents.occupation,
      skills: schema.Constituents.skills,
      country: schema.Constituents.country,
      region: schema.Constituents.region,
      city: schema.Constituents.city,
      campus: schema.Constituents.campus,
      orgEmail: schema.Constituents.orgEmail,
      whatsapp: schema.Constituents.whatsapp,
      linkedinProfile: schema.Constituents.linkedinProfile,
      twitterHandle: schema.Constituents.twitterHandle,
      profilePhotoExternalId: schema.Media.externalId,
      profilePhotoWidth: schema.Media.width,
      profilePhotoHeight: schema.Media.height,
      startedAt: schema.Members.startedAt,
      endedAt: schema.Members.endedAt,
    })
    .from(schema.Constituents)
    .leftJoin(
      schema.Media,
      eq(schema.Constituents.profilePhotoId, schema.Media.id),
    )
    .innerJoin(
      schema.Members,
      and(
        eq(schema.Constituents.id, schema.Members.constituentId),
        lte(schema.Members.startedAt, now),
        or(isNull(schema.Members.endedAt), gte(schema.Members.endedAt, now)),
      ),
    )
    .where(eq(schema.Constituents.id, constituentId))
    .limit(1);

  if (!basicInfo) {
    throw new ApiError("Member not found", 404);
  }

  const [isOnboarded, titles, chapterMemberships, committeeMemberships] =
    await Promise.all([
      checkIsOnboarded(constituentId),
      fetchMemberTitles(basicInfo.memberId, now),
      fetchChapterMemberships(basicInfo.memberId, now),
      fetchCommitteeMemberships(basicInfo.memberId, now),
    ]);

  const memberDetail: YPFMemberDetail = {
    id: basicInfo.memberId,
    constituentId: basicInfo.constituentId,
    publicId: basicInfo.publicId,
    firstName: basicInfo.firstName,
    lastName: basicInfo.lastName,
    preferredName: basicInfo.preferredName ?? undefined,
    salutation: basicInfo.salutation ?? undefined,
    profilePhoto:
      basicInfo.profilePhotoExternalId &&
      basicInfo.profilePhotoWidth !== null &&
      basicInfo.profilePhotoHeight !== null
        ? {
            url: mediaUtils.generatePublicMediaUrl(
              basicInfo.profilePhotoExternalId,
              { resolution: 720 },
            ),
            dimensions: {
              width: basicInfo.profilePhotoWidth,
              height: basicInfo.profilePhotoHeight,
            },
          }
        : undefined,
    occupation: basicInfo.occupation ?? undefined,
    skills: basicInfo.skills ?? undefined,
    country: basicInfo.country ?? undefined,
    region: basicInfo.region ?? undefined,
    city: basicInfo.city ?? undefined,
    campus: basicInfo.campus ?? undefined,
    orgEmail: basicInfo.orgEmail ?? undefined,
    whatsapp: basicInfo.whatsapp ?? undefined,
    linkedinProfile: basicInfo.linkedinProfile ?? undefined,
    twitterHandle: basicInfo.twitterHandle ?? undefined,
    titles: titles.map((t) => ({
      id: t.id,
      name: t.name,
      scope:
        t.chapterId && t.chapterName
          ? { type: "chapter" as const, id: t.chapterId, name: t.chapterName }
          : t.committeeId && t.committeeName
            ? {
                type: "committee" as const,
                id: t.committeeId,
                name: t.committeeName,
              }
            : undefined,
      startedAt: t.startedAt,
      endedAt: t.endedAt ?? undefined,
    })),
    chapters: chapterMemberships.map((c) => ({
      id: c.id,
      name: c.name,
      country: c.country,
      startedAt: c.startedAt,
      endedAt: c.endedAt ?? undefined,
    })),
    committees: committeeMemberships.map((c) => ({
      id: c.id,
      name: c.name,
      chapterName: c.chapterName ?? undefined,
      startedAt: c.startedAt,
      endedAt: c.endedAt ?? undefined,
    })),
    startedAt: basicInfo.startedAt ?? undefined,
    endedAt: basicInfo.endedAt ?? undefined,
    notOnboarded: !isOnboarded || undefined,
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
