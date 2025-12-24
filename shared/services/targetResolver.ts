import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { TargetingFilter } from "@/shared/types/targeting";
import {
  and,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  SQL,
} from "drizzle-orm";

/**
 * Resolves a flat TargetingFilter into a set of constituent IDs.
 */
export async function resolveAudience(
  filters: TargetingFilter,
): Promise<string[]> {
  const {
    chapterIds,
    committeeIds,
    roles,
    constituentTypes,
    status = "ACTIVE",
  } = filters;

  // We start selecting from Constituents
  const query = dbClient.db
    .selectDistinct({ id: schema.Constituents.id })
    .from(schema.Constituents)
    // Join all potential tables we might filter by.
    // Drizzle's query builder handles these joins intelligently.
    .leftJoin(
      schema.Members,
      eq(schema.Constituents.id, schema.Members.constituentId),
    )
    .leftJoin(
      schema.Volunteers,
      eq(schema.Constituents.id, schema.Volunteers.constituentId),
    )
    .leftJoin(
      schema.Admins,
      eq(schema.Constituents.id, schema.Admins.constituentId),
    )
    // Member-specific joins (Scope & Roles)
    // Note: These joins depend on 'Members' being joined above.
    .leftJoin(
      schema.ChapterMemberships,
      eq(schema.Members.id, schema.ChapterMemberships.memberId),
    )
    .leftJoin(
      schema.CommitteeMemberships,
      eq(schema.Members.id, schema.CommitteeMemberships.memberId),
    )
    .leftJoin(
      schema.MemberTitlesAssignments,
      eq(schema.Members.id, schema.MemberTitlesAssignments.memberId),
    )
    .leftJoin(
      schema.MemberTitles,
      eq(schema.MemberTitlesAssignments.titleId, schema.MemberTitles.id),
    );

  const conditions: SQL[] = [];

  // --- Helper Functions for Date Logic ---
  const now = new Date();

  // Checks if a period is currently active (endedAt is null OR future)
  const isActive = (table: { endedAt: any }) =>
    or(isNull(table.endedAt), gt(table.endedAt, now));

  // Checks if a period is past (endedAt is in the past)
  const isPast = (table: { endedAt: any }) => lte(table.endedAt, now);

  // --- 1. Organizational Scope (Chapters/Committees) ---
  // Implicitly requires the user to be a Member
  if (chapterIds?.length) {
    conditions.push(inArray(schema.ChapterMemberships.chapterId, chapterIds));
  }

  if (committeeIds?.length) {
    conditions.push(
      inArray(schema.CommitteeMemberships.committeeId, committeeIds),
    );
  }

  // --- 2. Roles ---
  // Implicitly requires the user to be a Member with a specific title
  if (roles?.length) {
    conditions.push(inArray(schema.MemberTitles.title, roles));
  }

  // --- 3. Constituent Types & Status ---
  // If specific types are selected (e.g., ["MEMBER", "VOLUNTEER"]), we filter for them.
  // We also apply the status filter (ACTIVE/PAST) to those specific tables.

  const typeConditions: SQL[] = [];

  // Check MEMBER
  if (!constituentTypes || constituentTypes.includes("MEMBER")) {
    const isMember = isNotNull(schema.Members.id);
    if (status === "ACTIVE") {
      typeConditions.push(and(isMember, isActive(schema.Members))!);
    } else if (status === "PAST") {
      typeConditions.push(and(isMember, isPast(schema.Members))!);
    } else {
      typeConditions.push(isMember);
    }
  }

  // Check VOLUNTEER
  if (!constituentTypes || constituentTypes.includes("VOLUNTEER")) {
    const isVolunteer = isNotNull(schema.Volunteers.id);
    if (status === "ACTIVE") {
      typeConditions.push(and(isVolunteer, isActive(schema.Volunteers))!);
    } else if (status === "PAST") {
      typeConditions.push(and(isVolunteer, isPast(schema.Volunteers))!);
    } else {
      typeConditions.push(isVolunteer);
    }
  }

  // Check ADMIN
  if (!constituentTypes || constituentTypes.includes("ADMIN")) {
    const isAdmin = isNotNull(schema.Admins.id);
    if (status === "ACTIVE") {
      typeConditions.push(and(isAdmin, isActive(schema.Admins))!);
    } else if (status === "PAST") {
      typeConditions.push(and(isAdmin, isPast(schema.Admins))!);
    } else {
      typeConditions.push(isAdmin);
    }
  }

  // Combine Type Conditions with OR
  // e.g. (ActiveMember) OR (ActiveVolunteer)
  if (typeConditions.length > 0) {
    conditions.push(or(...typeConditions)!);
  }

  // Apply all filters
  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const results = await query;
  return results.map((r) => r.id);
}
