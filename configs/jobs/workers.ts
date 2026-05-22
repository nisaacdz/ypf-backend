import jobDispatcher from "./dispatcher";
import { JobNames } from "@/shared/jobs/types/definitions";
import { emailWorker } from "@/shared/jobs/workers/emailWorker";
import { announcementWorker } from "@/shared/jobs/workers/announcementWorker";
import { cleanupWorker } from "@/shared/jobs/workers/cleanupWorker";
import { reportWorker } from "@/shared/jobs/workers/reportWorker";
import { birthdayWorker } from "@/shared/jobs/workers/birthdayWorker";
import { backupWorker } from "@/shared/jobs/workers/backupWorker";
import logger from "@/configs/logger";
import variables from "@/configs/env";

export async function startWorkers() {
  const boss = jobDispatcher.client;

  // Configure worker batch sizes based on environment
  const emailBatchSize = Math.max(
    2,
    Math.floor(variables.jobs.concurrency * 0.4),
  );
  const announcementBatchSize = Math.max(
    2,
    Math.floor(variables.jobs.concurrency * 0.3),
  );
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

  //await Promise.all(Object.values(JobNames).map((jobName) => boss.createQueue(jobName)))
  // It doesn't like deadlocks
  for (const jobName of Object.values(JobNames)) {
    await boss.createQueue(jobName);
  }

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
    JobNames.AUDIT_LOG_RETENTION,
    { batchSize: cleanupBatchSize },
    cleanupWorker.auditLogRetention,
  );

  // ========== Report Workers ==========
  await boss.work(
    JobNames.GENERATE_MONTHLY_REPORT,
    { batchSize: 1 },
    reportWorker.generateMonthlyReport,
  );

  // ========== Birthday Workers ==========
  await boss.work(
    JobNames.BIRTHDAY_TICK,
    { batchSize: 1 },
    birthdayWorker.tick,
  );

  // ========== Backup Workers ==========
  await boss.work(
    JobNames.DATABASE_BACKUP,
    { batchSize: 1 },
    backupWorker.monthly,
  );

  // ========== Scheduled Jobs ==========
  // Daily at 2 AM (Ghana time) — expire stale announcements
  await boss.schedule(
    JobNames.CLEANUP_EXPIRED_ANNOUNCEMENTS,
    "0 2 * * *",
    {},
    { tz: "Africa/Accra" },
  );

  // Daily at 2:30 AM — trim audit_logs past retention.
  await boss.schedule(
    JobNames.AUDIT_LOG_RETENTION,
    "30 2 * * *",
    {},
    { tz: "Africa/Accra" },
  );

  // Monthly on the 1st at 3 AM — analytics report
  await boss.schedule(
    JobNames.GENERATE_MONTHLY_REPORT,
    "0 3 1 * *",
    {},
    { tz: "Africa/Accra" },
  );

  // Daily at 6 AM (Ghana time) — birthday heads-up + day-of notifications.
  await boss.schedule(
    JobNames.BIRTHDAY_TICK,
    "0 6 * * *",
    {},
    { tz: "Africa/Accra" },
  );

  // Monthly on the 1st at 02:00 Ghana time — full database backup.
  await boss.schedule(
    JobNames.DATABASE_BACKUP,
    "0 2 1 * *",
    {},
    { tz: "Africa/Accra" },
  );

  logger.info("All job workers started and scheduled");
}
