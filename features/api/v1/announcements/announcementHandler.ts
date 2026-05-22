import { CreateAnnouncementDto, UpdateAnnouncementDto } from "./schemas";
import {
  createAnnouncement as createAnnouncementService,
  publishAnnouncement,
  getConstituentAnnouncements,
  getConstituentAnnouncementById,
  markConstituentAnnouncementRead,
  updateAnnouncement as updateAnnouncementService,
  archiveAnnouncement,
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

export async function getMyAnnouncement(
  constituentId: string,
  announcementId: string,
): Promise<ApiResponse<Awaited<ReturnType<typeof getConstituentAnnouncementById>>>> {
  const data = await getConstituentAnnouncementById(
    constituentId,
    announcementId,
  );
  return {
    success: true,
    message: "Announcement fetched successfully",
    data,
  };
}

export async function markRead(
  constituentId: string,
  announcementId: string,
): Promise<ApiResponse<null>> {
  await markConstituentAnnouncementRead(constituentId, announcementId);
  return {
    success: true,
    message: "Announcement marked as read",
    data: null,
  };
}

export async function updateAnnouncement(
  announcementId: string,
  data: UpdateAnnouncementDto,
): Promise<ApiResponse<{ announcementId: string }>> {
  const { expiresAt, ...updates } = data;
  await updateAnnouncementService(announcementId, {
    ...updates,
    expiresAt:
      expiresAt === undefined
        ? undefined
        : expiresAt === null
          ? null
          : new Date(expiresAt),
    publishedAt: updates.status === "PUBLISHED" ? new Date() : undefined,
  });
  return {
    success: true,
    message: "Announcement updated successfully",
    data: { announcementId },
  };
}

export async function deleteAnnouncement(
  announcementId: string,
): Promise<ApiResponse<null>> {
  await archiveAnnouncement(announcementId);
  return {
    success: true,
    message: "Announcement archived successfully",
    data: null,
  };
}
