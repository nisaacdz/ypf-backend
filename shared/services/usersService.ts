import {
  and,
  eq,
  or,
  lte,
  gte,
  isNull,
  getTableColumns,
  sql,
} from "drizzle-orm";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";
import { Users } from "@/db/schema/app";
import { MembershipType } from "@/db/schema/enums";

const allColumns = getTableColumns(Users);

const columns = Object.fromEntries(
  Object.keys(allColumns)
    .filter((col) => col !== "password")
    .map((col) => [col, true]),
) as { [K in Exclude<keyof typeof allColumns, "password">]: true };

export async function getUserById(userId: string) {
  const user = await pgPool.db.query.Users.findFirst({
    columns,
    with: {
      constituent: true,
    },
    where: eq(schema.Users.id, userId),
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
}

/**
 * Fetches the current, active roles for a given constituent.
 * A role is considered active if its start date is in the past and its
 * end date is either null or in the future.
 *
 * The 'scope' is dynamically constructed based on the role assignment:
 * - 'chapter_{id}' if linked to a chapter.
 * - 'committee_{id}' if linked to a committee.
 * - '*' for a global role.
 *
 * @param constituentId The ID of the constituent from the `constituents` table.
 * @returns A promise that resolves to an array of role objects (may be empty).
 */
export async function getConstituentRoles(constituentId: string) {
  const roleRecords = await pgPool.db
    .select({
      name: schema.Roles.name,
      // Dynamically create the 'scope' string based on the assignment context
      scope: sql<string>`
        CASE
          WHEN ${schema.RoleAssignments.chapterId} IS NOT NULL THEN CONCAT('chapter_', ${schema.RoleAssignments.chapterId})
          WHEN ${schema.RoleAssignments.committeeId} IS NOT NULL THEN CONCAT('committee_', ${schema.RoleAssignments.committeeId})
          ELSE '*'
        END
      `.as("scope"),
    })
    .from(schema.RoleAssignments)
    .innerJoin(schema.Roles, eq(schema.RoleAssignments.roleId, schema.Roles.id))
    .where(
      and(
        // Match the constituent ID
        eq(schema.RoleAssignments.constituentId, constituentId),
        // The role assignment must be currently active
        lte(schema.RoleAssignments.startedAt, new Date()),
        or(
          isNull(schema.RoleAssignments.endedAt),
          gte(schema.RoleAssignments.endedAt, new Date()),
        ),
      ),
    );

  return roleRecords;
}

/**
 * Fetches the current, active memberships for a given constituent.
 * A membership is considered active if its start date is in the past and its
 * end date is either null or in the future.
 *
 * @param constituentId The ID of the constituent from the `constituents` table.
 * @returns A promise that resolves to an array of MembershipType enum values (may be empty).
 */
export async function getConstituentMemberships(
  constituentId: string,
): Promise<(typeof MembershipType.enumValues)[number][]> {
  const membershipRecords = await pgPool.db
    .select({
      type: schema.Memberships.type,
    })
    .from(schema.Memberships)
    .where(
      and(
        // Match the constituent ID
        eq(schema.Memberships.constituentId, constituentId),
        // The membership must be currently active
        lte(schema.Memberships.startedAt, new Date()),
        or(
          isNull(schema.Memberships.endedAt),
          gte(schema.Memberships.endedAt, new Date()),
        ),
      ),
    );

  return membershipRecords.map((membership) => membership.type);
}

/**
 * Finds a user by their email address and joins their constituent data.
 *
 * @param email The email to search for.
 * @returns A promise that resolves to the user object (with constituent data) or undefined if not found.
 */
export async function findUserByEmail(email: string) {
  const [user] = await pgPool.db
    .select({
      id: schema.Users.id,
      email: schema.Users.email,
      username: schema.Users.username,
      googleId: schema.Users.googleId,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
    })
    .from(schema.Users)
    .leftJoin(
      schema.Constituents,
      eq(schema.Users.constituentId, schema.Constituents.id),
    )
    .where(eq(schema.Users.email, email));

  return user;
}
