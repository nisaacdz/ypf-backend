import { sendEmail } from "@/shared/utils/email";
import logger from "@/configs/logger";
import type { EmailJobData, BulkEmailJobData } from "../types/definitions";
import type { Job } from "pg-boss";

// Delay between batches to respect SMTP rate limits (in milliseconds)
const BATCH_DELAY_MS = 1000;

// Maximum recipients per batch (adjust based on SMTP provider limits)
const EMAIL_BATCH_SIZE = 100;

export const emailWorker = {
  /**
   * Sends a single email or email to multiple recipients
   * Note: pg-boss 10.x passes an array of jobs to the handler
   */
  async sendEmail(jobs: Job<EmailJobData>[]) {
    for (const job of jobs) {
      const { to, subject, html, text } = job.data;

      try {
        await sendEmail(to, subject, html, text, false);
        logger.info(
          {
            jobId: job.id,
            recipients: Array.isArray(to) ? to.length : 1,
          },
          "Email sent successfully",
        );
      } catch (error) {
        logger.error(
          {
            jobId: job.id,
            error,
            recipients: Array.isArray(to) ? to.length : 1,
          },
          "Failed to send email",
        );
        throw error; // Trigger retry
      }
    }
  },

  /**
   * Sends bulk emails in batches using BCC
   * Note: pg-boss 10.x passes an array of jobs to the handler
   */
  async sendBulkEmail(jobs: Job<BulkEmailJobData>[]) {
    for (const job of jobs) {
      const { to, subject, html, text } = job.data;

      if (!Array.isArray(to) || to.length === 0) {
        throw new Error(
          `Bulk email job ${job.id} requires a non-empty array of recipient email addresses in the 'to' field`,
        );
      }

      let sentCount = 0;

      try {
        for (let i = 0; i < to.length; i += EMAIL_BATCH_SIZE) {
          const batch = to.slice(i, i + EMAIL_BATCH_SIZE);

          await sendEmail(batch, subject, html, text, true); // BCC mode
          sentCount += batch.length;

          // Small delay between batches to respect rate limits
          if (i + EMAIL_BATCH_SIZE < to.length) {
            await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
          }
        }

        logger.info(
          {
            jobId: job.id,
            totalRecipients: to.length,
            batches: Math.ceil(to.length / EMAIL_BATCH_SIZE),
          },
          "Bulk email sent successfully",
        );
      } catch (error) {
        logger.error(
          {
            jobId: job.id,
            sentCount,
            totalRecipients: to.length,
            error,
          },
          "Failed to send bulk email",
        );
        throw error; // Trigger retry
      }
    }
  },
};
