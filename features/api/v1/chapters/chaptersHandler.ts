import * as chaptersService from "@/shared/services/chaptersService";
import { ApiResponse } from "@/shared/types";
import {
  GetChaptersQuerySchema,
  UpdateChapterSchema,
} from "@/shared/validators/core";
import { Paginated, YPFChapter, YPFChapterDetail } from "@/shared/dtos";
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
