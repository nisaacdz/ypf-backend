# pg-boss Scheduled Jobs: Detailed Implementation Plan

**Date:** January 7, 2026  
**Project:** YPF Backend  
**Status:** Implementation Ready  
**Based On:** `scheduled-jobs-integration.md`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Pre-Implementation Setup](#pre-implementation-setup)
3. [Libraries & Dependencies](#libraries--dependencies)
4. [Database Schema Changes](#database-schema-changes)
5. [Architecture Overview](#architecture-overview)
6. [Implementation Steps](#implementation-steps)
7. [Code Snippets - Complete Implementation](#code-snippets---complete-implementation)
8. [External Infrastructure & Settings](#external-infrastructure--settings)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Checklist](#deployment-checklist)
11. [Monitoring & Operations](#monitoring--operations)
12. [Rollback Strategy](#rollback-strategy)

---

## Executive Summary

This document provides a **complete, actionable implementation plan** for integrating pg-boss into the YPF Backend. Following this plan, the team can implement scheduled jobs without blockers.

### Key Decisions

- **Job Queue Solution:** pg-boss (PostgreSQL-based)
- **Schema Location:** `app` schema (all pg-boss tables)
- **Runtime:** Same process as API initially (can be separated later)
- **Migration Strategy:** Update 0001 migration (pre-production)

### Implementation Timeline

- **Phase 1:** Core Infrastructure (1-2 days)
- **Phase 2:** Announcement Jobs (1-2 days)
- **Phase 3:** Email Queue (1 day)
- **Phase 4:** Scheduled Tasks & Testing (1-2 days)

---

## Pre-Implementation Setup

### 1. Verify Current System

```bash
# Check Node.js version (requires Node 18+)
node --version

# Check PostgreSQL version (requires PostgreSQL 12+)
psql $DATABASE_URL -c "SELECT version();"

# Verify current schema
psql $DATABASE_URL -c "\dn"
```

### 2. Backup Existing Database

```bash
# Create backup before schema changes
pg_dump $DATABASE_URL > backups/pre-pgboss-$(date +%Y%m%d).sql
```

### 3. Review Current Migration

```bash
# Examine 0001 migration that will be updated
cat db/migrations/0001_lazy_pretty_boy.sql
```

---

## Libraries & Dependencies

### Install Required Packages

```bash
npm install pg-boss@10.1.5
npm install --save-dev @types/pg-boss@9.0.6
```

### Package Versions & Justification

| Package          | Version | Reason                                                |
| ---------------- | ------- | ----------------------------------------------------- |
| `pg-boss`        | 10.1.5  | Latest stable, TypeScript support, active maintenance |
| `@types/pg-boss` | 9.0.6   | TypeScript definitions                                |

### Updated package.json

```json
{
  "dependencies": {
    "pg-boss": "^10.1.5"
    // ... existing dependencies
  },
  "devDependencies": {
    "@types/pg-boss": "^9.0.6"
    // ... existing devDependencies
  }
}
```

---

## Database Schema Changes

### Overview

pg-boss creates its own tables. We'll configure it to use the `app` schema instead of the default `pgboss` schema.

### Migration Updates

**File: `db/migrations/0001_lazy_pretty_boy.sql`**

Add this at the **end** of the 0001 migration:

```sql
-- ============================================
-- pg-boss Job Queue Tables
-- ============================================
-- pg-boss will auto-create these tables in the app schema
-- We just ensure the app schema exists and has proper permissions
-- The tables will be created by pg-boss on first initialization

-- Create indexes for announcement audience resolution optimization
CREATE INDEX IF NOT EXISTS idx_chapter_memberships_member_chapter
  ON core.chapter_memberships(member_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_committee_memberships_member_committee
  ON core.committee_memberships(member_id, committee_id);

CREATE INDEX IF NOT EXISTS idx_member_titles_assignments_member_title
  ON core.member_titles_assignments(member_id, title_id);

CREATE INDEX IF NOT EXISTS idx_members_constituent_ended
  ON core.members(constituent_id, ended_at);

-- Optimize job queue queries on announcements
CREATE INDEX IF NOT EXISTS idx_announcements_status_expires
  ON activities.announcements(status, expires_at);

-- Index for constituent email lookups (used in announcement emails)
CREATE INDEX IF NOT EXISTS idx_constituents_email
  ON core.constituents(email);
```

### pg-boss Auto-Created Tables

When pg-boss initializes, it will create the following tables in the `app` schema:

```sql
-- app.job - Main job queue table
-- app.archive - Completed/failed jobs archive
-- app.version - pg-boss version tracking
-- app.schedule - Cron job schedules
```

**Note:** These are managed by pg-boss automatically. Do NOT manually create them.

---

## Architecture Overview

### System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        YPF Backend Application                   │
│                                                                  │
│  ┌────────────────┐         ┌──────────────┐                   │
│  │  Express API   │         │  Socket.IO   │                   │
│  │   Handlers     │         │    Server    │                   │
│  └────────┬───────┘         └──────┬───────┘                   │
│           │                         │                           │
│           └────────┬────────────────┘                           │
│                    │                                            │
│           ┌────────▼────────────┐                               │
│           │  Job Dispatcher     │◄──────────────────────┐       │
│           │   (pg-boss client)  │                       │       │
│           └────────┬────────────┘                       │       │
│                    │                                    │       │
│                    │  Sends Jobs                        │       │
│                    ▼                                    │       │
│           ┌────────────────────┐                        │       │
│           │   PostgreSQL       │                        │       │
│           │   app.job table    │                        │       │
│           │   (job queue)      │                        │       │
│           └────────┬───────────┘                        │       │
│                    │                                    │       │
│                    │  Polls for jobs                    │       │
│                    ▼                                    │       │
│           ┌────────────────────┐                        │       │
│           │   Job Workers      │                        │       │
│           │  (same runtime)    │                        │       │
│           │                    │                        │       │
│           │ • Email Worker     │────────────────────────┘       │
│           │ • Announcement     │                                │
│           │ • Cleanup Worker   │                                │
│           └────────┬───────────┘                                │
│                    │                                            │
│                    │                                            │
└────────────────────┼────────────────────────────────────────────┘
                     │
                     ▼
              ┌──────────────┐
              │  SMTP Server │
              │  (Nodemailer)│
              └──────────────┘
```

### Component Flow

1. **API Request** → Handler calls service
2. **Service** → Queues job via Job Dispatcher
3. **Job Dispatcher** → Inserts job into PostgreSQL
4. **Job Worker** → Polls PostgreSQL for jobs
5. **Job Worker** → Executes job handler
6. **Job Handler** → Performs work (email, DB update, etc.)
7. **Result** → Marks job as complete or failed

---

## Implementation Steps

### Phase 1: Core Infrastructure

#### Step 1.1: Create Job Configuration Files

Create directory structure:

```bash
mkdir -p /home/runner/work/ypf-backend/ypf-backend/configs/jobs
mkdir -p /home/runner/work/ypf-backend/ypf-backend/shared/jobs/workers
mkdir -p /home/runner/work/ypf-backend/ypf-backend/shared/jobs/types
```

#### Step 1.2: Install Dependencies

```bash
cd /home/runner/work/ypf-backend/ypf-backend
npm install pg-boss@10.1.5 @types/pg-boss@9.0.6
```

#### Step 1.3: Update Environment Variables

Add to `.env.example` and `.env`:

```bash
# Job Queue Configuration
JOB_CONCURRENCY=5           # Number of concurrent job workers
JOB_RETENTION_DAYS=7        # Keep completed jobs for 7 days
JOB_RETRY_LIMIT=3           # Retry failed jobs 3 times
JOB_RETRY_DELAY=60          # Wait 60 seconds before retry (in seconds)
JOB_ARCHIVE_HOURS=24        # Move completed jobs to archive after 24 hours
```

#### Step 1.4: Update `configs/env.ts`

Add job configuration to environment schema:

```typescript
// Add to envSchema
JOB_CONCURRENCY: z.coerce.number().positive().default(5),
JOB_RETENTION_DAYS: z.coerce.number().positive().default(7),
JOB_RETRY_LIMIT: z.coerce.number().nonnegative().default(3),
JOB_RETRY_DELAY: z.coerce.number().positive().default(60),
JOB_ARCHIVE_HOURS: z.coerce.number().positive().default(24),
```

```typescript
// Add to transform section
jobs: {
  concurrency: env.JOB_CONCURRENCY,
  retentionDays: env.JOB_RETENTION_DAYS,
  retryLimit: env.JOB_RETRY_LIMIT,
  retryDelay: env.JOB_RETRY_DELAY,
  archiveHours: env.JOB_ARCHIVE_HOURS,
},
```

#### Step 1.5: Update Database Migration

Edit `db/migrations/0001_lazy_pretty_boy.sql` to add the indexes mentioned in the "Database Schema Changes" section.

### Phase 2: Job Dispatcher & Workers

See "Code Snippets - Complete Implementation" section below for full code.

### Phase 3: Integration with Existing Services

See "Code Snippets - Complete Implementation" section below.

### Phase 4: Testing & Validation

See "Testing Strategy" section below.

---

## Code Snippets - Complete Implementation

### 1. Job Dispatcher (`configs/jobs/dispatcher.ts`)

```typescript
import PgBoss from "pg-boss";
import variables from "@/configs/env";
import logger from "@/configs/logger";

class JobDispatcher {
  private boss: PgBoss | null = null;

  async initialize() {
    if (this.boss) {
      logger.warn("Job dispatcher already initialized");
      return;
    }

    this.boss = new PgBoss({
      connectionString: variables.database.url,
      schema: "app", // Use app schema, not default pgboss
      retryLimit: variables.jobs.retryLimit,
      retryDelay: variables.jobs.retryDelay,
      retryBackoff: true,
      expireInHours: variables.jobs.archiveHours,
      deleteAfterDays: variables.jobs.retentionDays,
      monitorStateIntervalSeconds: 60,
      maintenanceIntervalSeconds: 300, // 5 minutes
      archiveCompletedAfterSeconds: variables.jobs.archiveHours * 3600,
      // Performance tuning
      noScheduling: false, // Enable cron scheduling
      noSupervisor: false, // Enable job supervision
      newJobCheckInterval: 2000, // Check for new jobs every 2 seconds
      newJobCheckIntervalSeconds: 2,
    });

    this.boss.on("error", (error) => {
      logger.error(error, "pg-boss error");
    });

    this.boss.on("maintenance", () => {
      logger.debug("pg-boss maintenance started");
    });

    this.boss.on("monitor-states", (states) => {
      logger.debug({ states }, "pg-boss monitor states");
    });

    await this.boss.start();
    logger.info("Job dispatcher initialized with pg-boss");
  }

  async shutdown() {
    if (this.boss) {
      await this.boss.stop({ timeout: 30000 }); // 30 second graceful shutdown
      logger.info("Job dispatcher shut down gracefully");
      this.boss = null;
    }
  }

  get client() {
    if (!this.boss) {
      throw new Error(
        "Job dispatcher not initialized. Call initialize() first.",
      );
    }
    return this.boss;
  }
}

const jobDispatcher = new JobDispatcher();

export default jobDispatcher;
```

### 2. Job Definitions (`shared/jobs/types/definitions.ts`)

```typescript
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
```

### 3. Email Worker (`shared/jobs/workers/emailWorker.ts`)

```typescript
import { sendEmail } from "@/shared/utils/email";
import logger from "@/configs/logger";
import type { EmailJobData, BulkEmailJobData } from "../types/definitions";
import type { Job } from "pg-boss";

export const emailWorker = {
  /**
   * Sends a single email or email to multiple recipients
   */
  async sendEmail(job: Job<EmailJobData>) {
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
  },

  /**
   * Sends bulk emails in batches using BCC
   */
  async sendBulkEmail(job: Job<BulkEmailJobData>) {
    const { to, subject, html, text } = job.data;

    if (!Array.isArray(to) || to.length === 0) {
      throw new Error("Bulk email requires non-empty array of recipients");
    }

    const batchSize = 100; // Adjust based on SMTP provider limits
    let sentCount = 0;

    try {
      for (let i = 0; i < to.length; i += batchSize) {
        const batch = to.slice(i, i + batchSize);

        await sendEmail(batch, subject, html, text, true); // BCC mode
        sentCount += batch.length;

        // Small delay between batches to respect rate limits
        if (i + batchSize < to.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.info(
        {
          jobId: job.id,
          totalRecipients: to.length,
          batches: Math.ceil(to.length / batchSize),
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
  },
};
```

### 4. Announcement Worker (`shared/jobs/workers/announcementWorker.ts`)

```typescript
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

export const announcementWorker = {
  /**
   * Main job: Publishes an announcement
   * Orchestrates the sub-jobs for audience resolution and email sending
   */
  async publishAnnouncement(job: Job<AnnouncementJobData>) {
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
  },

  /**
   * Sub-job: Resolves announcement audience and creates inbox entries
   */
  async resolveAudience(job: Job<AnnouncementJobData>) {
    const { announcementId } = job.data;

    try {
      const announcement = await dbClient.db.query.Announcements.findFirst({
        where: eq(schema.Announcements.id, announcementId),
      });

      if (!announcement) {
        throw new Error(`Announcement ${announcementId} not found`);
      }

      // 1. Resolve target audience
      const constituentIds = await resolveAudience(announcement.targetCriteria);

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

        return;
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

      // Deduplicate emails
      const uniqueEmails = [...new Set(constituents.map((c) => c.email))];

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
  },

  /**
   * Sub-job: Sends announcement emails to recipients
   */
  async sendEmails(job: Job<SendAnnouncementEmailsJobData>) {
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

      // Mark emails as sent for all constituents
      await dbClient.db
        .update(schema.ConstituentAnnouncements)
        .set({ emailSent: true })
        .where(
          eq(schema.ConstituentAnnouncements.announcementId, announcementId),
        );

      logger.info(
        {
          jobId: job.id,
          announcementId,
          recipientCount: recipientEmails.length,
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
  },
};
```

### 5. Cleanup Worker (`shared/jobs/workers/cleanupWorker.ts`)

```typescript
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { lt, and, eq } from "drizzle-orm";
import logger from "@/configs/logger";
import type { Job } from "pg-boss";

export const cleanupWorker = {
  /**
   * Cleanup expired announcements
   * Runs daily at 2 AM (configured in scheduler)
   */
  async cleanupExpiredAnnouncements(job: Job) {
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
  },

  /**
   * Cleanup old completed jobs
   * pg-boss has built-in cleanup, but this is for custom logic
   */
  async cleanupOldJobs(job: Job) {
    try {
      // pg-boss handles this automatically with `deleteAfterDays` config
      // This is placeholder for any custom cleanup logic
      logger.info({ jobId: job.id }, "Job cleanup completed");
    } catch (error) {
      logger.error({ jobId: job.id, error }, "Failed to cleanup old jobs");
      throw error;
    }
  },
};
```

### 6. Worker Registry (`configs/jobs/workers.ts`)

```typescript
import jobDispatcher from "./dispatcher";
import { JobNames } from "@/shared/jobs/types/definitions";
import { emailWorker } from "@/shared/jobs/workers/emailWorker";
import { announcementWorker } from "@/shared/jobs/workers/announcementWorker";
import { cleanupWorker } from "@/shared/jobs/workers/cleanupWorker";
import logger from "@/configs/logger";
import variables from "@/configs/env";

export async function startWorkers() {
  const boss = jobDispatcher.client;

  // Configure worker concurrency based on environment
  const emailConcurrency = Math.max(
    2,
    Math.floor(variables.jobs.concurrency * 0.4),
  );
  const announcementConcurrency = Math.max(
    2,
    Math.floor(variables.jobs.concurrency * 0.3),
  );
  const cleanupConcurrency = 1;

  logger.info(
    {
      emailConcurrency,
      announcementConcurrency,
      cleanupConcurrency,
      totalConcurrency: variables.jobs.concurrency,
    },
    "Starting job workers",
  );

  // ========== Email Workers ==========
  await boss.work(
    JobNames.SEND_EMAIL,
    { teamSize: emailConcurrency, teamConcurrency: 2 },
    emailWorker.sendEmail,
  );

  await boss.work(
    JobNames.SEND_BULK_EMAIL,
    { teamSize: 2, teamConcurrency: 1 },
    emailWorker.sendBulkEmail,
  );

  // ========== Announcement Workers ==========
  await boss.work(
    JobNames.PUBLISH_ANNOUNCEMENT,
    { teamSize: 1, teamConcurrency: 1 },
    announcementWorker.publishAnnouncement,
  );

  await boss.work(
    JobNames.RESOLVE_ANNOUNCEMENT_AUDIENCE,
    { teamSize: announcementConcurrency, teamConcurrency: 1 },
    announcementWorker.resolveAudience,
  );

  await boss.work(
    JobNames.SEND_ANNOUNCEMENT_EMAILS,
    { teamSize: 2, teamConcurrency: 1 },
    announcementWorker.sendEmails,
  );

  // ========== Cleanup Workers ==========
  await boss.work(
    JobNames.CLEANUP_EXPIRED_ANNOUNCEMENTS,
    { teamSize: cleanupConcurrency, teamConcurrency: 1 },
    cleanupWorker.cleanupExpiredAnnouncements,
  );

  await boss.work(
    JobNames.CLEANUP_OLD_JOBS,
    { teamSize: cleanupConcurrency, teamConcurrency: 1 },
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
```

### 7. Export Index (`configs/jobs/index.ts`)

```typescript
export { default as jobDispatcher } from "./dispatcher";
export { startWorkers } from "./workers";
```

### 8. Update `app.ts` for Initialization

```typescript
import variables from "@/configs/env";
import emailer from "@/configs/emailer";
import dbClient from "./configs/db";
import logger from "@/configs/logger";
import server from "@/configs/server";
import redisClient from "./configs/redis";
import jobDispatcher from "@/configs/jobs/dispatcher"; // ADD THIS
import { startWorkers } from "@/configs/jobs/workers"; // ADD THIS

async function shutdown() {
  logger.info("Shutting down server...");

  try {
    // Shut down job dispatcher first
    await jobDispatcher.shutdown(); // ADD THIS
    logger.info("Job dispatcher stopped.");

    emailer.transporter.close();
    await dbClient.pool.end({ timeout: 5 });
    logger.info("Database pool closed.");
  } catch (error) {
    logger.error(error, "Error during shutdown");
  }

  server.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });

  // Force exit after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
}

(async () => {
  try {
    // Initialize all services
    await Promise.all([
      emailer.initialize(),
      dbClient.initialize(),
      redisClient.initialize(),
      jobDispatcher.initialize(), // ADD THIS
    ]);

    // Start job workers AFTER all services are initialized
    await startWorkers(); // ADD THIS

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.on(signal, shutdown);
    }

    server.listen(variables.app.port, () => {
      logger.info(
        `Server is live on http://${variables.app.host}:${variables.app.port}`,
      );
    });
  } catch (error) {
    logger.error(error, "Failed to initialize server");
    process.exit(1); // Fail fast
  }
})();
```

### 9. Update Announcement Service (`shared/services/announcementService.ts`)

```typescript
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { TargetingFilter } from "@/shared/types/targeting";
import jobDispatcher from "@/configs/jobs/dispatcher"; // ADD THIS
import { JobNames, JobPriority } from "@/shared/jobs/types/definitions"; // ADD THIS
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
```

### 10. Job Management API Endpoints (Optional but Recommended)

Create `features/api/v1/jobs/index.ts`:

```typescript
import { Router } from "express";
import { authenticate } from "@/shared/middlewares/authenticate";
import { authorize } from "@/shared/middlewares/authorize";
import { Visitors } from "@/configs/authorizer";
import * as jobHandler from "./jobHandler";

const router = Router();

// All job management endpoints require admin access
router.use(authenticate);
router.use(authorize(Visitors.hasProfile("ADMIN")));

// Get job statistics
router.get("/stats", jobHandler.getJobStats);

// Get jobs by status
router.get("/list", jobHandler.listJobs);

// Get specific job details
router.get("/:jobId", jobHandler.getJob);

// Retry a failed job
router.post("/:jobId/retry", jobHandler.retryJob);

// Cancel a scheduled job
router.post("/:jobId/cancel", jobHandler.cancelJob);

export default router;
```

Create `features/api/v1/jobs/jobHandler.ts`:

```typescript
import { Request, Response } from "express";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { ApiError } from "@/shared/types";
import logger from "@/configs/logger";

export async function getJobStats(req: Request, res: Response) {
  try {
    // Get queue sizes for different states
    const [created, active, completed, expired, cancelled, failed] =
      await Promise.all([
        jobDispatcher.client.getQueueSize("*", "created"),
        jobDispatcher.client.getQueueSize("*", "active"),
        jobDispatcher.client.getQueueSize("*", "completed"),
        jobDispatcher.client.getQueueSize("*", "expired"),
        jobDispatcher.client.getQueueSize("*", "cancelled"),
        jobDispatcher.client.getQueueSize("*", "failed"),
      ]);

    res.json({
      success: true,
      data: {
        queued: created,
        active,
        completed,
        expired,
        cancelled,
        failed,
        total: created + active + completed + expired + cancelled + failed,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to get job stats");
    throw new ApiError(500, "Failed to retrieve job statistics");
  }
}

export async function listJobs(req: Request, res: Response) {
  try {
    const { state = "active", limit = 50 } = req.query;

    const jobs = await jobDispatcher.client.fetch("*", Number(limit), {
      state: state as string,
    });

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    logger.error({ error }, "Failed to list jobs");
    throw new ApiError(500, "Failed to retrieve jobs");
  }
}

export async function getJob(req: Request, res: Response) {
  try {
    const { jobId } = req.params;

    const job = await jobDispatcher.client.getJobById(jobId);

    if (!job) {
      throw new ApiError(404, "Job not found");
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error({ error }, "Failed to get job");
    throw new ApiError(500, "Failed to retrieve job");
  }
}

export async function retryJob(req: Request, res: Response) {
  try {
    const { jobId } = req.params;

    await jobDispatcher.client.resume(jobId);

    res.json({
      success: true,
      message: "Job retry initiated",
    });
  } catch (error) {
    logger.error({ error, jobId: req.params.jobId }, "Failed to retry job");
    throw new ApiError(500, "Failed to retry job");
  }
}

export async function cancelJob(req: Request, res: Response) {
  try {
    const { jobId } = req.params;

    await jobDispatcher.client.cancel(jobId);

    res.json({
      success: true,
      message: "Job cancelled successfully",
    });
  } catch (error) {
    logger.error({ error, jobId: req.params.jobId }, "Failed to cancel job");
    throw new ApiError(500, "Failed to cancel job");
  }
}
```

Register the jobs router in your main API router (e.g., `features/api/v1/index.ts`):

```typescript
import jobsRouter from "./jobs";

// ... other imports

router.use("/jobs", jobsRouter);
```

---

## External Infrastructure & Settings

### 1. Environment Variables

Update your `.env` file with these new variables:

```bash
# Job Queue Configuration
JOB_CONCURRENCY=5
JOB_RETENTION_DAYS=7
JOB_RETRY_LIMIT=3
JOB_RETRY_DELAY=60
JOB_ARCHIVE_HOURS=24
```

### 2. PostgreSQL Configuration

**Recommended Settings for Production:**

```sql
-- Check current settings
SHOW max_connections;
SHOW shared_buffers;
SHOW work_mem;

-- Recommended adjustments (depends on your server resources)
-- These are typically set in postgresql.conf

max_connections = 100              -- Ensure enough for app + pg-boss
shared_buffers = 256MB            -- At least 25% of RAM
work_mem = 4MB                    -- Per-operation memory
maintenance_work_mem = 64MB       -- For vacuuming
effective_cache_size = 1GB        -- Expected OS cache
```

### 3. Database Connection Pool

pg-boss creates its own connection pool. Ensure your total connections don't exceed PostgreSQL's `max_connections`:

```
Total Connections = App Pool (10) + pg-boss Pool (default 10) + Reserved (20) = ~40
```

If you're hitting connection limits, adjust:

```typescript
// In configs/db.ts
this._pool = postgres(variables.database.url, {
  max: 8, // Reduce from 10
  idle_timeout: 20,
  connect_timeout: 10,
});

// In configs/jobs/dispatcher.ts
this.boss = new PgBoss({
  // ... other options
  max: 8, // Add explicit pool size
});
```

### 4. SMTP Provider Configuration

Ensure your SMTP provider allows:

- **Rate Limit**: Adjust `emailWorker` batch size based on your provider
  - Gmail: 500 emails/day (free), 2000/day (workspace)
  - SendGrid: Based on plan (100/day free, unlimited paid)
  - AWS SES: Based on sending limits
- **Batch Sending**: If your provider supports BCC, you're good. Otherwise, adjust the bulk email worker.

### 5. Monitoring & Alerts

**Recommended Monitoring:**

1. **Job Queue Depth**
   - Alert if `created` jobs > 1000
   - Alert if `failed` jobs > 50

2. **Job Processing Time**
   - Track average job duration
   - Alert if p95 > 30 seconds

3. **Worker Health**
   - Monitor pg-boss `monitor-states` events
   - Alert if no jobs processed in 10 minutes

**Implementation** (using existing logger):

```typescript
// Add to configs/jobs/dispatcher.ts
this.boss.on("monitor-states", (states) => {
  const failedCount = states.failed || 0;
  const createdCount = states.created || 0;

  if (failedCount > 50) {
    logger.warn({ failedCount }, "High number of failed jobs detected");
    // TODO: Send alert to team (email, Slack, etc.)
  }

  if (createdCount > 1000) {
    logger.warn({ createdCount }, "High number of queued jobs detected");
    // TODO: Send alert to team
  }
});
```

### 6. Backup Strategy

**pg-boss Tables are in `app` Schema:**

Your existing database backup strategy automatically includes job queue tables. No additional backup configuration needed.

**Retention:**

- Completed jobs: 24 hours (then archived)
- Archived jobs: 7 days (then deleted)
- Failed jobs: 7 days (for debugging)

### 7. Horizontal Scaling (Future)

**Current:** Single instance (API + Workers in same process)

**Future:** Separate worker processes

```yaml
# docker-compose.yml example
services:
  api:
    image: ypf-backend
    environment:
      - WORKERS_ENABLED=false
    ports:
      - "3000:3000"

  worker:
    image: ypf-backend
    command: node dist/worker.js
    environment:
      - WORKERS_ENABLED=true
      - API_ENABLED=false
    deploy:
      replicas: 3
```

You would need to create `worker.js`:

```typescript
// worker.js - Dedicated worker process
import jobDispatcher from "@/configs/jobs/dispatcher";
import { startWorkers } from "@/configs/jobs/workers";
import dbClient from "@/configs/db";
import emailer from "@/configs/emailer";
import redisClient from "@/configs/redis";
import logger from "@/configs/logger";

(async () => {
  try {
    await Promise.all([
      dbClient.initialize(),
      emailer.initialize(),
      redisClient.initialize(),
      jobDispatcher.initialize(),
    ]);

    await startWorkers();

    logger.info("Worker process started");
  } catch (error) {
    logger.error(error, "Failed to start worker process");
    process.exit(1);
  }
})();
```

---

## Testing Strategy

### 1. Unit Tests

Create `tests/unit/jobs/emailWorker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailWorker } from "@/shared/jobs/workers/emailWorker";
import * as emailUtils from "@/shared/utils/email";
import type { Job } from "pg-boss";

describe("emailWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      const sendEmailSpy = vi
        .spyOn(emailUtils, "sendEmail")
        .mockResolvedValue();

      const job: Job = {
        id: "test-job-id",
        data: {
          to: "test@example.com",
          subject: "Test Subject",
          html: "<p>Test Content</p>",
        },
      } as Job;

      await emailWorker.sendEmail(job);

      expect(sendEmailSpy).toHaveBeenCalledWith(
        "test@example.com",
        "Test Subject",
        "<p>Test Content</p>",
        undefined,
        false,
      );
    });

    it("should throw error and trigger retry on failure", async () => {
      vi.spyOn(emailUtils, "sendEmail").mockRejectedValue(
        new Error("SMTP error"),
      );

      const job: Job = {
        id: "test-job-id",
        data: {
          to: "test@example.com",
          subject: "Test Subject",
          html: "<p>Test Content</p>",
        },
      } as Job;

      await expect(emailWorker.sendEmail(job)).rejects.toThrow("SMTP error");
    });
  });

  describe("sendBulkEmail", () => {
    it("should send bulk emails in batches", async () => {
      const sendEmailSpy = vi
        .spyOn(emailUtils, "sendEmail")
        .mockResolvedValue();

      const recipients = Array.from(
        { length: 250 },
        (_, i) => `user${i}@example.com`,
      );

      const job: Job = {
        id: "test-job-id",
        data: {
          to: recipients,
          subject: "Bulk Test",
          html: "<p>Bulk Content</p>",
        },
      } as Job;

      await emailWorker.sendBulkEmail(job);

      // Should be called 3 times (100 + 100 + 50)
      expect(sendEmailSpy).toHaveBeenCalledTimes(3);
    });

    it("should throw error if recipients array is empty", async () => {
      const job: Job = {
        id: "test-job-id",
        data: {
          to: [],
          subject: "Test",
          html: "<p>Content</p>",
        },
      } as Job;

      await expect(emailWorker.sendBulkEmail(job)).rejects.toThrow(
        "Bulk email requires non-empty array of recipients",
      );
    });
  });
});
```

### 2. Integration Tests

Create `tests/integration/jobs.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jobDispatcher from "@/configs/jobs/dispatcher";
import { JobNames } from "@/shared/jobs/types/definitions";
import dbClient from "@/configs/db";

describe("Job Queue Integration", () => {
  beforeAll(async () => {
    await dbClient.initialize();
    await jobDispatcher.initialize();
  });

  afterAll(async () => {
    await jobDispatcher.shutdown();
    await dbClient.pool.end();
  });

  it("should queue and retrieve email job", async () => {
    const jobId = await jobDispatcher.client.send(JobNames.SEND_EMAIL, {
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe("string");

    // Retrieve the job
    const job = await jobDispatcher.client.getJobById(jobId);
    expect(job).toBeDefined();
    expect(job?.name).toBe(JobNames.SEND_EMAIL);
    expect(job?.data.to).toBe("test@example.com");
  });

  it("should handle job priority", async () => {
    const highPriorityJobId = await jobDispatcher.client.send(
      JobNames.SEND_EMAIL,
      { to: "test@example.com", subject: "High", html: "<p>High</p>" },
      { priority: 1 },
    );

    const lowPriorityJobId = await jobDispatcher.client.send(
      JobNames.SEND_EMAIL,
      { to: "test@example.com", subject: "Low", html: "<p>Low</p>" },
      { priority: 10 },
    );

    const highJob = await jobDispatcher.client.getJobById(highPriorityJobId);
    const lowJob = await jobDispatcher.client.getJobById(lowPriorityJobId);

    expect(highJob?.priority).toBe(1);
    expect(lowJob?.priority).toBe(10);
  });
});
```

### 3. Manual Testing Checklist

- [ ] Start server and verify pg-boss tables created in `app` schema
- [ ] Create announcement and verify job is queued
- [ ] Monitor logs for job processing
- [ ] Verify emails are sent
- [ ] Test job retry on failure (temporarily break SMTP)
- [ ] Test scheduled job execution (adjust cron for testing)
- [ ] Verify job statistics endpoint
- [ ] Test job cancellation
- [ ] Load test with 1000+ announcement recipients

---

## Deployment Checklist

### Pre-Deployment

- [ ] Update `.env` with job configuration variables
- [ ] Run database migration with updated 0001 file
- [ ] Verify indexes are created
- [ ] Install npm dependencies (`pg-boss`)
- [ ] Run tests: `npm test`
- [ ] Build project: `npm run build`

### Deployment

- [ ] Deploy updated codebase
- [ ] Restart application
- [ ] Verify pg-boss tables created in `app` schema
- [ ] Check application logs for initialization
- [ ] Verify workers are registered

### Post-Deployment Verification

- [ ] Test announcement creation (DRAFT)
- [ ] Test announcement publication (triggers job)
- [ ] Monitor job queue: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM app.job;"`
- [ ] Check job statistics endpoint: `GET /api/v1/jobs/stats`
- [ ] Verify emails are sent
- [ ] Monitor error logs

### Rollback Plan (if needed)

1. Stop application
2. Revert code to previous version
3. Restart application
4. Jobs in queue will remain (can be manually cancelled if needed)

---

## Monitoring & Operations

### Daily Monitoring

**Check Job Queue Health:**

```sql
-- Active jobs
SELECT name, COUNT(*)
FROM app.job
WHERE state = 'active'
GROUP BY name;

-- Failed jobs
SELECT name, COUNT(*), MAX(completedon) as last_failure
FROM app.job
WHERE state = 'failed'
GROUP BY name;

-- Queue depth
SELECT state, COUNT(*)
FROM app.job
GROUP BY state;
```

### Weekly Review

- Review failed jobs and identify patterns
- Check job processing times
- Verify scheduled jobs are running
- Review retention policy effectiveness

### Alerts to Set Up

1. **High Queue Depth:** > 1000 jobs in `created` state
2. **High Failure Rate:** > 10% of jobs failing
3. **Slow Processing:** Average job time > 30 seconds
4. **No Activity:** No jobs processed in 1 hour

### Maintenance Tasks

**Monthly:**

- Review and adjust worker concurrency
- Analyze job performance metrics
- Update retry strategies if needed

**Quarterly:**

- Review pg-boss version for updates
- Evaluate need for separate worker processes
- Assess if BullMQ migration is warranted

---

## Rollback Strategy

### If Jobs System Fails

**Option 1: Disable Workers (Keep API Running)**

```typescript
// In app.ts, comment out worker initialization
// await startWorkers();
```

This keeps the API running but jobs won't be processed. Announcements can still be created as DRAFT.

**Option 2: Full Rollback**

1. Revert code to previous commit
2. Drop pg-boss tables (optional):
   ```sql
   DROP TABLE IF EXISTS app.job CASCADE;
   DROP TABLE IF EXISTS app.archive CASCADE;
   DROP TABLE IF EXISTS app.version CASCADE;
   DROP TABLE IF EXISTS app.schedule CASCADE;
   ```
3. Restart application

**Option 3: Emergency Bypass**

Temporarily revert `announcementService.ts` to NOT use jobs:

```typescript
// Emergency fallback - synchronous announcement
export async function publishAnnouncement(announcementId: string) {
  // Use old synchronous logic (commented code in current file)
  // This is not ideal but unblocks critical functionality
}
```

---

## Appendix: Quick Reference

### Job Names

```typescript
SEND_EMAIL; // Single email
SEND_BULK_EMAIL; // Bulk emails via BCC
PUBLISH_ANNOUNCEMENT; // Main announcement job
RESOLVE_ANNOUNCEMENT_AUDIENCE; // Resolve targets + create inbox
SEND_ANNOUNCEMENT_EMAILS; // Send emails to recipients
CLEANUP_EXPIRED_ANNOUNCEMENTS; // Daily cleanup (2 AM)
```

### Cron Schedule Examples

```
"0 2 * * *"       // Daily at 2 AM
"0 9 * * MON"     // Monday at 9 AM
"0 0 1 * *"       // First day of month at midnight
"*/15 * * * *"    // Every 15 minutes
"0 */6 * * *"     // Every 6 hours
```

### Useful SQL Queries

```sql
-- View all queued jobs
SELECT id, name, priority, state, createdon
FROM app.job
WHERE state IN ('created', 'active')
ORDER BY priority, createdon;

-- Count jobs by type
SELECT name, state, COUNT(*)
FROM app.job
GROUP BY name, state;

-- View recent failures
SELECT id, name, data, output, completedon
FROM app.job
WHERE state = 'failed'
ORDER BY completedon DESC
LIMIT 10;

-- Cancel all pending jobs of a type
DELETE FROM app.job
WHERE name = 'send-email' AND state = 'created';
```

---

## Conclusion

This implementation plan provides everything needed to integrate pg-boss into the YPF Backend without blockers. The architecture is designed to be:

- **Consistent** with existing codebase conventions
- **Scalable** from single instance to distributed workers
- **Observable** with comprehensive logging and monitoring
- **Resilient** with retry logic and graceful degradation

Follow each section in order, and the implementation will be smooth and complete.

**Next Steps:**

1. Review this plan with the team
2. Set up environment variables
3. Begin Phase 1 implementation
4. Track progress via GitHub issues

---

**Document Version:** 1.0  
**Last Updated:** January 7, 2026  
**Status:** Ready for Implementation  
**Questions?** Open a GitHub issue or discussion
