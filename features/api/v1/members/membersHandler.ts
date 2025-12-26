import * as membersService from "@/shared/services/membersService";
import { ApiResponse } from "@/shared/types";
import {
  GetMembersQuerySchema,
  EnrollMemberSchema,
  UnenrollMemberSchema,
  EnrollRoleSchema,
  UnenrollRoleSchema,
  GetRolesQuerySchema,
  GetLeadershipQuerySchema,
} from "./schemas";
import { Paginated } from "@/shared/dtos";
import { MemberRole, YPFMember, YPFMemberDetail } from "./dtos";
import z from "zod";

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

export async function enrollMember(
  body: z.infer<typeof EnrollMemberSchema>,
): Promise<ApiResponse<{ memberId: string }>> {
  const memberId = await membersService.enrollGlobal(
    body.constituentId,
    body.startedAt ? new Date(body.startedAt) : undefined,
  );
  return { success: true, data: { memberId } };
}

export async function unenrollMember(
  body: z.infer<typeof UnenrollMemberSchema>,
): Promise<ApiResponse<null>> {
  await membersService.unenrollGlobal(body.constituentId);
  return { success: true, data: null };
}

export async function getRoles(
  query: z.infer<typeof GetRolesQuerySchema>,
): Promise<ApiResponse<Paginated<MemberRole>>> {
  const data = await membersService.getRoles(query);
  return { success: true, data };
}

export async function getLeadership(
  query: z.infer<typeof GetLeadershipQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
  const data = await membersService.getLeadership(query);
  return { success: true, data };
}

export async function enrollRole(
  titleId: string,
  body: z.infer<typeof EnrollRoleSchema>,
): Promise<ApiResponse<{ assignmentId: string }>> {
  const assignmentId = await membersService.assignRole(
    body.constituentId,
    titleId,
    body.startedAt ? new Date(body.startedAt) : undefined,
  );
  return { success: true, data: { assignmentId } };
}

export async function unenrollRole(
  titleId: string,
  body: z.infer<typeof UnenrollRoleSchema>,
): Promise<ApiResponse<null>> {
  await membersService.unassignRole(body.constituentId, titleId);
  return { success: true, data: null };
}
