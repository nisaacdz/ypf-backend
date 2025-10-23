import { eq, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";
import { AuthenticatedUser } from "@/shared/types";
import { getConstituentProfiles, getConstituentRoles } from "./usersService";
import { Users } from "@/db/schema/app";
import { randomInt } from "crypto";

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
  const [user] = await pgPool.db
    .select({
      id: schema.Users.id,
      constituentId: schema.Constituents.id,
      password: schema.Users.password,
      email: schema.Users.email,
      username: schema.Users.username,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
    })
    .from(schema.Users)
    .innerJoin(
      schema.Constituents,
      eq(schema.Users.constituentId, schema.Constituents.id),
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

  const [roles, profiles] = await Promise.all([
    getConstituentRoles(user.constituentId),
    getConstituentProfiles(user.constituentId),
  ]);

  const fullName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.username || user.email;

  const authUser: AuthenticatedUser = {
    id: user.id,
    constituentId: user.constituentId,
    fullName,
    email: user.email,
    roles,
    profiles,
  };

  return authUser;
}

/**
 * Authenticates a user based on their username/email without password validation.
 * Used for token refresh operations.
 *
 * @param username The user's username or email.
 * @returns A promise that resolves to the fully constructed AuthenticatedUser.
 * @throws AppError if user is not found.
 */
export async function loginWithUsername(
  username: string,
): Promise<AuthenticatedUser> {
  const [user] = await pgPool.db
    .select({
      id: schema.Users.id,
      constituentId: schema.Constituents.id,
      email: schema.Users.email,
      username: schema.Users.username,
      firstName: schema.Constituents.firstName,
      lastName: schema.Constituents.lastName,
    })
    .from(schema.Users)
    .innerJoin(
      schema.Constituents,
      eq(schema.Users.constituentId, schema.Constituents.id),
    )
    .where(
      or(eq(schema.Users.username, username), eq(schema.Users.email, username)),
    );

  if (!user) {
    throw new AppError("User not found", 401);
  }

  const [roles, profiles] = await Promise.all([
    getConstituentRoles(user.constituentId),
    getConstituentProfiles(user.constituentId),
  ]);

  const fullName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.username || user.email;

  const authUser: AuthenticatedUser = {
    id: user.id,
    constituentId: user.constituentId,
    fullName,
    email: user.email,
    roles,
    profiles,
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
  await pgPool.db
    .update(Users)
    .set({ googleId: googleId })
    .where(eq(Users.id, userId));
}

/**
 * Initiates the password reset process by creating an OTP for the user.
 * Uses database transaction to ensure atomicity.
 *
 * @param email The user's email address.
 * @returns The generated OTP code.
 * @throws AppError if user is not found.
 */
export async function forgotPassword(email: string): Promise<string> {
  // Check if user exists
  const [user] = await pgPool.db
    .select({
      email: schema.Users.email,
    })
    .from(schema.Users)
    .where(eq(schema.Users.email, email));

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const otp = randomInt(100000, 1000000).toString();

  // Use transaction to ensure atomicity
  await pgPool.db.transaction(async (tx) => {
    // Delete any existing OTPs for this email
    await tx.delete(schema.Otps).where(eq(schema.Otps.email, email));

    // Insert new OTP that expires in 6 minutes (using database time)
    await tx.insert(schema.Otps).values({
      email,
      code: otp,
      expiresAt: sql`now() + interval '6 minutes'`,
    });
  });

  return otp;
}

/**
 * Resets a user's password using a valid OTP.
 * Uses database transaction to ensure atomicity of OTP validation, marking as used, and password update.
 *
 * @param email The user's email address.
 * @param otp The OTP code received via email.
 * @param newPassword The new password to set.
 * @throws AppError if user not found, OTP invalid/expired/used, or password update fails.
 */
export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> {
  await pgPool.db.transaction(async (tx) => {
    // Fetch the OTP record for validation
    const [otpRecord] = await tx
      .select()
      .from(schema.Otps)
      .where(eq(schema.Otps.email, email));

    // Validate OTP exists
    if (!otpRecord) {
      throw new AppError("Invalid OTP", 400);
    }

    // Validate OTP code matches
    if (otpRecord.code !== otp) {
      throw new AppError("Invalid OTP", 400);
    }

    // Validate OTP has not been used
    if (otpRecord.usedAt) {
      throw new AppError("OTP has already been used", 400);
    }

    // Validate OTP has not expired
    const now = new Date();
    const expiresAt = new Date(otpRecord.expiresAt);
    if (now > expiresAt) {
      throw new AppError("OTP has expired", 400);
    }

    // Mark OTP as used
    await tx
      .update(schema.Otps)
      .set({ usedAt: sql`now()` })
      .where(eq(schema.Otps.id, otpRecord.id));

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    const result = await tx
      .update(schema.Users)
      .set({ password: hashedPassword })
      .where(eq(schema.Users.email, email))
      .returning({ id: schema.Users.id });

    // Ensure user exists
    if (result.length === 0) {
      throw new AppError("User not found", 404);
    }
  });
}
