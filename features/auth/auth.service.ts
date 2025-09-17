import { and, eq, or, lte, gte, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "../../configs/db";
import schema from "../../db/schema";
import { AppError } from "../../shared/types";
import { AuthenticatedUser } from "../../shared/validators";

/**
 * Fetches the current, active roles for a given user.
 * A role is considered active if its start date is in the past and its
 * end date is either null or in the future.
 *
 * @param userId The ID of the user from the `users` table.
 * @returns A promise that resolves to an array of role name strings (e.g., ['role_president']).
 */
async function getUserRoles(userId: string): Promise<string[]> {
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

  // Map the query result to the format expected by Casbin (e.g., 'president' -> 'role_president')
  return roleRecords.map((record) => `role_${record.name}`);
}

/**
 * Authenticates a user based on their username/email and password.
 * On success, it fetches their current roles and constructs the AuthenticatedUser object.
 *
 * @param username The user's username or email.
 * @param password The user's plain-text password.
 * @returns A promise that resolves to the fully constructed AuthenticatedUser.
 * @throws AppError if authentication fails.
 */
export async function loginUser(
  username: string,
  password: string,
): Promise<AuthenticatedUser> {
  // We use a leftJoin here to ensure we still get the user record
  // even if a corresponding constituent profile hasn't been created yet.
  const [user] = await db
    .select({
      id: schema.Users.id,
      password: schema.Users.password,
      email: schema.Users.email,
      username: schema.Users.username,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
    })
    .from(schema.Users)
    .leftJoin(
      schema.Constituents,
      eq(schema.Users.id, schema.Constituents.userId),
    )
    .where(
      or(eq(schema.Users.username, username), eq(schema.Users.email, username)),
    );

  // Validate user existence and password
  if (!user || !user.password) {
    throw new AppError("Invalid username or password", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Invalid username or password", 401);
  }

  // Fetch the user's currently active roles
  const roles = await getUserRoles(user.id);

  // Construct the final user object for use in the application
  const fullName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.username || user.email;

  const authUser: AuthenticatedUser = {
    id: user.id,
    fullName,
    email: user.email,
    roles,
  };

  return authUser;
}
