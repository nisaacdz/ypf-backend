import * as membersService from "@/shared/services/membersService";
import { ApiResponse } from "@/shared/types";
import { GetMembersQuerySchema } from "@/shared/validators/core";
import { Paginated, YPFMember, MemberDetail } from "@/shared/dtos";
import z from "zod";

export async function getMembers(
  query: z.infer<typeof GetMembersQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
  const data = await membersService.getMembers(query);
  return { success: true, data };
}

export async function getMember(
  memberId: string,
): Promise<ApiResponse<MemberDetail>> {
  const data = await membersService.getMemberById(memberId);
  return { success: true, data };
}
