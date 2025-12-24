// shared/services/targetResolver.ts

import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { TargetingFilter } from "@/shared/types/targeting";
import {
  and,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lte,
  or,
  SQL,
} from "drizzle-orm";

export async function resolveAudience(
  filters: TargetingFilter
): Promise<string[]> {
  const {
    chapterIds,
    committeeIds,
    roles,
    constituentTypes,
    status = "ACTIVE",
  } = filters;

  // 1. Helper for Date Logic (Active vs Past)
  const now = new Date();
  const isActive = (table: { endedAt: any }) =>
    or(isNull(table.endedAt), gt(table.endedAt, now));
  const isPast = (table: { endedAt: any }) => lte(table.endedAt, now);

  const getStatusCondition = (table: { endedAt: any }) => {
    if (status === "ACTIVE") return isActive(table);
    if (status === "PAST") return isPast(table);
    return undefined; // ALL
  };

  // 2. Build Sub-Conditions for each Constituent Type
  const typeConditions: SQL[] = [];

  // --- MEMBER LOGIC ---
  // Members support Chapters, Committees, and Roles
  if (!constituentTypes || constituentTypes.includes("MEMBER")) {
    const memberSubquery = dbClient.db
      .select({ id: schema.Members.id })
      .from(schema.Members)
      .where(
        and(
          // Link back to constituent
          eq(schema.Members.constituentId, schema.Constituents.id),
          
          // Status Filter
          getStatusCondition(schema.Members),
          
          // Scope: Chapter (Exists check)
          chapterIds?.length
            ? exists(
                dbClient.db
                  .select({ id: schema.ChapterMemberships.id })
                  .from(schema.ChapterMemberships)
                  .where(
                    and(
                      eq(schema.ChapterMemberships.memberId, schema.Members.id),
                      inArray(schema.ChapterMemberships.chapterId, chapterIds)
                    )
                  )
              )
            : undefined,

          // Scope: Committee (Exists check)
          committeeIds?.length
            ? exists(
                dbClient.db
                  .select({ id: schema.CommitteeMemberships.id })
                  .from(schema.CommitteeMemberships)
                  .where(
                    and(
                      eq(schema.CommitteeMemberships.memberId, schema.Members.id),
                      inArray(
                        schema.CommitteeMemberships.committeeId,
                        committeeIds
                      )
                    )
                  )
              )
            : undefined,

          // Scope: Roles (Exists check)
          roles?.length
            ? exists(
                dbClient.db
                  .select({ id: schema.MemberTitlesAssignments.id })
                  .from(schema.MemberTitlesAssignments)
                  .innerJoin(
                    schema.MemberTitles,
                    eq(
                      schema.MemberTitlesAssignments.titleId,
                      schema.MemberTitles.id
                    )
                  )
                  .where(
                    and(
                      eq(
                        schema.MemberTitlesAssignments.memberId,
                        schema.Members.id
                      ),
                      inArray(schema.MemberTitles.title, roles)
                    )
                  )
              )
            : undefined
        )
      );

    typeConditions.push(exists(memberSubquery));
  }

  // --- VOLUNTEER LOGIC ---
  // Volunteers do NOT support Chapter/Role filters in the current schema
  if (!constituentTypes || constituentTypes.includes("VOLUNTEER")) {
    const volunteerSubquery = dbClient.db
      .select({ id: schema.Volunteers.id })
      .from(schema.Volunteers)
      .where(
        and(
          eq(schema.Volunteers.constituentId, schema.Constituents.id),
          getStatusCondition(schema.Volunteers)
        )
      );

    typeConditions.push(exists(volunteerSubquery));
  }

  // --- ADMIN LOGIC ---
  if (!constituentTypes || constituentTypes.includes("ADMIN")) {
    const adminSubquery = dbClient.db
      .select({ id: schema.Admins.id })
      .from(schema.Admins)
      .where(
        and(
          eq(schema.Admins.constituentId, schema.Constituents.id),
          getStatusCondition(schema.Admins)
        )
      );

    typeConditions.push(exists(adminSubquery));
  }

  // 3. Execute Main Query
  // Logic: SELECT id FROM Constituents WHERE (IsMemberMatching OR IsVolunteerMatching OR IsAdminMatching)
  if (typeConditions.length === 0) return [];

  const results = await dbClient.db
    .select({ id: schema.Constituents.id })
    .from(schema.Constituents)
    .where(or(...typeConditions));

  return results.map((r) => r.id);
}
