# Scheduled Jobs Integration: Research & Implementation Plan

**Date:** January 6, 2026  
**Project:** YPF Backend  
**Status:** Research Complete / Ready for Implementation  
**Authors:** GitHub Copilot Research

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Requirements Analysis](#requirements-analysis)
4. [Technology Evaluation](#technology-evaluation)
5. [Recommended Solution](#recommended-solution)
6. [Architecture Design](#architecture-design)
7. [Implementation Plan](#implementation-plan)
8. [Code Organization](#code-organization)
9. [Performance Optimization](#performance-optimization)
10. [Security Considerations](#security-considerations)
11. [Monitoring & Observability](#monitoring--observability)
12. [Testing Strategy](#testing-strategy)
13. [Deployment & Scaling](#deployment--scaling)
14. [Migration Path](#migration-path)
15. [Future Enhancements](#future-enhancements)
16. [References & Resources](#references--resources)

---

## Executive Summary

This document provides a comprehensive analysis of integrating scheduled jobs into the YPF Backend architecture. The primary use cases are:

1. **Announcement Broadcasting**: Efficiently deliver announcements to targeted constituents without duplication
2. **Email Queue Management**: Offload heavy email operations to background jobs
3. **Scheduled Notifications**: Send application acceptance emails, onboarding reminders, etc.

### Key Recommendations

- **Primary Solution**: **pg-boss** (PostgreSQL-based job queue)
- **Why**: Native PostgreSQL integration, minimal infrastructure overhead, excellent for existing architecture
- **Secondary Option**: **BullMQ** with Redis (if Redis infrastructure is already robust)
- **Runtime**: Keep jobs in same Node.js runtime initially, separate later if needed

### Expected Benefits

- **Performance**: Offload heavy operations from request-response cycle
- **Reliability**: Automatic retries, failure handling, job persistence
- **Deduplication**: Prevent duplicate announcement deliveries
- **Scalability**: Easy horizontal scaling with multiple worker processes
- **Observability**: Built-in job monitoring and tracking

---

## Problem Statement

### Current Challenges

#### 1. Announcement Broadcasting Inefficiency

The `publishAnnouncement` function in `shared/services/announcementService.ts` is currently commented out but reveals several concerns:

```typescript
// Current commented implementation shows:
// 1. Synchronous audience resolution (potentially slow for large datasets)
// 2. Bulk database insertions (1000 records at a time - could block)
// 3. Email sending in fire-and-forget async wrapper (no retry on failure)
// 4. No deduplication strategy across multiple groups
```

**Issues:**
- If a constituent belongs to multiple chapters/committees, they could receive duplicate announcements
- No retry mechanism if email sending fails
- Heavy database operations block the main thread
- No visibility into job progress or failures

#### 2. Email Reliability

Current email sending patterns (in `shared/utils/email.ts`):
- Direct `await` in request handlers (blocks response)
- No retry logic for transient failures
- No rate limiting to prevent overwhelming SMTP server
- Fire-and-forget pattern loses track of failures

#### 3. Lack of Scheduled Tasks

No mechanism for:
- Periodic cleanup tasks
- Reminder emails (e.g., "Complete your profile")
- Report generation
- Data synchronization
- Expired announcement cleanup

---

## Requirements Analysis

### Functional Requirements

#### FR1: Announcement Broadcasting
- **FR1.1**: Resolve target audience based on `TargetingFilter` criteria
- **FR1.2**: Create `ConstituentAnnouncements` entries (inbox system)
- **FR1.3**: Send emails to deduplicated recipient list
- **FR1.4**: Track email delivery status per constituent
- **FR1.5**: Support scheduled announcements (publishedAt in future)

#### FR2: Email Queue Management
- **FR2.1**: Queue all transactional emails (welcome, OTP, acknowledgments)
- **FR2.2**: Support batching for bulk emails (announcements)
- **FR2.3**: Rate limiting to respect SMTP provider limits
- **FR2.4**: Priority levels (urgent OTP vs. informational newsletter)

#### FR3: Recurring Jobs
- **FR3.1**: Daily cleanup of expired announcements
- **FR3.2**: Weekly digest emails
- **FR3.3**: Monthly report generation
- **FR3.4**: Periodic data consistency checks

#### FR4: Job Management
- **FR4.1**: View job status and history
- **FR4.2**: Retry failed jobs manually
- **FR4.3**: Cancel scheduled jobs
- **FR4.4**: Monitor job queue health

### Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Announcement broadcasting should not block API response
- **NFR1.2**: Support 10,000+ recipients per announcement
- **NFR1.3**: Email throughput: 100+ emails/minute
- **NFR1.4**: Job processing latency < 5 seconds for high priority jobs

#### NFR2: Reliability
- **NFR2.1**: At-least-once delivery guarantee
- **NFR2.2**: Automatic retry with exponential backoff
- **NFR2.3**: Dead letter queue for permanently failed jobs
- **NFR2.4**: Job state persistence survives application restarts

#### NFR3: Scalability
- **NFR3.1**: Horizontal scaling via multiple worker processes
- **NFR3.2**: Handle 1000+ concurrent jobs
- **NFR3.3**: Job queue should not become bottleneck

#### NFR4: Maintainability
- **NFR4.1**: Minimal external dependencies
- **NFR4.2**: Compatible with existing PostgreSQL infrastructure
- **NFR4.3**: Clear separation of concerns
- **NFR4.4**: Easy to test job handlers

#### NFR5: Observability
- **NFR5.1**: Job execution metrics (success rate, duration)
- **NFR5.2**: Error logging with context
- **NFR5.3**: Queue depth monitoring
- **NFR5.4**: Worker health checks

---

## Technology Evaluation

### Option 1: pg-boss (PostgreSQL-based)

**Repository**: https://github.com/timgit/pg-boss  
**License**: MIT  
**Weekly Downloads**: ~100k  
**Last Updated**: Active development

#### Pros ✅

1. **Native PostgreSQL Integration**
   - Uses existing database - no new infrastructure
   - ACID guarantees from PostgreSQL
   - Familiar query patterns for debugging
   - Automatic cleanup via retention policies

2. **Architecture Fit**
   - Already using PostgreSQL as primary database
   - No Redis required (though can coexist)
   - Drizzle ORM can query job tables for admin UI
   - Aligns with "PostgreSQL-first" philosophy

3. **Feature Completeness**
   - Scheduled jobs (cron-like)
   - Job expiration and retention
   - Priority queues
   - Singleton jobs (prevent duplicates)
   - Job throttling/rate limiting
   - Dead letter queue
   - Job completion notifications

4. **Operational Simplicity**
   - One connection pool for app + jobs
   - Backup strategy already covers job data
   - No additional ports/services to monitor
   - Easy to inspect jobs with SQL

5. **Developer Experience**
   - Simple API: `boss.send('job-name', { data })`
   - TypeScript support
   - Clear documentation
   - Active community

#### Cons ❌

1. **Performance Ceiling**
   - PostgreSQL polling has overhead vs. Redis pub/sub
   - Not ideal for >10k jobs/second (not our use case)
   - Vacuum overhead for high-churn job tables

2. **Limited Ecosystem**
   - Fewer plugins compared to Bull/BullMQ
   - No built-in UI dashboard (would need custom)
   - Less common in enterprise stacks

#### Use Cases Best For
- Medium-scale job processing (100-1000 jobs/min)
- Applications already using PostgreSQL
- Teams wanting infrastructure simplicity
- Jobs requiring transactional consistency

#### Sample Code

```typescript
import PgBoss from 'pg-boss';

const boss = new PgBoss({
  connectionString: variables.database.url,
  retryLimit: 3,
  retryDelay: 60,
  retryBackoff: true,
  expireInHours: 24
});

await boss.start();

// Send job
await boss.send('send-announcement-emails', {
  announcementId: 'uuid',
  recipientIds: ['uuid1', 'uuid2']
});

// Handle job
await boss.work('send-announcement-emails', async (job) => {
  const { announcementId, recipientIds } = job.data;
  await sendAnnouncementEmails(announcementId, recipientIds);
});
```

---

### Option 2: BullMQ (Redis-based)

**Repository**: https://github.com/taskforcesh/bullmq  
**License**: MIT  
**Weekly Downloads**: ~500k  
**Last Updated**: Very active

#### Pros ✅

1. **High Performance**
   - Redis-native: extremely fast job insertion/consumption
   - Pub/sub for real-time job notifications
   - Can handle 10k+ jobs/second
   - Low-latency job processing (<10ms)

2. **Rich Feature Set**
   - Advanced scheduling (cron, delayed jobs)
   - Job priority with separate queues
   - Rate limiting per queue
   - Job events (progress, completion)
   - Sandboxed job processors (isolated child processes)
   - Parent-child job relationships
   - Job dependencies and flows

3. **Ecosystem & Tooling**
   - **Bull Board**: Beautiful web UI for monitoring
   - **Bull Exporter**: Prometheus metrics
   - Enterprise-grade monitoring integrations
   - Large community and plugins

4. **Proven at Scale**
   - Used by major companies (Netflix, etc.)
   - Battle-tested in production
   - Excellent documentation
   - Active Discord community

#### Cons ❌

1. **Infrastructure Overhead**
   - Requires Redis instance (already have via `ioredis`)
   - Additional service to monitor and backup
   - Redis persistence configuration crucial
   - Network latency if Redis is remote

2. **Operational Complexity**
   - Redis memory management (eviction policies)
   - Redis persistence: RDB vs AOF tradeoffs
   - Separate backup strategy for job data
   - Two databases to manage (PostgreSQL + Redis)

3. **Data Isolation**
   - Job data in Redis, business data in PostgreSQL
   - Harder to maintain consistency
   - Admin queries require Redis access
   - Cross-database reporting challenges

4. **Cost**
   - Managed Redis (AWS ElastiCache, Redis Cloud) adds cost
   - Memory costs for job persistence
   - Higher infrastructure complexity

#### Use Cases Best For
- High-throughput systems (>5k jobs/min)
- Real-time job processing requirements
- Teams already invested in Redis infrastructure
- Applications needing advanced job orchestration

#### Sample Code

```typescript
import { Queue, Worker } from 'bullmq';

const connection = {
  host: variables.services.redis.url,
  port: 6379
};

const queue = new Queue('emails', { connection });

// Send job
await queue.add('send-announcement', {
  announcementId: 'uuid',
  recipientIds: ['uuid1', 'uuid2']
}, {
  priority: 1,
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
});

// Handle job
const worker = new Worker('emails', async (job) => {
  const { announcementId, recipientIds } = job.data;
  await sendAnnouncementEmails(announcementId, recipientIds);
}, { connection });
```

---

### Option 3: node-cron + Custom Implementation

#### Pros ✅
- Minimal dependencies (just `node-cron`)
- Full control over scheduling logic
- Easy to understand and debug

#### Cons ❌
- **No job persistence**: Jobs lost on restart
- **No distributed execution**: Can't scale horizontally
- **No retry logic**: Must implement manually
- **No queue management**: Fire-and-forget only
- **Monitoring gaps**: No built-in metrics

**Verdict**: ❌ Not suitable for production-grade job processing

---

### Option 4: Agenda (MongoDB-based)

#### Pros ✅
- MongoDB-native job queue
- Simple API similar to pg-boss

#### Cons ❌
- Requires MongoDB (not in current stack)
- Adding another database just for jobs is overkill
- Less active than Bull/pg-boss

**Verdict**: ❌ Not recommended (introduces new database)

---

### Comparison Matrix

| Feature                  | pg-boss       | BullMQ        | node-cron   |
| ------------------------ | ------------- | ------------- | ----------- |
| **Infrastructure**       | PostgreSQL    | Redis         | In-memory   |
| **Persistence**          | ✅ Automatic   | ✅ Automatic   | ❌ None      |
| **Throughput**           | 1k jobs/min   | 10k+ jobs/min | N/A         |
| **Priority Queues**      | ✅             | ✅             | ❌           |
| **Scheduled Jobs**       | ✅ (cron)      | ✅ (cron)      | ✅ (cron)    |
| **Retry Logic**          | ✅             | ✅             | ❌           |
| **Distributed Workers**  | ✅             | ✅             | ❌           |
| **Built-in UI**          | ❌             | ✅ (Bull Board) | ❌           |
| **Horizontal Scaling**   | ✅             | ✅             | ❌           |
| **Setup Complexity**     | Low           | Medium        | Very Low    |
| **Operational Cost**     | Low           | Medium-High   | Low         |
| **YPF Stack Fit**        | ⭐⭐⭐⭐⭐        | ⭐⭐⭐⭐         | ⭐⭐          |

---

## Recommended Solution

### Primary Recommendation: **pg-boss**

#### Rationale

1. **Minimal Infrastructure Changes**
   - Already using PostgreSQL as primary database
   - No new services to deploy and monitor
   - Single connection pool serves both app and jobs
   - Simpler backup and disaster recovery

2. **Architecture Alignment**
   - Codebase already PostgreSQL-centric (Drizzle ORM)
   - Can use Drizzle to query job tables for admin UI
   - Maintains "convention over configuration" philosophy
   - Reduces operational complexity for team

3. **Sufficient Performance**
   - Expected load: <500 jobs/minute (announcements + emails)
   - pg-boss handles 1k+ jobs/minute comfortably
   - Plenty of headroom for growth
   - Can migrate to BullMQ later if needed

4. **Cost Efficiency**
   - No additional Redis hosting costs
   - Leverages existing database resources
   - Simpler deployment pipeline

5. **Developer Experience**
   - TypeScript-first design
   - Clear, intuitive API
   - Easy to debug with SQL queries
   - Familiar patterns for team

#### When to Reconsider

Switch to **BullMQ** if:
- Job throughput exceeds 2k/minute consistently
- Real-time job processing (<100ms latency) is critical
- Redis infrastructure is already robust and managed
- Team grows and needs advanced orchestration features

### Implementation Phases

**Phase 1: Foundation** (Week 1)
- Install and configure pg-boss
- Create job worker infrastructure
- Implement email queue

**Phase 2: Announcement Broadcasting** (Week 2)
- Implement announcement job handlers
- Add deduplication logic
- Create job monitoring endpoints

**Phase 3: Scheduled Tasks** (Week 3)
- Add recurring jobs (cleanup, digests)
- Implement retry policies
- Create admin UI for job management

**Phase 4: Optimization** (Week 4)
- Performance tuning
- Add comprehensive monitoring
- Load testing and capacity planning

---

## Architecture Design

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     YPF Backend API                         │
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                │
│  │   Express    │         │  Socket.IO   │                │
│  │   Router     │         │   Server     │                │
│  └──────┬───────┘         └──────┬───────┘                │
│         │                        │                         │
│         └────────┬───────────────┘                         │
│                  │                                         │
│         ┌────────▼─────────┐                              │
│         │  Job Dispatcher   │                              │
│         │   (pg-boss)       │                              │
│         └────────┬──────────┘                              │
│                  │                                         │
│         ┌────────▼──────────┐                             │
│         │   PostgreSQL      │◄──────────────┐             │
│         │   - App Data      │               │             │
│         │   - Job Queue     │               │             │
│         └───────────────────┘               │             │
│                                             │             │
│         ┌─────────────────────┐             │             │
│         │   Job Workers       │             │             │
│         │  (Same Runtime)     │             │             │
│         │                     │             │             │
│         │  - Email Worker     │─────────────┘             │
│         │  - Announcement     │                           │
│         │  - Cleanup Worker   │                           │
│         └─────────────────────┘                           │
│                                                           │
└─────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   ┌──────────┐        ┌──────────┐
   │   SMTP   │        │  Socket  │
   │  Server  │        │ Clients  │
   └──────────┘        └──────────┘
```

### Component Architecture

#### 1. Job Dispatcher (`configs/jobs/dispatcher.ts`)

```typescript
import PgBoss from 'pg-boss';
import variables from '@/configs/env';

class JobDispatcher {
  private boss: PgBoss | null = null;

  async initialize() {
    this.boss = new PgBoss({
      connectionString: variables.database.url,
      schema: 'jobs',  // Separate schema for jobs
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
      expireInHours: 24,
      deleteAfterDays: 7,
      monitorStateIntervalSeconds: 60,
    });

    await this.boss.start();
    logger.info('Job dispatcher initialized');
  }

  get client() {
    if (!this.boss) {
      throw new Error('Job dispatcher not initialized');
    }
    return this.boss;
  }
}

export const jobDispatcher = new JobDispatcher();
export default jobDispatcher;
```

#### 2. Job Definitions (`shared/jobs/definitions.ts`)

```typescript
export const JobNames = {
  // Email Jobs
  SEND_EMAIL: 'send-email',
  SEND_BULK_EMAIL: 'send-bulk-email',
  
  // Announcement Jobs
  PUBLISH_ANNOUNCEMENT: 'publish-announcement',
  RESOLVE_ANNOUNCEMENT_AUDIENCE: 'resolve-announcement-audience',
  SEND_ANNOUNCEMENT_EMAILS: 'send-announcement-emails',
  
  // Cleanup Jobs
  CLEANUP_EXPIRED_ANNOUNCEMENTS: 'cleanup-expired-announcements',
  CLEANUP_OLD_JOBS: 'cleanup-old-jobs',
  
  // Periodic Jobs
  SEND_WEEKLY_DIGEST: 'send-weekly-digest',
  GENERATE_MONTHLY_REPORT: 'generate-monthly-report',
} as const;

export type JobName = typeof JobNames[keyof typeof JobNames];

export interface EmailJobData {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface AnnouncementJobData {
  announcementId: string;
}

export interface SendAnnouncementEmailsJobData {
  announcementId: string;
  recipientEmails: string[];
}
```

#### 3. Job Workers (`configs/jobs/workers.ts`)

```typescript
import jobDispatcher from './dispatcher';
import { JobNames } from '@/shared/jobs/definitions';
import { emailWorker } from '@/shared/jobs/workers/emailWorker';
import { announcementWorker } from '@/shared/jobs/workers/announcementWorker';
import { cleanupWorker } from '@/shared/jobs/workers/cleanupWorker';
import logger from '@/configs/logger';

export async function startWorkers() {
  const boss = jobDispatcher.client;

  // Register Email Worker
  await boss.work(
    JobNames.SEND_EMAIL,
    { teamSize: 5, teamConcurrency: 2 },
    emailWorker.sendEmail
  );

  await boss.work(
    JobNames.SEND_BULK_EMAIL,
    { teamSize: 3, teamConcurrency: 1 },
    emailWorker.sendBulkEmail
  );

  // Register Announcement Workers
  await boss.work(
    JobNames.PUBLISH_ANNOUNCEMENT,
    { teamSize: 2, teamConcurrency: 1 },
    announcementWorker.publishAnnouncement
  );

  await boss.work(
    JobNames.RESOLVE_ANNOUNCEMENT_AUDIENCE,
    { teamSize: 3, teamConcurrency: 1 },
    announcementWorker.resolveAudience
  );

  await boss.work(
    JobNames.SEND_ANNOUNCEMENT_EMAILS,
    { teamSize: 5, teamConcurrency: 2 },
    announcementWorker.sendEmails
  );

  // Register Cleanup Workers
  await boss.work(
    JobNames.CLEANUP_EXPIRED_ANNOUNCEMENTS,
    { teamSize: 1, teamConcurrency: 1 },
    cleanupWorker.cleanupExpiredAnnouncements
  );

  // Schedule recurring jobs
  await boss.schedule(
    JobNames.CLEANUP_EXPIRED_ANNOUNCEMENTS,
    '0 2 * * *', // Daily at 2 AM
    {},
    { tz: 'Africa/Accra' }
  );

  await boss.schedule(
    JobNames.SEND_WEEKLY_DIGEST,
    '0 9 * * MON', // Mondays at 9 AM
    {},
    { tz: 'Africa/Accra' }
  );

  logger.info('All job workers started and scheduled');
}
```

#### 4. Job Worker Handlers

**Email Worker** (`shared/jobs/workers/emailWorker.ts`):

```typescript
import { sendEmail } from '@/shared/utils/email';
import logger from '@/configs/logger';
import type { EmailJobData } from '../definitions';

export const emailWorker = {
  async sendEmail(job: { data: EmailJobData }) {
    const { to, subject, html, text } = job.data;
    
    try {
      await sendEmail(to, subject, html, text);
      logger.info(`Email sent successfully to ${Array.isArray(to) ? to.length : 1} recipient(s)`);
    } catch (error) {
      logger.error(error, 'Failed to send email');
      throw error; // Trigger retry
    }
  },

  async sendBulkEmail(job: { data: EmailJobData }) {
    // Use BCC for bulk emails
    const { to, subject, html, text } = job.data;
    
    if (!Array.isArray(to) || to.length === 0) {
      throw new Error('Bulk email requires array of recipients');
    }

    // Batch emails in groups of 100 to avoid SMTP limits
    const batchSize = 100;
    for (let i = 0; i < to.length; i += batchSize) {
      const batch = to.slice(i, i + batchSize);
      await sendEmail(batch, subject, html, text, true); // BCC mode
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < to.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`Bulk email sent to ${to.length} recipients in ${Math.ceil(to.length / batchSize)} batches`);
  }
};
```

**Announcement Worker** (`shared/jobs/workers/announcementWorker.ts`):

```typescript
import dbClient from '@/configs/db';
import schema from '@/db/schema';
import { resolveAudience } from '@/shared/services/targetResolver';
import { eq, and, inArray } from 'drizzle-orm';
import logger from '@/configs/logger';
import jobDispatcher from '@/configs/jobs/dispatcher';
import { JobNames } from '../definitions';
import type { AnnouncementJobData } from '../definitions';

export const announcementWorker = {
  /**
   * Main job: Publishes an announcement
   * Orchestrates the sub-jobs for audience resolution and email sending
   */
  async publishAnnouncement(job: { data: AnnouncementJobData }) {
    const { announcementId } = job.data;

    // 1. Fetch announcement
    const announcement = await dbClient.db.query.Announcements.findFirst({
      where: eq(schema.Announcements.id, announcementId),
    });

    if (!announcement) {
      throw new Error(`Announcement ${announcementId} not found`);
    }

    // 2. Resolve audience (this job spawns a sub-job)
    const audienceJobId = await jobDispatcher.client.send(
      JobNames.RESOLVE_ANNOUNCEMENT_AUDIENCE,
      { announcementId }
    );

    logger.info(`Spawned audience resolution job ${audienceJobId} for announcement ${announcementId}`);

    // Note: The audience resolution job will spawn the email sending job
    // This creates a job chain: publish → resolve → send emails
  },

  /**
   * Sub-job: Resolves announcement audience and creates inbox entries
   */
  async resolveAudience(job: { data: AnnouncementJobData }) {
    const { announcementId } = job.data;

    const announcement = await dbClient.db.query.Announcements.findFirst({
      where: eq(schema.Announcements.id, announcementId),
    });

    if (!announcement) {
      throw new Error(`Announcement ${announcementId} not found`);
    }

    // 1. Resolve target audience
    const constituentIds = await resolveAudience(announcement.targetCriteria);

    if (constituentIds.length === 0) {
      logger.info(`No constituents found for announcement ${announcementId}`);
      return;
    }

    logger.info(`Resolved ${constituentIds.length} constituents for announcement ${announcementId}`);

    // 2. Create ConstituentAnnouncements (inbox entries)
    // Use chunking to avoid overwhelming database
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

    logger.info(`Created inbox entries for ${constituentIds.length} constituents`);

    // 3. Fetch unique email addresses for these constituents
    const constituents = await dbClient.db
      .select({
        id: schema.Constituents.id,
        email: schema.Constituents.email,
      })
      .from(schema.Constituents)
      .where(inArray(schema.Constituents.id, constituentIds));

    // Deduplicate emails (one constituent = one email, even if in multiple groups)
    const uniqueEmails = [...new Set(constituents.map((c) => c.email))];

    logger.info(`Deduplicated to ${uniqueEmails.length} unique emails`);

    // 4. Spawn email sending job
    await jobDispatcher.client.send(
      JobNames.SEND_ANNOUNCEMENT_EMAILS,
      {
        announcementId,
        recipientEmails: uniqueEmails,
      },
      {
        priority: 1, // High priority
      }
    );

    // 5. Update announcement status
    await dbClient.db
      .update(schema.Announcements)
      .set({ status: 'PUBLISHED', publishedAt: new Date() })
      .where(eq(schema.Announcements.id, announcementId));

    logger.info(`Announcement ${announcementId} published successfully`);
  },

  /**
   * Sub-job: Sends announcement emails to recipients
   */
  async sendEmails(job: { data: SendAnnouncementEmailsJobData }) {
    const { announcementId, recipientEmails } = job.data;

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
      }
    );

    // Mark emails as sent for all constituents
    await dbClient.db
      .update(schema.ConstituentAnnouncements)
      .set({ emailSent: true })
      .where(eq(schema.ConstituentAnnouncements.announcementId, announcementId));

    logger.info(`Sent announcement emails for ${announcementId} to ${recipientEmails.length} recipients`);
  }
};
```

**Cleanup Worker** (`shared/jobs/workers/cleanupWorker.ts`):

```typescript
import dbClient from '@/configs/db';
import schema from '@/db/schema';
import { lt, and, eq } from 'drizzle-orm';
import logger from '@/configs/logger';

export const cleanupWorker = {
  /**
   * Cleanup expired announcements
   * Runs daily at 2 AM (configured in scheduler)
   */
  async cleanupExpiredAnnouncements() {
    const now = new Date();

    // Archive expired announcements
    const result = await dbClient.db
      .update(schema.Announcements)
      .set({ status: 'ARCHIVED' })
      .where(
        and(
          eq(schema.Announcements.status, 'PUBLISHED'),
          lt(schema.Announcements.expiresAt, now)
        )
      )
      .returning({ id: schema.Announcements.id });

    logger.info(`Archived ${result.length} expired announcements`);
  },

  /**
   * Cleanup old completed jobs
   * pg-boss has built-in cleanup, but this is for custom logic
   */
  async cleanupOldJobs() {
    // pg-boss handles this automatically with `deleteAfterDays` config
    // This is placeholder for any custom cleanup logic
    logger.info('Job cleanup completed');
  }
};
```

### Database Schema for Jobs

pg-boss creates its own tables in the `jobs` schema:

```sql
-- Automatically created by pg-boss
CREATE SCHEMA IF NOT EXISTS jobs;

-- Main job queue table
CREATE TABLE jobs.job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 0,
  data jsonb,
  state text NOT NULL DEFAULT 'created',
  retry_limit integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  retry_delay integer NOT NULL DEFAULT 0,
  retry_backoff boolean NOT NULL DEFAULT false,
  start_after timestamp with time zone NOT NULL DEFAULT now(),
  started_on timestamp with time zone,
  singleton_key text,
  singleton_on timestamp without time zone,
  expire_in interval NOT NULL DEFAULT interval '15 minutes',
  created_on timestamp with time zone NOT NULL DEFAULT now(),
  completed_on timestamp with time zone,
  keep_until timestamp with time zone NOT NULL DEFAULT now() + interval '14 days',
  output jsonb,
  dead_letter text,
  policy text,
  ...
);

-- Indexes for performance
CREATE INDEX job_name ON jobs.job (name text_pattern_ops);
CREATE INDEX job_fetch ON jobs.job (name text_pattern_ops, start_after) WHERE state < 'active';
CREATE INDEX job_singleton_key ON jobs.job (singleton_key) WHERE state < 'expired' AND singleton_key IS NOT NULL;
```

**No changes required to application schema** - pg-boss manages its own tables.

---

## Code Organization

### Directory Structure

```
/home/runner/work/ypf-backend/ypf-backend/
├── configs/
│   ├── jobs/
│   │   ├── dispatcher.ts          # PgBoss instance setup
│   │   ├── workers.ts              # Worker registration
│   │   └── index.ts                # Public exports
│   ├── db.ts
│   ├── env.ts
│   └── ...
├── shared/
│   ├── jobs/
│   │   ├── definitions.ts          # Job names and data types
│   │   ├── workers/
│   │   │   ├── emailWorker.ts      # Email job handlers
│   │   │   ├── announcementWorker.ts # Announcement handlers
│   │   │   ├── cleanupWorker.ts    # Cleanup job handlers
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── announcementService.ts  # Updated to use jobs
│   │   ├── ...
│   └── utils/
│       ├── email.ts                # Keep direct email util
│       └── ...
├── features/
│   ├── api/
│   │   └── v1/
│   │       ├── jobs/               # Job management API (new)
│   │       │   ├── index.ts
│   │       │   ├── jobsHandler.ts
│   │       │   └── schemas.ts
│   │       ├── announcements/
│   │       └── ...
│   └── ...
├── app.ts                          # Initialize jobs on startup
└── ...
```

### Key Files

#### 1. Update `app.ts` to Initialize Jobs

```typescript
import jobDispatcher from '@/configs/jobs/dispatcher';
import { startWorkers } from '@/configs/jobs/workers';

async function shutdown() {
  logger.info('Shutting down server...');

  try {
    await jobDispatcher.client.stop();
    logger.info('Job dispatcher stopped.');
  } catch (error) {
    logger.error(error, 'Error stopping job dispatcher');
  }

  // ... existing shutdown code
}

(async () => {
  try {
    await Promise.all([
      emailer.initialize(),
      dbClient.initialize(),
      redisClient.initialize(),
      jobDispatcher.initialize(), // Add this
    ]);

    // Start job workers
    await startWorkers();

    // ... existing server startup code
  } catch (error) {
    logger.error(error, 'Failed to initialize server');
    process.exit(1);
  }
})();
```

#### 2. Update `announcementService.ts`

```typescript
import jobDispatcher from '@/configs/jobs/dispatcher';
import { JobNames } from '@/shared/jobs/definitions';

export async function publishAnnouncement(announcementId: string) {
  // Simply queue the job
  await jobDispatcher.client.send(
    JobNames.PUBLISH_ANNOUNCEMENT,
    { announcementId },
    {
      priority: 1,
      retryLimit: 2,
      retryDelay: 300, // 5 minutes
    }
  );

  logger.info(`Queued announcement ${announcementId} for publishing`);
}
```

#### 3. Create Job Management API

**Endpoint**: `GET /api/v1/jobs` (Admin only)

```typescript
// features/api/v1/jobs/jobsHandler.ts
import jobDispatcher from '@/configs/jobs/dispatcher';
import { Request, Response } from 'express';

export async function getJobs(req: Request, res: Response) {
  const { state, name, limit = 50 } = req.query;

  const jobs = await jobDispatcher.client.fetch(
    name as string,
    limit as number,
    { state: state as string }
  );

  res.json({
    success: true,
    data: jobs,
  });
}

export async function retryJob(req: Request, res: Response) {
  const { jobId } = req.params;

  await jobDispatcher.client.resume(jobId);

  res.json({
    success: true,
    message: 'Job retried successfully',
  });
}

export async function cancelJob(req: Request, res: Response) {
  const { jobId } = req.params;

  await jobDispatcher.client.cancel(jobId);

  res.json({
    success: true,
    message: 'Job cancelled successfully',
  });
}
```

---

## Performance Optimization

### 1. Audience Resolution Optimization

**Problem**: Resolving audience for large announcements can be slow.

**Solution**: Use database query optimization

```typescript
// Optimized query with indexes
export async function resolveAudience(filters: TargetingFilter): Promise<string[]> {
  // Use a single query with JOINs instead of subqueries
  // Add indexes on foreign keys:
  // - chapter_memberships(member_id, chapter_id)
  // - committee_memberships(member_id, committee_id)
  // - member_titles_assignments(member_id, title_id)

  // Use DISTINCT to avoid duplicates
  const query = dbClient.db
    .selectDistinct({ id: schema.Constituents.id })
    .from(schema.Constituents)
    // ... optimized JOIN logic
    .limit(10000); // Safety limit

  return query;
}
```

**Database Indexes** (add to migration):

```sql
-- Optimize audience resolution queries
CREATE INDEX IF NOT EXISTS idx_chapter_memberships_member_chapter 
  ON core.chapter_memberships(member_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_committee_memberships_member_committee 
  ON core.committee_memberships(member_id, committee_id);

CREATE INDEX IF NOT EXISTS idx_member_titles_assignments_member_title 
  ON core.member_titles_assignments(member_id, title_id);

CREATE INDEX IF NOT EXISTS idx_members_constituent_ended 
  ON core.members(constituent_id, ended_at);

-- Optimize job queue queries
CREATE INDEX IF NOT EXISTS idx_announcements_status_expires 
  ON activities.announcements(status, expires_at);
```

### 2. Batch Processing Strategy

```typescript
// Process large recipient lists in batches
async function sendAnnouncementEmails(recipients: string[], chunkSize = 100) {
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    
    await jobDispatcher.client.send(JobNames.SEND_BULK_EMAIL, {
      to: chunk,
      // ... email data
    });
  }
}
```

### 3. Job Priority System

```typescript
enum JobPriority {
  CRITICAL = 1,  // OTP emails, password resets
  HIGH = 2,      // Transactional emails (donations, orders)
  NORMAL = 5,    // Announcements
  LOW = 10,      // Digests, reports
}

await jobDispatcher.client.send(jobName, data, {
  priority: JobPriority.CRITICAL,
});
```

### 4. Rate Limiting

```typescript
// Respect SMTP provider limits (e.g., 100 emails/minute)
const emailWorkerConfig = {
  teamSize: 5,           // 5 parallel workers
  teamConcurrency: 2,    // Each worker handles 2 jobs concurrently
  newJobCheckInterval: 1000, // Check for new jobs every second
};

// This gives us ~10 emails/second = 600 emails/minute max
// Adjust based on SMTP provider limits
```

### 5. Connection Pooling

```typescript
// Use shared connection pool for jobs
const boss = new PgBoss({
  connectionString: variables.database.url,
  max: 10,  // Share connections with main app pool
  // pg-boss creates its own pool, ensure total pools don't exceed DB limits
});
```

---

## Security Considerations

### 1. Job Data Sanitization

```typescript
// Never store sensitive data in job payloads
// ❌ BAD
await jobDispatcher.client.send('send-email', {
  password: 'user-password', // Never!
  creditCard: '1234-5678-9012-3456', // Never!
});

// ✅ GOOD
await jobDispatcher.client.send('send-email', {
  userId: 'uuid', // Reference, fetch sensitive data in worker
});
```

### 2. Job Authorization

```typescript
// Ensure only authorized users can trigger jobs
router.post('/announcements/:id/publish',
  authenticate,
  authorize(Visitors.hasProfile('ADMIN')),
  async (req, res) => {
    await publishAnnouncement(req.params.id);
    res.json({ success: true });
  }
);
```

### 3. Job Data Validation

```typescript
// Validate job data with Zod
const EmailJobSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1).max(255),
  html: z.string().min(1),
});

async function sendEmail(job: { data: unknown }) {
  const data = EmailJobSchema.parse(job.data); // Throws if invalid
  // ... send email
}
```

### 4. Rate Limiting Job Creation

```typescript
// Prevent abuse of job queue
import rateLimit from 'express-rate-limit';

const jobCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 job creation requests per 15 minutes
  message: 'Too many job creation requests, please try again later',
});

router.post('/announcements/:id/publish', jobCreationLimiter, ...);
```

---

## Monitoring & Observability

### 1. Job Metrics

```typescript
// Expose metrics endpoint for monitoring
router.get('/admin/jobs/metrics', async (req, res) => {
  const metrics = {
    queued: await boss.getQueueSize('send-email'),
    failed: await boss.getQueueSize('send-email', 'failed'),
    completed: await boss.getQueueSize('send-email', 'completed'),
  };

  res.json({ success: true, data: metrics });
});
```

### 2. Job Events

```typescript
// Monitor job lifecycle events
boss.on('error', (error) => {
  logger.error(error, 'Job queue error');
});

boss.on('maintenance', () => {
  logger.debug('Job queue maintenance started');
});

boss.on('monitor-states', (states) => {
  logger.info(`Job states: ${JSON.stringify(states)}`);
});
```

### 3. Logging Strategy

```typescript
// Structured logging for jobs
logger.info({
  event: 'job-started',
  jobId: job.id,
  jobName: job.name,
  timestamp: new Date().toISOString(),
});

logger.error({
  event: 'job-failed',
  jobId: job.id,
  jobName: job.name,
  error: error.message,
  retryCount: job.retryCount,
  timestamp: new Date().toISOString(),
});
```

### 4. Dead Letter Queue Monitoring

```typescript
// Alert when jobs hit dead letter queue
async function monitorDeadLetterQueue() {
  const failedJobs = await boss.fetch('*', 100, { state: 'failed' });
  
  if (failedJobs.length > 10) {
    logger.warn(`High number of failed jobs: ${failedJobs.length}`);
    // Send alert to team (email, Slack, PagerDuty)
  }
}

// Run every 10 minutes
await boss.schedule('monitor-dead-letter', '*/10 * * * *', {});
```

---

## Testing Strategy

### 1. Unit Tests for Job Handlers

```typescript
// tests/unit/jobs/emailWorker.test.ts
import { describe, it, expect, vi } from 'vitest';
import { emailWorker } from '@/shared/jobs/workers/emailWorker';
import * as emailUtils from '@/shared/utils/email';

describe('emailWorker', () => {
  it('should send email successfully', async () => {
    const sendEmailSpy = vi.spyOn(emailUtils, 'sendEmail').mockResolvedValue();

    await emailWorker.sendEmail({
      data: {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      },
    });

    expect(sendEmailSpy).toHaveBeenCalledWith(
      'test@example.com',
      'Test',
      '<p>Test</p>',
      undefined
    );
  });

  it('should retry on failure', async () => {
    vi.spyOn(emailUtils, 'sendEmail').mockRejectedValue(new Error('SMTP error'));

    await expect(
      emailWorker.sendEmail({
        data: {
          to: 'test@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        },
      })
    ).rejects.toThrow('SMTP error');
  });
});
```

### 2. Integration Tests

```typescript
// tests/integration/jobs.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jobDispatcher from '@/configs/jobs/dispatcher';
import { JobNames } from '@/shared/jobs/definitions';

describe('Job Queue Integration', () => {
  beforeAll(async () => {
    await jobDispatcher.initialize();
  });

  afterAll(async () => {
    await jobDispatcher.client.stop();
  });

  it('should queue and process email job', async () => {
    const jobId = await jobDispatcher.client.send(JobNames.SEND_EMAIL, {
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(jobId).toBeDefined();

    // Wait for job to complete
    const job = await jobDispatcher.client.getJobById(jobId);
    expect(job).toBeDefined();
  });
});
```

### 3. Load Testing

```typescript
// tests/load/jobQueue.load.ts
import jobDispatcher from '@/configs/jobs/dispatcher';

async function loadTest() {
  const jobCount = 1000;
  const startTime = Date.now();

  // Queue 1000 jobs
  const promises = [];
  for (let i = 0; i < jobCount; i++) {
    promises.push(
      jobDispatcher.client.send('test-job', { index: i })
    );
  }

  await Promise.all(promises);

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`Queued ${jobCount} jobs in ${duration}ms`);
  console.log(`Throughput: ${(jobCount / duration * 1000).toFixed(2)} jobs/sec`);
}
```

---

## Deployment & Scaling

### 1. Environment Variables

```bash
# .env.example additions
DATABASE_URL=postgresql://user:password@localhost:5432/ypf_db
JOB_CONCURRENCY=10          # Number of concurrent job workers
JOB_RETENTION_DAYS=7        # Keep completed jobs for 7 days
JOB_RETRY_LIMIT=3           # Retry failed jobs 3 times
JOB_RETRY_DELAY=60          # Wait 60 seconds before retry
```

### 2. Horizontal Scaling

```typescript
// Run multiple instances of the app
// pg-boss automatically distributes jobs across instances

// Instance 1
node dist/app.js

// Instance 2
node dist/app.js

// Jobs are automatically load-balanced across both instances
```

### 3. Separate Worker Process (Optional)

```typescript
// workers.js - Dedicated worker process
import jobDispatcher from './configs/jobs/dispatcher';
import { startWorkers } from './configs/jobs/workers';

(async () => {
  await jobDispatcher.initialize();
  await startWorkers();
  console.log('Worker process started');
})();
```

```bash
# Run API and workers separately
npm run start          # API server only (no workers)
npm run start:workers  # Worker process only
```

### 4. Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

# Start both API and workers
CMD ["node", "dist/app.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/ypf_db
      - JOB_CONCURRENCY=5
    ports:
      - "3000:3000"
    depends_on:
      - db

  worker:
    build: .
    command: node dist/workers.js
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/ypf_db
      - JOB_CONCURRENCY=10
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=ypf_db
      - POSTGRES_PASSWORD=password
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## Migration Path

### Phase 1: Setup Infrastructure (Week 1)

**Tasks:**
1. Install pg-boss: `npm install pg-boss @types/pg-boss`
2. Create job configuration files
3. Implement basic email worker
4. Add initialization to `app.ts`
5. Create database migrations for indexes

**Deliverables:**
- Job dispatcher configured
- Email jobs working
- Tests passing

### Phase 2: Announcement Broadcasting (Week 2)

**Tasks:**
1. Implement announcement worker
2. Update `announcementService.ts` to use jobs
3. Add deduplication logic
4. Create job monitoring endpoints
5. Update API documentation

**Deliverables:**
- Announcements broadcast via jobs
- Duplicate prevention working
- Admin can monitor job status

### Phase 3: Additional Features (Week 3)

**Tasks:**
1. Implement cleanup workers
2. Add scheduled tasks (cron jobs)
3. Create admin UI for job management
4. Add comprehensive logging
5. Performance testing

**Deliverables:**
- Recurring jobs running
- Admin dashboard functional
- Performance benchmarks met

### Phase 4: Production Hardening (Week 4)

**Tasks:**
1. Load testing
2. Error handling improvements
3. Monitoring and alerting
4. Documentation updates
5. Team training

**Deliverables:**
- Production-ready system
- Complete documentation
- Team onboarded

---

## Future Enhancements

### 1. Custom Job Dashboard

Build a React admin panel to visualize job queue:
- Real-time job status
- Retry/cancel controls
- Metrics charts (success rate, duration)
- Error logs viewer

### 2. Job Dependencies

Implement job chains and flows:
```typescript
await boss.sendWithFlow('workflow-1', [
  { name: 'step-1', data: {} },
  { name: 'step-2', data: {}, after: ['step-1'] },
  { name: 'step-3', data: {}, after: ['step-2'] },
]);
```

### 3. Webhook Integration

Trigger jobs via webhooks:
```typescript
router.post('/webhooks/trigger-job', async (req, res) => {
  const { jobName, data } = req.body;
  await jobDispatcher.client.send(jobName, data);
  res.json({ success: true });
});
```

### 4. Advanced Scheduling

Implement complex scheduling patterns:
- Run on specific dates (e.g., birthdays)
- Time zone-aware scheduling
- Conditional job execution

### 5. Multi-tenancy Support

If YPF scales to multiple organizations:
```typescript
await boss.send('send-email', data, {
  singletonKey: `org-${orgId}-email-${userId}`,
  singletonSeconds: 60,
});
```

### 6. Migration to BullMQ

If performance becomes a concern:
1. Implement adapter pattern for job queue
2. Create BullMQ implementation
3. Switch via configuration flag
4. Run both in parallel during migration
5. Deprecate pg-boss

---

## References & Resources

### Documentation
- **pg-boss**: https://github.com/timgit/pg-boss
- **BullMQ**: https://docs.bullmq.io/
- **PostgreSQL Performance**: https://wiki.postgresql.org/wiki/Performance_Optimization

### Best Practices
- **Job Queue Patterns**: https://www.rabbitmq.com/patterns.html
- **At-Least-Once Delivery**: https://kafka.apache.org/documentation/#semantics
- **Idempotency in Distributed Systems**: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/

### YPF Backend Docs
- [Financial Transactions](./financial-transactions.md)
- [Authorization Strategy](./authorization-strategy.md)
- [Announcement Creation](./announcement-creation.md)
- [Notifications](./notifications.md)

---

## Conclusion

### Summary

This document provides a comprehensive plan for integrating scheduled jobs into the YPF Backend. The recommended approach using **pg-boss** offers:

1. **Minimal infrastructure changes** - leverages existing PostgreSQL
2. **Production-ready features** - retries, scheduling, monitoring
3. **Clear migration path** - phased implementation over 4 weeks
4. **Future flexibility** - can migrate to BullMQ if needed

### Key Takeaways

- **pg-boss is the right choice** for YPF's current scale and architecture
- **Deduplication** is solved via unique constraint + Set data structure
- **Performance** is sufficient for expected load (<500 jobs/min)
- **Observability** is built-in with job state tracking
- **Team alignment** is critical - follow this doc during implementation

### Next Steps

1. **Review this document** with the team
2. **Approve the technology choice** (pg-boss)
3. **Begin Phase 1 implementation**
4. **Track progress** via GitHub issues
5. **Update this doc** as we learn during implementation

---

**Document Version:** 1.0  
**Last Updated:** January 6, 2026  
**Status:** Ready for Implementation  
**Feedback:** Open a GitHub issue for questions or suggestions
