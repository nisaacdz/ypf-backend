import * as membersService from "@/shared/services/membersService";
import { ApiResponse } from "@/shared/types";
import { GetMembersQuerySchema } from "@/shared/validators/core";
import z from "zod";

export async function getMembers(
  query: z.infer<typeof GetMembersQuerySchema>,
): Promise<ApiResponse<Awaited<ReturnType<typeof membersService.getMembers>>>> {
  const data = await membersService.getMembers(query);
  return { success: true, data };
}
