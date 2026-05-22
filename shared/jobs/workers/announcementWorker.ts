import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { resolveAudience } from "@/shared/services/targetResolver";
import { eq, inArray } from "drizzle-orm";
import logger from "@/configs/logger";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { JobNames, JobPriority } from "../types/definitions";
import type {
  AnnouncementJobData,
  SendAnnouncementEmailsJobData,
} from "../types/definitions";
import type { Job } from "pg-boss";
import { sendBulkSms } from "@/shared/utils/sms";
import { NOTIFICATION_CHANNELS } from "@/shared/utils/notify";

export const announcementWorker = {
  /**
   * Main job: Publishes an announcement
   * Orchestrates the sub-jobs for audience resolution and email sending
   * Note: pg-boss 10.x passes an array of jobs to the handler
   */
  async publishAnnouncement(jobs: Job<AnnouncementJobData>[]) {
    for (const job of jobs) {
      const { announcementId } = job.data;

      try {
        // 1. Fetch announcement
        const announcement = await dbClient.db.query.Announcements.findFirst({
          where: eq(schema.Announcements.id, announcementId),
        });

        if (!announcement) {
          throw new Error(`Announcement ${announcementId} not found`);
        }

        logger.info(
          { jobId: job.id, announcementId },
          "Starting announcement publication",
        );

        // 2. Spawn audience resolution job
        const audienceJobId = await jobDispatcher.client.send(
          JobNames.RESOLVE_ANNOUNCEMENT_AUDIENCE,
          { announcementId },
          {
            priority: JobPriority.HIGH,
          },
        );

        logger.info(
          {
            jobId: job.id,
            announcementId,
            audienceJobId,
          },
          "Spawned audience resolution job",
        );
      } catch (error) {
        logger.error(
          { jobId: job.id, announcementId, error },
          "Failed to publish announcement",
        );
        throw error;
      }
    }
  },

  /**
   * Sub-job: Resolves announcement audience and creates inbox entries
   * Note: pg-boss 10.x passes an array of jobs to the handler
   */
  async resolveAudience(jobs: Job<AnnouncementJobData>[]) {
    for (const job of jobs) {
      const { announcementId } = job.data;

      try {
        const announcement = await dbClient.db.query.Announcements.findFirst({
          where: eq(schema.Announcements.id, announcementId),
        });

        if (!announcement) {
          throw new Error(`Announcement ${announcementId} not found`);
        }

        // 1. Resolve target audience
        const constituentIds = await resolveAudience(
          announcement.targetCriteria,
        );

        if (constituentIds.length === 0) {
          logger.info(
            { jobId: job.id, announcementId },
            "No constituents found for announcement",
          );

          // Update status even if no recipients
          await dbClient.db
            .update(schema.Announcements)
            .set({ status: "PUBLISHED", publishedAt: new Date() })
            .where(eq(schema.Announcements.id, announcementId));

          continue;
        }

        logger.info(
          {
            jobId: job.id,
            announcementId,
            constituentCount: constituentIds.length,
          },
          "Resolved announcement audience",
        );

        // 2. Create ConstituentAnnouncements (inbox entries)
        const chunkSize = 1000;
        for (let i = 0; i < constituentIds.length; i += chunkSize) {
          const chunk = constituentIds.slice(i, i + chunkSize);
          const inboxEntries = chunk.map((cid) => ({
            announcementId: announcement.id,
            constituentId: cid,
            isRead: false,
            emailSent: false,
          }));

          await dbClient.db
            .insert(schema.ConstituentAnnouncements)
            .values(inboxEntries)
            .onConflictDoNothing()
            .execute();
        }

        logger.info(
          {
            jobId: job.id,
            announcementId,
            inboxEntriesCreated: constituentIds.length,
          },
          "Created inbox entries",
        );

        // 3. Fetch unique email + phone contact info
        const constituents = await dbClient.db
          .select({
            id: schema.Constituents.id,
            email: schema.Constituents.email,
            phone: schema.Constituents.phone,
            whatsapp: schema.Constituents.whatsapp,
          })
          .from(schema.Constituents)
          .where(inArray(schema.Constituents.id, constituentIds));

        // Deduplicate emails and filter out nulls
        const uniqueEmails = [
          ...new Set(
            constituents
              .map((c) => c.email)
              .filter((email): email is string => email !== null),
          ),
        ];

        // Build a deduped phone list. Prefer the explicit `phone` column and
        // fall back to `whatsapp`. Normalisation + dedup happens inside
        // sendBulkSms, so we can pass raw values here.
        const phoneList = constituents
          .map((c) => c.phone ?? c.whatsapp)
          .filter((p): p is string => typeof p === "string" && p.length > 0);

        logger.info(
          {
            jobId: job.id,
            announcementId,
            totalConstituents: constituents.length,
            uniqueEmails: uniqueEmails.length,
            phoneCandidates: phoneList.length,
          },
          "Deduplicated contact addresses",
        );

        // 4. Spawn email sending job
        if (uniqueEmails.length > 0) {
          await jobDispatcher.client.send(
            JobNames.SEND_ANNOUNCEMENT_EMAILS,
            {
              announcementId,
              recipientEmails: uniqueEmails,
            },
            {
              priority: JobPriority.NORMAL,
            },
          );
        }

        // 5. Best-effort bulk SMS broadcast. Channel mapping lives in
        // notify.NOTIFICATION_CHANNELS so the policy is centralised; we send
        // SMS only when the broadcast channel includes it. Arkesel handles
        // fan-out server-side, so no separate job queue is needed.
        const ch: string = NOTIFICATION_CHANNELS.bulkAnnouncement;
        if ((ch === "sms" || ch === "both") && phoneList.length > 0) {
          // Strip markdown for SMS — keep it short.
          const smsBody = `${announcement.title}\n\n${announcement.content
            .replace(/<[^>]+>/g, "")
            .replace(/[#*_>`]/g, "")
            .replace(/\s+/g, " ")
            .trim()}`.slice(0, 459);
          sendBulkSms(phoneList, smsBody, {
            event: "bulkAnnouncement",
          }).catch((err) => {
            logger.warn(
              { err, announcementId },
              "Bulk announcement SMS send failed (best-effort)",
            );
          });
        }

        // 5. Update announcement status
        await dbClient.db
          .update(schema.Announcements)
          .set({ status: "PUBLISHED", publishedAt: new Date() })
          .where(eq(schema.Announcements.id, announcementId));

        logger.info(
          { jobId: job.id, announcementId },
          "Announcement published successfully",
        );
      } catch (error) {
        logger.error(
          { jobId: job.id, announcementId, error },
          "Failed to resolve audience",
        );
        throw error;
      }
    }
  },

  /**
   * Sub-job: Sends announcement emails to recipients
   * Note: pg-boss 10.x passes an array of jobs to the handler
   *
   * Important: We only queue the bulk email job here. The emailSent flag
   * is NOT updated at this stage because emails haven't actually been sent.
   * To properly track email delivery status, implement delivery confirmation
   * in the email worker or use email service webhooks.
   */
  async sendEmails(jobs: Job<SendAnnouncementEmailsJobData>[]) {
    for (const job of jobs) {
      const { announcementId, recipientEmails } = job.data;

      try {
        const announcement = await dbClient.db.query.Announcements.findFirst({
          where: eq(schema.Announcements.id, announcementId),
        });

        if (!announcement) {
          throw new Error(`Announcement ${announcementId} not found`);
        }

        // Send via bulk email job
        await jobDispatcher.client.send(
          JobNames.SEND_BULK_EMAIL,
          {
            to: recipientEmails,
            subject: announcement.title,
            html: announcement.content,
          },
          {
            priority: JobPriority.NORMAL,
          },
        );

        // Note: We do NOT mark emailSent=true here because the emails
        // have only been queued, not actually sent. The emailSent flag
        // should only be updated after confirmed delivery.

        logger.info(
          {
            jobId: job.id,
            announcementId,
            recipientCount: recipientEmails.length,
          },
          "Announcement emails queued for sending",
        );
      } catch (error) {
        logger.error(
          {
            jobId: job.id,
            announcementId,
            error,
          },
          "Failed to queue announcement emails",
        );
        throw error;
      }
    }
  },
};
