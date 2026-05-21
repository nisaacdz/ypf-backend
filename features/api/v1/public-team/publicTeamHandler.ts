import z from "zod";
import { ApiResponse } from "@/shared/types";
import * as publicTeamService from "@/shared/services/publicTeamService";
import {
  CreateTeamMemberSchema,
  UpdateTeamMemberSchema,
  ReorderTeamSchema,
} from "./schemas";

export async function getPublicTeam(): Promise<
  ApiResponse<publicTeamService.PublicTeamMember[]>
> {
  const data = await publicTeamService.listPublicTeam({
    includeInactive: false,
  });
  return { success: true, message: "Public team fetched", data };
}

export async function getAdminTeam(): Promise<
  ApiResponse<publicTeamService.PublicTeamMember[]>
> {
  const data = await publicTeamService.listPublicTeam({ includeInactive: true });
  return { success: true, message: "Team fetched", data };
}

export async function createTeamMember(
  body: z.infer<typeof CreateTeamMemberSchema>,
): Promise<ApiResponse<string>> {
  const id = await publicTeamService.createPublicTeamMember({
    ...body,
    constituentId: body.constituentId ?? null,
  });
  return { success: true, message: "Team member created", data: id };
}

export async function updateTeamMember(
  id: string,
  body: z.infer<typeof UpdateTeamMemberSchema>,
): Promise<ApiResponse<null>> {
  await publicTeamService.updatePublicTeamMember(id, body);
  return { success: true, message: "Team member updated", data: null };
}

export async function deleteTeamMember(
  id: string,
): Promise<ApiResponse<null>> {
  await publicTeamService.deletePublicTeamMember(id);
  return { success: true, message: "Team member removed", data: null };
}

export async function uploadTeamPhoto(input: {
  id: string;
  file: Express.Multer.File;
  uploaderConstituentId: string;
}): Promise<ApiResponse<{ photoUrl: string }>> {
  const data = await publicTeamService.setTeamMemberPhoto({
    teamMemberId: input.id,
    uploaderConstituentId: input.uploaderConstituentId,
    file: input.file,
  });
  return { success: true, message: "Photo uploaded", data };
}

export async function reorderTeam(
  body: z.infer<typeof ReorderTeamSchema>,
): Promise<ApiResponse<null>> {
  await publicTeamService.reorderPublicTeam(body.items);
  return { success: true, message: "Team reordered", data: null };
}
