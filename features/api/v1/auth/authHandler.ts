import * as authService from "@/shared/services/authService";
import { encodeData } from "@/shared/utils/jwt";
import { ApiResponse, AppError } from "@/shared/types";
import { AuthenticatedUser } from "@/shared/types";

export async function loginWithUsernameAndPassword({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<{
  response: ApiResponse<AuthenticatedUser>;
  accessToken: string;
  refreshToken: string;
}> {
  if (!username || !password) {
    throw new AppError("Username and password are required", 400);
  }

  const authenticatedUser = await authService.loginWithUsernameAndPassword(
    username,
    password,
  );

  const accessToken = encodeData(authenticatedUser, { expiresIn: "30m" });
  const refreshToken = encodeData(
    { username: authenticatedUser.email || username },
    { expiresIn: "3d" },
  );

  return {
    response: {
      success: true,
      data: authenticatedUser,
      message: "Login successful",
    },
    accessToken,
    refreshToken,
  };
}

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
//     throw new AppError(
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
//     throw new AppError(
//       "User not found. Please contact an administrator to create an account.",
//       404,
//     );
//   }

//   // 4. Link Google ID on first login or verify it on subsequent logins
//   if (!user.googleId) {
//     await authService.linkGoogleIdToUser(user.id, googleId);
//   } else if (user.googleId !== googleId) {
//     throw new AppError(
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
