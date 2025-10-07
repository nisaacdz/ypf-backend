import * as usersService from "@/shared/services/usersService";
import { ApiResponse } from "@/shared/types";

export async function getUserData({ userId }: { userId: string }) {
  const user = await usersService.getUserById(userId);
  const response: ApiResponse<typeof user> = { success: true, data: user };
  return response;
}
