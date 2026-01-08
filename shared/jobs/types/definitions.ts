/**
 * Central registry of all job names in the system
 */
export const JobNames = {
  // Email Jobs
  SEND_EMAIL: "send-email",
  SEND_BULK_EMAIL: "send-bulk-email",

  // Announcement Jobs
  PUBLISH_ANNOUNCEMENT: "publish-announcement",
  RESOLVE_ANNOUNCEMENT_AUDIENCE: "resolve-announcement-audience",
  SEND_ANNOUNCEMENT_EMAILS: "send-announcement-emails",

  // Cleanup Jobs
  CLEANUP_EXPIRED_ANNOUNCEMENTS: "cleanup-expired-announcements",
  CLEANUP_OLD_JOBS: "cleanup-old-jobs",

  // Periodic Jobs
  SEND_WEEKLY_DIGEST: "send-weekly-digest",
  GENERATE_MONTHLY_REPORT: "generate-monthly-report",
} as const;

export type JobName = (typeof JobNames)[keyof typeof JobNames];

/**
 * Job data type definitions
 */
export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  priority?: "high" | "normal" | "low";
}

export interface BulkEmailJobData {
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface AnnouncementJobData {
  announcementId: string;
}

export interface SendAnnouncementEmailsJobData {
  announcementId: string;
  recipientEmails: string[];
}

/**
 * Job priority levels
 */
export enum JobPriority {
  CRITICAL = 1, // OTP emails, password resets
  HIGH = 2, // Transactional emails (donations, orders)
  NORMAL = 5, // Announcements
  LOW = 10, // Digests, reports
}

/**
 * Job options type
 */
export interface JobOptions {
  priority?: number;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  expireInHours?: number;
  singletonKey?: string;
  singletonSeconds?: number;
}
