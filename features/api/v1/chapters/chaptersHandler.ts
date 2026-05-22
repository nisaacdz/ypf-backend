import * as chaptersService from "@/shared/services/chaptersService";
import * as mediaUtils from "@/shared/utils/files";
import * as mediaService from "@/shared/services/mediaService";
import type { ChapterRoleAlias, ChapterRoleHolder } from "@/shared/services/chaptersService";
import { ApiResponse } from "@/shared/types";
import {
  AssignChapterRoleSchema,
  CreateChapterSchema,
  GetChaptersQuerySchema,
  GetConstituentChaptersQuerySchema,
  UpdateChapterSchema,
  GetChapterLeadershipQuerySchema,
  EnrollChapterSchema,
  UnenrollChapterSchema,
  GetChapterMediaQuerySchema,
  UpdateChapterMediumSchema,
} from "./schemas";
import { Paginated } from "@/shared/dtos";
import { YPFChapter, YPFChapterDetail } from "./dtos";
import { YPFMember } from "@/features/api/v1/members/dtos";
import z from "zod";

export async function getChapters(
  query: z.infer<typeof GetChaptersQuerySchema>,
): Promise<ApiResponse<Paginated<YPFChapter>>> {
  const data = await chaptersService.getChapters(query);
  return { success: true, data };
}

export async function getChapter(
  chapterId: string,
): Promise<ApiResponse<YPFChapterDetail>> {
  const data = await chaptersService.getChapterById(chapterId);
  return { success: true, data };
}

export async function createChapter(
  body: z.infer<typeof CreateChapterSchema>,
): Promise<ApiResponse<string>> {
  const chapter = await chaptersService.createChapter(body);
  return { success: true, data: chapter.id };
}

export async function updateChapter(
  chapterId: string,
  updates: z.infer<typeof UpdateChapterSchema>,
): Promise<ApiResponse<string>> {
  const updatedChapter = await chaptersService.updateChapter(
    chapterId,
    updates,
  );
  return { success: true, data: updatedChapter.id };
}

export async function archiveChapter(chapterId: string): Promise<ApiResponse<null>> {
  await chaptersService.archiveChapter(chapterId);
  return { success: true, data: null };
}

export async function getChaptersByConstituentId(
  constituentId: string,
  query: z.infer<typeof GetConstituentChaptersQuerySchema>,
): Promise<ApiResponse<Paginated<YPFChapter>>> {
  const data = await chaptersService.getChaptersByConstituentId(
    constituentId,
    query,
  );
  return { success: true, data };
}

export async function getLeadership(
  chapterId: string,
  query: z.infer<typeof GetChapterLeadershipQuerySchema>,
): Promise<ApiResponse<Paginated<YPFMember>>> {
  const data = await chaptersService.getChapterLeadership(chapterId, query);
  return { success: true, data };
}

export async function enrollToChapter(
  chapterId: string,
  body: z.infer<typeof EnrollChapterSchema>,
): Promise<ApiResponse<{ membershipId: string }>> {
  const membershipId = await chaptersService.enrollToChapter(
    chapterId,
    body.constituentId,
    body.startedAt ? new Date(body.startedAt) : undefined,
  );
  return { success: true, data: { membershipId } };
}

export async function unenrollFromChapter(
  chapterId: string,
  body: z.infer<typeof UnenrollChapterSchema>,
): Promise<ApiResponse<null>> {
  await chaptersService.unenrollFromChapter(chapterId, body.constituentId);
  return { success: true, data: null };
}

export async function getChapterRoles(
  chapterId: string,
): Promise<ApiResponse<ChapterRoleHolder[]>> {
  const data = await chaptersService.getChapterRoles(chapterId);
  return { success: true, data };
}

export async function assignChapterRole(
  chapterId: string,
  roleAlias: ChapterRoleAlias,
  body: z.infer<typeof AssignChapterRoleSchema>,
): Promise<ApiResponse<ChapterRoleHolder>> {
  const holder = await chaptersService.assignChapterRole(
    chapterId,
    roleAlias,
    body.constituentId,
  );
  return { success: true, data: holder };
}

export async function clearChapterRole(
  chapterId: string,
  roleAlias: ChapterRoleAlias,
): Promise<ApiResponse<null>> {
  await chaptersService.clearChapterRole(chapterId, roleAlias);
  return { success: true, data: null };
}

// ─── Chapter media handlers (Phase 1.2) ─────────────────────────────────────

export async function uploadChapterMedium({
  constituentId,
  chapterId,
  file,
  options,
}: {
  constituentId: string;
  chapterId: string;
  file: Express.Multer.File;
  options: { caption?: string; isFeatured: boolean };
}): Promise<ApiResponse<string>> {
  const uploadMeta = await mediaUtils.storeMediumFile(file);

  try {
    const newMediumId = await mediaService.uploadChapterMedium(chapterId, {
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

export async function getChapterMedia(
  chapterId: string,
  query: z.infer<typeof GetChapterMediaQuerySchema>,
): Promise<ApiResponse<Paginated<unknown>>> {
  const { page, pageSize } = query;
  const { items, total } = await chaptersService.fetchChapterMedia(chapterId, {
    page,
    pageSize,
  });
  return {
    success: true,
    message: "Chapter media fetched successfully",
    data: { items, page, pageSize, total },
  };
}

export async function updateChapterMedium(
  chapterId: string,
  mediumId: string,
  body: z.infer<typeof UpdateChapterMediumSchema>,
): Promise<ApiResponse<null>> {
  await chaptersService.updateChapterMedium(chapterId, mediumId, body);
  return {
    success: true,
    message: "Chapter medium updated successfully",
    data: null,
  };
}

export async function deleteChapterMedium(
  chapterId: string,
  mediumId: string,
): Promise<ApiResponse<null>> {
  await chaptersService.removeChapterMedium(chapterId, mediumId);
  return {
    success: true,
    message: "Chapter medium removed",
    data: null,
  };
}
