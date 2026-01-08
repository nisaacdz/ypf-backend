import jobDispatcher from "./dispatcher";
import { JobNames } from "@/shared/jobs/types/definitions";
import { emailWorker } from "@/shared/jobs/workers/emailWorker";
import { announcementWorker } from "@/shared/jobs/workers/announcementWorker";
import { cleanupWorker } from "@/shared/jobs/workers/cleanupWorker";
import logger from "@/configs/logger";
import variables from "@/configs/env";

export async function startWorkers() {
  const boss = jobDispatcher.client;

  // Configure worker batch sizes based on environment
  const emailBatchSize = Math.max(2, Math.floor(variables.jobs.concurrency * 0.4));
  const announcementBatchSize = Math.max(2, Math.floor(variables.jobs.concurrency * 0.3));
  const cleanupBatchSize = 1;

  logger.info(
    {
      emailBatchSize,
      announcementBatchSize,
      cleanupBatchSize,
      totalConcurrency: variables.jobs.concurrency,
    },
    "Starting job workers",
  );

  // ========== Email Workers ==========
  await boss.work(
    JobNames.SEND_EMAIL,
    { batchSize: emailBatchSize },
    emailWorker.sendEmail,
  );

  await boss.work(
    JobNames.SEND_BULK_EMAIL,
    { batchSize: 2 },
    emailWorker.sendBulkEmail,
  );

  // ========== Announcement Workers ==========
  await boss.work(
    JobNames.PUBLISH_ANNOUNCEMENT,
    { batchSize: 1 },
    announcementWorker.publishAnnouncement,
  );

  await boss.work(
    JobNames.RESOLVE_ANNOUNCEMENT_AUDIENCE,
    { batchSize: announcementBatchSize },
    announcementWorker.resolveAudience,
  );

  await boss.work(
    JobNames.SEND_ANNOUNCEMENT_EMAILS,
    { batchSize: 2 },
    announcementWorker.sendEmails,
  );

  // ========== Cleanup Workers ==========
  await boss.work(
    JobNames.CLEANUP_EXPIRED_ANNOUNCEMENTS,
    { batchSize: cleanupBatchSize },
    cleanupWorker.cleanupExpiredAnnouncements,
  );

  await boss.work(
    JobNames.CLEANUP_OLD_JOBS,
    { batchSize: cleanupBatchSize },
    cleanupWorker.cleanupOldJobs,
  );

  // ========== Scheduled Jobs ==========
  // Daily at 2 AM (Ghana time)
  await boss.schedule(
    JobNames.CLEANUP_EXPIRED_ANNOUNCEMENTS,
    "0 2 * * *",
    {},
    { tz: "Africa/Accra" },
  );

  // Weekly on Monday at 9 AM (Ghana time)
  // Placeholder for weekly digest
  // await boss.schedule(
  //   JobNames.SEND_WEEKLY_DIGEST,
  //   "0 9 * * MON",
  //   {},
  //   { tz: "Africa/Accra" },
  // );

  logger.info("All job workers started and scheduled");
}
