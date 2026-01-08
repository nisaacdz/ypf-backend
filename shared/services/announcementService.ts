import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { TargetingFilter } from "@/shared/types/targeting";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { JobNames, JobPriority } from "@/shared/jobs/types/definitions";
import logger from "@/configs/logger";

export type CreateAnnouncementInput = {
  title: string;
  content: string;
  targetCriteria: TargetingFilter;
  authorId: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt?: Date;
  expiresAt?: Date;
};

export async function createAnnouncement(input: CreateAnnouncementInput) {
  const [announcement] = await dbClient.db
    .insert(schema.Announcements)
    .values({
      title: input.title,
      content: input.content,
      targetCriteria: input.targetCriteria,
      authorId: input.authorId,
      status: input.status || "DRAFT",
      publishedAt: input.publishedAt,
      expiresAt: input.expiresAt,
    })
    .returning();

  return announcement;
}

/**
 * Queues announcement for publication via job system
 */
export async function publishAnnouncement(announcementId: string) {
  try {
    // Queue the job with high priority
    const jobId = await jobDispatcher.client.send(
      JobNames.PUBLISH_ANNOUNCEMENT,
      { announcementId },
      {
        priority: JobPriority.HIGH,
        retryLimit: 2,
        retryDelay: 300, // 5 minutes
        expireInHours: 24,
      },
    );

    logger.info(
      { announcementId, jobId },
      "Queued announcement for publishing",
    );

    return { jobId };
  } catch (error) {
    logger.error(
      { announcementId, error },
      "Failed to queue announcement for publishing",
    );
    throw error;
  }
}
