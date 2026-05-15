import { CreateAnnouncementDto } from "./schemas";
import {
  createAnnouncement as createAnnouncementService,
  publishAnnouncement,
  getConstituentAnnouncements,
} from "@/shared/services/announcementService";
import logger from "@/configs/logger";
import { ApiResponse } from "@/shared/types";

export async function createAnnouncement(
  data: CreateAnnouncementDto,
  authorId: string,
): Promise<ApiResponse<{ announcementId: string }>> {
  const { title, content, targetCriteria, status } = data;

  const announcement = await createAnnouncementService({
    title,
    content,
    targetCriteria,
    authorId,
    status: status as "DRAFT" | "PUBLISHED",
    publishedAt: status === "PUBLISHED" ? new Date() : undefined,
  });

  if (status === "PUBLISHED") {
    publishAnnouncement(announcement.id).catch((err) => {
      logger.error(err, `Failed to publish announcement ${announcement.id}`);
    });
  }

  return {
    success: true,
    message: "Announcement created successfully",
    data: { announcementId: announcement.id },
  };
}

export async function listMyAnnouncements(
  constituentId: string,
  query: { page?: number; pageSize?: number },
): Promise<ApiResponse<Awaited<ReturnType<typeof getConstituentAnnouncements>>>> {
  const data = await getConstituentAnnouncements(constituentId, query);
  return {
    success: true,
    message: "Announcements fetched successfully",
    data,
  };
}
