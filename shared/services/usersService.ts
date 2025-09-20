import { and, eq, or, lte, gte, isNull, getTableColumns } from "drizzle-orm";
import db from "@/configs/db";
import schema from "../../db/schema";
import { AppError } from "../../shared/types";
import { User, Users } from "@/db/schema/app";
import { MembershipType } from "@/db/schema/enums";

const allColumns = getTableColumns(Users);

const columns = Object.fromEntries(
  Object.keys(allColumns)
    .filter((col) => col !== "password")
    .map((col) => [col, true]),
) as { [K in Exclude<keyof typeof allColumns, "password">]: true };

export async function getUserById(userId: string): Promise<User> {
  const user = await db.query.Users.findFirst({
    columns,
    where: eq(schema.Users.id, userId),
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
}

/**
 * Fetches the current, active roles for a given user.
 * A role is considered active if its start date is in the past and its
 * end date is either null or in the future.
 *
 * @param userId The ID of the user from the `users` table.
 * @returns A promise that resolves to an array of role name strings (e.g., ['role_president']).
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const roleRecords = await db
    .select({
      name: schema.Roles.name,
    })
    .from(schema.RoleAssignments)
    .innerJoin(schema.Roles, eq(schema.RoleAssignments.roleId, schema.Roles.id))
    .innerJoin(
      schema.Constituents,
      eq(schema.RoleAssignments.constituentId, schema.Constituents.id),
    )
    .where(
      and(
        // Match the constituent linked to our user ID
        eq(schema.Constituents.userId, userId),
        // The role assignment must be currently active
        lte(schema.RoleAssignments.startedAt, new Date()),
        or(
          isNull(schema.RoleAssignments.endedAt),
          gte(schema.RoleAssignments.endedAt, new Date()),
        ),
      ),
    );

  return roleRecords.map((role) => role.name);
}

/**
 * Fetches the current, active memberships for a given user.
 * A membership is considered active if its start date is in the past and its
 * end date is either null or in the future.
 *
 * @param userId The ID of the user from the `users` table.
 * @returns A promise that resolves to an array of MembershipType enum values.
 */
export async function getUserMemberships(
  userId: string,
): Promise<(typeof MembershipType.enumValues)[number][]> {
  const membershipRecords = await db
    .select({
      type: schema.Memberships.type,
    })
    .from(schema.Memberships)
    .innerJoin(
      schema.Constituents,
      eq(schema.Memberships.constituentId, schema.Constituents.id),
    )
    .where(
      and(
        // Match the constituent linked to our user ID
        eq(schema.Constituents.userId, userId),
        // The membership must be currently active
        lte(schema.Memberships.startDate, new Date()),
        or(
          isNull(schema.Memberships.endDate),
          gte(schema.Memberships.endDate, new Date()),
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
  const [user] = await db
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
      eq(schema.Users.id, schema.Constituents.userId),
    )
    .where(eq(schema.Users.email, email));

  return user;
}
