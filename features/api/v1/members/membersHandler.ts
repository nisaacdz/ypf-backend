import * as membersService from "@/shared/services/membersService";
import { ApiResponse } from "@/shared/types";
import { GetMembersQuerySchema } from "@/shared/validators/core";
import { Paginated, YPFMember, YPFMemberDetail } from "@/shared/dtos";
import z from "zod";
import { createMemberSchema } from "./schema";

export async function getMembers(
  query: z.infer<typeof GetMembersQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
  const data = await membersService.getMembers(query);
  return { success: true, data };
}

export async function getMember(
  constituentId: string,
): Promise<ApiResponse<YPFMemberDetail>> {
  const data = await membersService.getMemberByConstituentId(constituentId);
  return { success: true, data };
}

export async function createMember(
  input: z.infer<typeof createMemberSchema>
): Promise<ApiResponse<any>> {
  const member = await membersService.createMember(input);
  return { success: true, message: "Member created successfully", data: member };
}

export async function deleteMember(
  id: string
): Promise<ApiResponse<null>> {
  await membersService.deleteMember(id);
  return { success: true, message: "Member deactivated successfully", data: null };
}
