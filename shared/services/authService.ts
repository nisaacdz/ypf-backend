import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import db from "@/configs/db";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";
import { AuthenticatedUser } from "@/shared/validators";
import { getUserMemberships, getUserRoles } from "./usersService";
import { Users } from "@/db/schema/app";

/**
 * Authenticates a user based on their username/email and password.
 * On success, it fetches their current roles and constructs the AuthenticatedUser object.
 *
 * @param username The user's username or email.
 * @param password The user's plain-text password.
 * @returns A promise that resolves to the fully constructed AuthenticatedUser.
 * @throws AppError if authentication fails.
 */
export async function loginWithUsernameAndPassword(
  username: string,
  password: string,
): Promise<AuthenticatedUser> {
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

  if (!user || !user.password) {
    throw new AppError("Invalid username or password", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AppError("Invalid username or password", 401);
  }

  const [roles, memberships] = await Promise.all([
    getUserRoles(user.id),
    getUserMemberships(user.id),
  ]);

  const fullName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.username || user.email;

  const authUser: AuthenticatedUser = {
    id: user.id,
    fullName,
    email: user.email,
    roles,
    memberships,
  };

  return authUser;
}

/**
 * Links a Google ID to an existing user account.
 *
 * @param userId The ID of the user to update.
 * @param googleId The Google ID (sub claim) to link.
 */
export async function linkGoogleIdToUser(
  userId: string,
  googleId: string,
): Promise<void> {
  await db
    .update(Users)
    .set({ googleId: googleId })
    .where(eq(Users.id, userId));
}
