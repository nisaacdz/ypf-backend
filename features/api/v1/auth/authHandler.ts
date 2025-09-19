import * as loginService from "@/shared/services/authService";
import { encodeData } from "@/shared/utils/jwt";
import { ApiResponse, AppError } from "@/shared/types";
import { AuthenticatedUser } from "@/shared/validators";

export async function loginWithUsernameAndPassword({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<{ response: ApiResponse<AuthenticatedUser>; token: string }> {
  if (!username || !password) {
    throw new AppError("Username and password are required", 400);
  }

  const authenticatedUser = await loginService.loginWithUsernameAndPassword(
    username,
    password,
  );

  const token = encodeData(authenticatedUser);

  return {
    response: {
      success: true,
      data: authenticatedUser,
      message: "Login successful",
    },
    token,
  };
}

export async function loginWithGoogleAuthCode({ code }: { code: string }): Promise<{ response: ApiResponse<AuthenticatedUser>; token: string }> {
  // todo
  return "" as any
}