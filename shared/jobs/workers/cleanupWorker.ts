import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { lt, and, eq } from "drizzle-orm";
import logger from "@/configs/logger";
import type { Job } from "pg-boss";

export const cleanupWorker = {
  /**
   * Cleanup expired announcements
   * Runs daily at 2 AM (configured in scheduler)
   * Note: pg-boss 10.x passes an array of jobs to the handler
   */
  async cleanupExpiredAnnouncements(jobs: Job[]) {
    for (const job of jobs) {
      try {
        const now = new Date();

        // Archive expired announcements
        const result = await dbClient.db
          .update(schema.Announcements)
          .set({ status: "ARCHIVED" })
          .where(
            and(
              eq(schema.Announcements.status, "PUBLISHED"),
              lt(schema.Announcements.expiresAt, now),
            ),
          )
          .returning({ id: schema.Announcements.id });

        logger.info(
          {
            jobId: job.id,
            archivedCount: result.length,
          },
          "Cleaned up expired announcements",
        );
      } catch (error) {
        logger.error(
          { jobId: job.id, error },
          "Failed to cleanup expired announcements",
        );
        throw error;
      }
    }
  },
};
