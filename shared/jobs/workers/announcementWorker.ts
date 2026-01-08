import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { resolveAudience } from "@/shared/services/targetResolver";
import { and, eq, inArray } from "drizzle-orm";
import logger from "@/configs/logger";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { JobNames, JobPriority } from "../types/definitions";
import type {
  AnnouncementJobData,
  SendAnnouncementEmailsJobData,
} from "../types/definitions";
import type { Job } from "pg-boss";

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

        // 3. Fetch unique email addresses
        const constituents = await dbClient.db
          .select({
            id: schema.Constituents.id,
            email: schema.Constituents.email,
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

        logger.info(
          {
            jobId: job.id,
            announcementId,
            totalConstituents: constituents.length,
            uniqueEmails: uniqueEmails.length,
          },
          "Deduplicated email addresses",
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

        // Mark emails as sent only for constituents whose email is in recipientEmails
        // First, get the constituent IDs for the emails that were sent
        const constituentsWithEmails = await dbClient.db
          .select({ id: schema.Constituents.id })
          .from(schema.Constituents)
          .where(inArray(schema.Constituents.email, recipientEmails));

        const constituentIds = constituentsWithEmails.map((c) => c.id);

        if (constituentIds.length > 0) {
          await dbClient.db
            .update(schema.ConstituentAnnouncements)
            .set({ emailSent: true })
            .where(
              and(
                eq(
                  schema.ConstituentAnnouncements.announcementId,
                  announcementId,
                ),
                inArray(
                  schema.ConstituentAnnouncements.constituentId,
                  constituentIds,
                ),
              ),
            );
        }

        logger.info(
          {
            jobId: job.id,
            announcementId,
            recipientCount: recipientEmails.length,
            markedCount: constituentIds.length,
          },
          "Announcement emails sent",
        );
      } catch (error) {
        logger.error(
          {
            jobId: job.id,
            announcementId,
            error,
          },
          "Failed to send announcement emails",
        );
        throw error;
      }
    }
  },
};
