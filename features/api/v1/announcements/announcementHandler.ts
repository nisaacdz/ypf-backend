import { CreateAnnouncementDto } from "./schemas";
import {
  createAnnouncement as createAnnouncementService,
  publishAnnouncement,
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
