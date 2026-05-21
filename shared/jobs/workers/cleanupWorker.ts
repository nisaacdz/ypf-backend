import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { lt, and, eq } from "drizzle-orm";
import logger from "@/configs/logger";
import type { Job } from "pg-boss";

// audit_logs grows indefinitely with every super-admin action. Keep one
// year by default — enough for any reasonable forensic review, short
// enough to keep the table fast and the backups small. Override via env
// when a longer retention is needed for compliance.
const AUDIT_LOG_RETENTION_DAYS = Number(
  process.env.AUDIT_LOG_RETENTION_DAYS ?? 365,
);

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

  /**
   * Trim audit_logs older than `AUDIT_LOG_RETENTION_DAYS`.
   * Runs daily at 2:30 AM (configured in scheduler).
   */
  async auditLogRetention(jobs: Job[]) {
    for (const job of jobs) {
      try {
        const cutoff = new Date(
          Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
        );
        const result = await dbClient.db
          .delete(schema.AuditLogs)
          .where(lt(schema.AuditLogs.createdAt, cutoff))
          .returning({ id: schema.AuditLogs.id });

        logger.info(
          {
            jobId: job.id,
            deleted: result.length,
            cutoff: cutoff.toISOString(),
          },
          "Audit-log retention sweep complete",
        );
      } catch (error) {
        logger.error(
          { jobId: job.id, error },
          "Audit-log retention sweep failed",
        );
        throw error;
      }
    }
  },
};
