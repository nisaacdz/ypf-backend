import logger from "@/configs/logger";
import type { Job } from "pg-boss";
import { runBackup } from "@/shared/services/backupService";

export const backupWorker = {
  /**
   * Monthly scheduled backup. Runs at 02:00 Ghana time on the 1st of every
   * month (configured in workers.ts). On failure, the backup row is
   * already flipped to FAILED with the error message by `runBackup`, so
   * we re-throw to let pg-boss retry per its default policy.
   */
  async monthly(jobs: Job[]) {
    for (const job of jobs) {
      try {
        const result = await runBackup({ trigger: "SCHEDULED" });
        logger.info(
          {
            jobId: job.id,
            backupId: result.id,
            sizeBytes: result.sizeBytes,
          },
          "Scheduled monthly backup succeeded",
        );
      } catch (err) {
        logger.error(
          { jobId: job.id, err },
          "Scheduled monthly backup failed",
        );
        throw err;
      }
    }
  },
};
