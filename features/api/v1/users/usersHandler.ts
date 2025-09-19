import * as usersService from "@/shared/services/usersService";
import { ApiResponse } from "@/shared/types";
import { User } from "@/db/schema/app";

export async function getUserData({
  userId,
}: {
  userId: string;
}): Promise<ApiResponse<User>> {
  const user = await usersService.getUserById(userId);
  return { success: true, data: user };
}
