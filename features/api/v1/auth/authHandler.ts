import * as authService from "@/shared/services/authService";
import * as constituentsService from "@/shared/services/constituentsService";
import { encodeData } from "@/shared/utils/jwt";
import { ApiResponse, ApiError, AuthenticatedUser } from "@/shared/types";
import { sendOtpEmail } from "@/shared/utils/email";
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  OnboardSchema,
} from "./schemas";
import { AuthData } from "./dtos";
import { z } from "zod";

/**
 * Authenticates a user with username and password.
 *
 * @param username - The username or email
 * @param password - The user's password
 * @returns Authentication response with tokens
 * @throws ApiError if credentials are invalid
 */
export async function loginWithUsernameAndPassword({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<{
  response: ApiResponse<AuthData>;
  accessToken: string;
}> {
  if (!username || !password) {
    throw new ApiError("Username and password are required", 400);
  }

  const authenticatedUser = await authService.loginWithUsernameAndPassword(
    username,
    password,
  );

  // Fetch detailed constituent info
  const constituentDetail = await constituentsService.getDetailedConstituent(
    authenticatedUser.constituentId,
  );

  if (!constituentDetail) throw new ApiError("Something went wrong"); // unexpected!

  const authData: AuthData = {
    ...constituentDetail,
    auth: authenticatedUser,
  };

  const accessToken = encodeData(authenticatedUser, { expiresIn: "3d" });

  return {
    response: {
      success: true,
      data: authData,
      message: "Login successful",
    },
    accessToken,
  };
}

/**
 * Initiates the forgot password flow by sending an OTP to the user's email.
 *
 * @param email - The user's email address
 * @returns Success response indicating OTP was sent
 * @throws ApiError if user not found
 */
export async function forgotPassword({
  email,
}: z.infer<typeof ForgotPasswordSchema>): Promise<ApiResponse<null>> {
  const otp = await authService.forgotPassword(email);

  await sendOtpEmail(email, otp);

  return {
    success: true,
    data: null,
    message: "Password reset code sent to your email",
  };
}

/**
 * Onboards a user by sending an OTP if they exist but have no auth method set.
 *
 * @param email - The user's email address
 * @returns Success response indicating OTP was sent
 * @throws ApiError if user not found or has auth method
 */
export async function onboard({
  user,
}: z.infer<typeof OnboardSchema>): Promise<ApiResponse<null>> {
  const { otp, email } = await authService.onboardUser(user);

  await sendOtpEmail(email, otp);

  return {
    success: true,
    data: null,
    message: "Onboarding verification code sent to your email",
  };
}

/**
 * Checks the onboarding status of a user by their public ID.
 *
 * @param publicId - The constituent's public ID
 * @returns Eligibility status and masked email if eligible
 * @throws ApiError if user not found
 */
export async function checkOnboardStatus(
  publicId: string,
): Promise<
  ApiResponse<{ eligible: boolean; maskedEmail?: string; reason?: string }>
> {
  const status = await authService.checkOnboardStatus(publicId);

  return {
    success: true,
    data: status,
    message: status.eligible
      ? "User is eligible for onboarding"
      : "User is already onboarded",
  };
}

/**
 * Resets the user's password using a valid OTP and logs them in.
 *
 * @param email - The user's email address
 * @param otp - The OTP code received via email
 * @param password - The new password
 * @returns Authentication response with tokens and user data
 * @throws ApiError if OTP is invalid, expired, or used
 */
export async function resetPassword({
  email,
  otp,
  password,
}: z.infer<typeof ResetPasswordSchema>): Promise<{
  response: ApiResponse<AuthData>;
  accessToken: string;
}> {
  await authService.resetPassword(email, otp, password);

  const authenticatedUser = await authService.loginWithUsername(email);

  const constituentDetail = await constituentsService.getDetailedConstituent(
    authenticatedUser.constituentId,
  );

  if (!constituentDetail) throw new ApiError("Something went wrong"); // unexpected!

  const authData: AuthData = {
    ...constituentDetail,
    auth: authenticatedUser,
  };

  const accessToken = encodeData(authenticatedUser, { expiresIn: "3d" });

  return {
    response: {
      success: true,
      data: authData,
      message: "Login successful",
    },
    accessToken,
  };
}

/**
 * Logs out the current user by clearing their session.
 *
 * @returns Success response
 */
export async function logout(): Promise<{
  response: ApiResponse<null>;
}> {
  return {
    response: {
      success: true,
      data: null,
      message: "User successfully logged out",
    },
  };
}

/**
 * Retrieves the currently authenticated user's profile detail.
 *
 * @param authenticatedUser - The authenticated user object from the request
 * @returns Response with detailed user profile
 * @throws ApiError if user detail retrieval fails
 */
export async function getMe(
  authenticatedUser: AuthenticatedUser,
): Promise<ApiResponse<AuthData>> {
  const constituentDetail = await constituentsService.getDetailedConstituent(
    authenticatedUser.constituentId,
  );

  if (!constituentDetail) {
    throw new ApiError("Failed to retrieve user profile.", 404);
  }

  const authData: AuthData = {
    ...constituentDetail,
    auth: authenticatedUser,
  };

  return {
    success: true,
    data: authData,
    message: "User profile retrieved successfully.",
  };
}

// export async function loginWithGoogleAuthCode({
//   code,
//   codeVerifier,
//   redirectUri,
// }: z.infer<typeof AuthCodeSchema>): Promise<{
//   response: ApiResponse<AuthenticatedUser>;
//   token: string;
// }> {
//   // 1. Exchange the authorization code for tokens from Google
//   const tokens = await authorizationCodeGrant(
//     oauthConfig.google,
//     new URL(`https://example.com?code=${code}`),
//     { pkceCodeVerifier: codeVerifier },
//     { redirect_uri: redirectUri },
//   );

//   const claims = tokens.claims();
//   if (!claims || !claims.sub || !claims.email) {
//     throw new ApiError(
//       "Failed to retrieve complete user claims from Google",
//       500,
//     );
//   }

//   const googleId = claims.sub;
//   const email = String(claims.email);

//   // 2. Find the user in our database by their email
//   const user = await usersService.findUserByEmail(email);

//   // 3. Apply business logic: User must be pre-registered by an admin
//   if (!user) {
//     throw new ApiError(
//       "User not found. Please contact an administrator to create an account.",
//       404,
//     );
//   }

//   // 4. Link Google ID on first login or verify it on subsequent logins
//   if (!user.googleId) {
//     await authService.linkGoogleIdToUser(user.id, googleId);
//   } else if (user.googleId !== googleId) {
//     throw new ApiError(
//       "This email is already associated with a different Google account.",
//       409,
//     );
//   }

//   // 5. Construct the AuthenticatedUser object, mirroring the password login flow
//   const [roles, memberships] = await Promise.all([
//     usersService.getUserRoles(user.id),
//     usersService.getUserMemberships(user.id),
//   ]);

//   const fullName =
//     user.firstName && user.lastName
//       ? `${user.firstName} ${user.lastName}`
//       : user.username || user.email;

//   const authenticatedUser: AuthenticatedUser = {
//     id: user.id,
//     fullName,
//     email: user.email,
//     roles,
//     memberships,
//   };

//   // 6. Generate JWT and prepare the final response
//   const token = encodeData(authenticatedUser);

//   return {
//     response: {
//       success: true,
//       data: authenticatedUser,
//       message: "Google login successful",
//     },
//     token,
//   };
// }
