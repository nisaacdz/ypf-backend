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
  constituentId: string,
): Promise<ApiResponse<MemberDetail>> {
  const data = await membersService.getMemberByConstituentId(constituentId);
  return { success: true, data };
}
