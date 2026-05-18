import * as committeesService from "@/shared/services/committeesService";
import * as mediaUtils from "@/shared/utils/files";
import * as mediaService from "@/shared/services/mediaService";
import { ApiResponse } from "@/shared/types";
import {
  GetCommitteesQuerySchema,
  GetConstituentCommitteesQuerySchema,
  GetCommitteeLeadershipQuerySchema,
  EnrollCommitteeSchema,
  UnenrollCommitteeSchema,
  GetCommitteeMediaQuerySchema,
  UpdateCommitteeMediumSchema,
} from "./schemas";
import { Paginated } from "@/shared/dtos";
import { YPFCommittee, YPFCommitteeDetail } from "./dtos";
import { YPFMember } from "@/features/api/v1/members/dtos";
import z from "zod";

export async function getCommittees(
  query: z.infer<typeof GetCommitteesQuerySchema>,
): Promise<ApiResponse<Paginated<YPFCommittee>>> {
  const data = await committeesService.getCommittees(query);
  return { success: true, data };
}

export async function getCommittee(
  committeeId: string,
): Promise<ApiResponse<YPFCommitteeDetail>> {
  const data = await committeesService.getCommitteeById(committeeId);
  return { success: true, data };
}

export async function getCommitteesByConstituentId(
  constituentId: string,
  query: z.infer<typeof GetConstituentCommitteesQuerySchema>,
): Promise<ApiResponse<Paginated<YPFCommittee>>> {
  const data = await committeesService.getCommitteesByConstituentId(
    constituentId,
    query,
  );
  return { success: true, data };
}

export async function getLeadership(
  committeeId: string,
  query: z.infer<typeof GetCommitteeLeadershipQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
  const data = await committeesService.getCommitteeLeadership(
    committeeId,
    query,
  );
  return { success: true, data };
}

export async function enrollToCommittee(
  committeeId: string,
  body: z.infer<typeof EnrollCommitteeSchema>,
): Promise<ApiResponse<{ membershipId: string }>> {
  const membershipId = await committeesService.enrollToCommittee(
    committeeId,
    body.constituentId,
    body.startedAt ? new Date(body.startedAt) : undefined,
    body.titleAlias,
  );
  return { success: true, data: { membershipId } };
}

export async function unenrollFromCommittee(
  committeeId: string,
  body: z.infer<typeof UnenrollCommitteeSchema>,
): Promise<ApiResponse<null>> {
  await committeesService.unenrollFromCommittee(
    committeeId,
    body.constituentId,
  );
  return { success: true, data: null };
}

// ─── Committee media handlers (Phase 1.3) ───────────────────────────────────

export async function uploadCommitteeMedium({
  constituentId,
  committeeId,
  file,
  options,
}: {
  constituentId: string;
  committeeId: string;
  file: Express.Multer.File;
  options: { caption?: string; isFeatured: boolean };
}): Promise<ApiResponse<string>> {
  const uploadMeta = await mediaUtils.storeMediumFile(file);

  try {
    const newMediumId = await mediaService.uploadCommitteeMedium(committeeId, {
      caption: options.caption,
      isFeatured: options.isFeatured,
      medium: {
        ...uploadMeta,
        uploadedBy: constituentId,
      },
    });

    return {
      success: true,
      message: "Media uploaded successfully",
      data: newMediumId,
    };
  } catch (error) {
    await mediaUtils.deleteMediumFile(uploadMeta.externalId);
    throw error;
  }
}

export async function getCommitteeMedia(
  committeeId: string,
  query: z.infer<typeof GetCommitteeMediaQuerySchema>,
): Promise<ApiResponse<Paginated<unknown>>> {
  const { page, pageSize } = query;
  const { items, total } = await committeesService.fetchCommitteeMedia(
    committeeId,
    { page, pageSize },
  );
  return {
    success: true,
    message: "Committee media fetched successfully",
    data: { items, page, pageSize, total },
  };
}

export async function updateCommitteeMedium(
  committeeId: string,
  mediumId: string,
  body: z.infer<typeof UpdateCommitteeMediumSchema>,
): Promise<ApiResponse<null>> {
  await committeesService.updateCommitteeMedium(committeeId, mediumId, body);
  return {
    success: true,
    message: "Committee medium updated successfully",
    data: null,
  };
}

export async function deleteCommitteeMedium(
  committeeId: string,
  mediumId: string,
): Promise<ApiResponse<null>> {
  await committeesService.removeCommitteeMedium(committeeId, mediumId);
  return {
    success: true,
    message: "Committee medium removed",
    data: null,
  };
}
