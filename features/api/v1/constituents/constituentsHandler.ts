import { ApiResponse } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import { Member } from "@/shared/dtos/core";
import { GetMembersQuerySchema } from "@/shared/validators/core";
import z from "zod";

export async function getMembers(
  query: z.infer<typeof GetMembersQuerySchema>
): Promise<ApiResponse<Paginated<Member>>> {
  console.log("Query:", query);
  return { success: true, data: { data: [], page: 1, pageSize: 10, total: 0 } };
}
