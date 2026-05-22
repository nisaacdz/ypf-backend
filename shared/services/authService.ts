import { eq, or, sql, isNull, and, gte } from "drizzle-orm";
import bcrypt from "bcryptjs";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";
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
 * @throws ApiError if authentication fails.
 */
export async function loginWithUsernameAndPassword(
  username: string,
  password: string,
): Promise<AuthenticatedUser> {
  const [user] = await dbClient.db
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
    throw new ApiError("Invalid username or password", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError("Invalid username or password", 401);
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
 * @throws ApiError if user is not found.
 */
export async function loginWithUsername(
  username: string,
): Promise<AuthenticatedUser> {
  const [user] = await dbClient.db
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
    throw new ApiError("User not found", 401);
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
  await dbClient.db
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
 * @throws ApiError if user is not found.
 */
export async function forgotPassword(email: string): Promise<string> {
  // Check if user exists
  const [user] = await dbClient.db
    .select({
      email: schema.Users.email,
    })
    .from(schema.Users)
    .where(eq(schema.Users.email, email));

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  const otp = randomInt(100000, 1000000).toString();

  // Use transaction to ensure atomicity
  await dbClient.db.transaction(async (tx) => {
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
 * @throws ApiError if user not found, OTP invalid/expired/used, or password update fails.
 */
export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> {
  await dbClient.db.transaction(async (tx) => {
    const [otpRecord] = await tx
      .update(schema.Otps)
      .set({ usedAt: sql`now()` })
      .where(
        and(
          eq(schema.Otps.email, email),
          isNull(schema.Otps.usedAt),
          gte(schema.Otps.expiresAt, sql`now()`),
          eq(schema.Otps.code, otp),
        ),
      )
      .returning({ id: schema.Otps.id });

    if (!otpRecord) {
      throw new ApiError("Invalid OTP", 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await tx
      .update(schema.Users)
      .set({ password: hashedPassword })
      .where(eq(schema.Users.email, email))
      .returning({ id: schema.Users.id });

    if (result.length === 0) {
      throw new ApiError("User not found", 404);
    }
  });
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const [user] = await dbClient.db
    .select({
      id: schema.Users.id,
      password: schema.Users.password,
    })
    .from(schema.Users)
    .where(eq(schema.Users.id, userId));

  if (!user || !user.password) {
    throw new ApiError("User not found", 404);
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password,
  );

  if (!isCurrentPasswordValid) {
    throw new ApiError("Current password is incorrect", 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await dbClient.db
    .update(schema.Users)
    .set({ password: hashedPassword, updatedAt: new Date() })
    .where(eq(schema.Users.id, userId));
}

/**
 * Onboards a user by sending an OTP if they exist but have no auth method set.
 *
 * @param publicId The constituent's public ID (e.g., 'YPF-2024-ABC123').
 * @returns An object containing the generated OTP code and the user's email address.
 * @throws ApiError if user not found or already has an auth method.
 */
export async function onboardUser(
  publicId: string,
): Promise<{ otp: string; email: string }> {
  const [user] = await dbClient.db
    .select({
      id: schema.Users.id,
      email: schema.Users.email,
      password: schema.Users.password,
      googleId: schema.Users.googleId,
      appleId: schema.Users.appleId,
      facebookId: schema.Users.facebookId,
    })
    .from(schema.Users)
    .innerJoin(
      schema.Constituents,
      eq(schema.Users.constituentId, schema.Constituents.id),
    )
    .where(eq(schema.Constituents.publicId, publicId));

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Check if any auth method is already set
  if (user.password || user.googleId || user.appleId || user.facebookId) {
    throw new ApiError("User already has an authentication method set", 409);
  }

  const otp = randomInt(100000, 1000000).toString();
  const email = user.email!;

  // Use transaction to ensure atomicity
  await dbClient.db.transaction(async (tx) => {
    // Delete any existing OTPs for this email
    await tx.delete(schema.Otps).where(eq(schema.Otps.email, email));

    // Insert new OTP that expires in 6 minutes
    await tx.insert(schema.Otps).values({
      email,
      code: otp,
      expiresAt: sql`now() + interval '6 minutes'`,
    });
  });

  return { otp, email };
}

/**
 * Checks the onboarding status of a user by their public ID.
 *
 * @param publicId The constituent's public ID (e.g., 'YPF-2024-ABC123').
 * @returns An object with eligibility and a masked email if eligible.
 * @throws ApiError if user not found.
 */
export async function checkOnboardStatus(
  publicId: string,
): Promise<{ eligible: boolean; maskedEmail?: string; reason?: string }> {
  const [result] = await dbClient.db
    .select({
      eligible: sql<boolean>`(
        ${schema.Users.password} IS NULL AND
        ${schema.Users.googleId} IS NULL AND
        ${schema.Users.appleId} IS NULL AND
        ${schema.Users.facebookId} IS NULL
      )`,

      maskedEmail: sql<string>`
        CASE
          WHEN LENGTH(SPLIT_PART(${schema.Users.email}, '@', 1)) <= 2
            THEN SUBSTRING(${schema.Users.email} FROM 1 FOR 1) || '***@' || SPLIT_PART(${schema.Users.email}, '@', 2)
          ELSE
            SUBSTRING(${schema.Users.email} FROM 1 FOR 2) || '***@' || SPLIT_PART(${schema.Users.email}, '@', 2)
        END
      `,
    })
    .from(schema.Users)
    .innerJoin(
      schema.Constituents,
      eq(schema.Users.constituentId, schema.Constituents.id),
    )
    .where(eq(schema.Constituents.publicId, publicId))
    .limit(1);

  if (!result) {
    throw new ApiError("User not found", 404);
  }

  if (!result.eligible) {
    return { eligible: false, reason: "already_onboarded" };
  }

  return { eligible: true, maskedEmail: result.maskedEmail };
}
