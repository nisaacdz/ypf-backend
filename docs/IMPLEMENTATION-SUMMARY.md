# pg-boss Integration: Quick Start Guide

**Full Documentation:** See [`pg-boss-implementation-plan.md`](./pg-boss-implementation-plan.md) for complete details.

---

## 🎯 What This Solves

1. **Announcement Broadcasting** - Deduplicated, reliable announcement delivery to targeted constituents
2. **Email Queue Management** - Background processing of all emails with retry logic
3. **Scheduled Tasks** - Automated cleanup, digests, and periodic jobs

---

## 📦 Quick Setup (5 Minutes)

### 1. Install Dependencies

```bash
npm install pg-boss@10.1.5 @types/pg-boss@9.0.6
```

### 2. Add Environment Variables

Add to `.env`:

```bash
JOB_CONCURRENCY=5
JOB_RETENTION_DAYS=7
JOB_RETRY_LIMIT=3
JOB_RETRY_DELAY=60
JOB_ARCHIVE_HOURS=24
```

### 3. Update Database Migration

Add indexes to `db/migrations/0001_lazy_pretty_boy.sql`:

```sql
-- Announcement audience resolution optimization
CREATE INDEX IF NOT EXISTS idx_chapter_memberships_member_chapter
  ON core.chapter_memberships(member_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_committee_memberships_member_committee
  ON core.committee_memberships(member_id, committee_id);

CREATE INDEX IF NOT EXISTS idx_member_titles_assignments_member_title
  ON core.member_titles_assignments(member_id, title_id);

CREATE INDEX IF NOT EXISTS idx_members_constituent_ended
  ON core.members(constituent_id, ended_at);

-- Job queue queries optimization
CREATE INDEX IF NOT EXISTS idx_announcements_status_expires
  ON activities.announcements(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_constituents_email
  ON core.constituents(email);
```

### 4. Create File Structure

```bash
mkdir -p configs/jobs
mkdir -p shared/jobs/workers
mkdir -p shared/jobs/types
```

---

## 📁 Files to Create

All complete code is in the full implementation plan. Here's the file list:

### Core Configuration
- `configs/jobs/dispatcher.ts` - pg-boss client wrapper
- `configs/jobs/workers.ts` - Worker registration & scheduling
- `configs/jobs/index.ts` - Public exports
- `configs/env.ts` - **UPDATE** with job configuration

### Job Types & Definitions
- `shared/jobs/types/definitions.ts` - Job names, data types, priorities

### Job Workers
- `shared/jobs/workers/emailWorker.ts` - Email sending jobs
- `shared/jobs/workers/announcementWorker.ts` - Announcement publishing jobs
- `shared/jobs/workers/cleanupWorker.ts` - Scheduled cleanup jobs

### Service Updates
- `shared/services/announcementService.ts` - **UPDATE** to use jobs
- `app.ts` - **UPDATE** to initialize job system

### Optional: Job Management API
- `features/api/v1/jobs/index.ts` - Job routes
- `features/api/v1/jobs/jobHandler.ts` - Job management handlers

---

## 🚀 Implementation Order

Follow this order to avoid blockers:

1. **Phase 1: Core** (1-2 days)
   - Install dependencies
   - Update `configs/env.ts`
   - Create job dispatcher
   - Create job definitions
   - Update database migration

2. **Phase 2: Workers** (1-2 days)
   - Create email worker
   - Create announcement worker
   - Create cleanup worker
   - Create worker registry

3. **Phase 3: Integration** (1 day)
   - Update `app.ts`
   - Update `announcementService.ts`
   - Test end-to-end flow

4. **Phase 4: Polish** (1-2 days)
   - Add job management API (optional)
   - Write tests
   - Deploy and monitor

---

## 🔍 Key Architecture Decisions

### Why pg-boss?
- ✅ Uses existing PostgreSQL (no Redis needed)
- ✅ ACID guarantees from PostgreSQL
- ✅ Fits "PostgreSQL-first" philosophy
- ✅ Sufficient performance (<1000 jobs/min)
- ✅ Simple operational model

### Schema Location
All pg-boss tables go in the **`app` schema** (not default `pgboss` schema)

### Runtime Model
Initially: **Same process** (API + Workers together)
Later: Can separate into dedicated worker processes

### Migration Strategy
**Update 0001 migration** (we're pre-production, so no new migration needed)

---

## 📊 How It Works

```
API Request
    ↓
Service Layer (announcementService.ts)
    ↓
Job Dispatcher (queues job)
    ↓
PostgreSQL (app.job table)
    ↓
Job Worker (polls & executes)
    ↓
Email Sent / DB Updated
```

### Job Flow Example: Publishing Announcement

1. **API Handler** calls `publishAnnouncement(announcementId)`
2. **Service** queues `PUBLISH_ANNOUNCEMENT` job
3. **Dispatcher** inserts job into PostgreSQL
4. **Worker** picks up job, spawns `RESOLVE_ANNOUNCEMENT_AUDIENCE` job
5. **Worker** resolves audience, creates inbox entries
6. **Worker** spawns `SEND_ANNOUNCEMENT_EMAILS` job
7. **Worker** spawns `SEND_BULK_EMAIL` job
8. **Worker** sends emails in batches

---

## 🧪 Testing

### Manual Test
```bash
# Start server
npm run dev

# Create announcement (via API)
POST /api/v1/announcements
{
  "title": "Test Announcement",
  "content": "Test content",
  "targetCriteria": {...},
  "status": "PUBLISHED"
}

# Check logs
# Should see: "Queued announcement for publishing"
# Should see: "Resolved X constituents"
# Should see: "Announcement emails sent"

# Verify in database
psql $DATABASE_URL -c "SELECT * FROM app.job ORDER BY createdon DESC LIMIT 5;"
```

### Unit Tests
```bash
npm test tests/unit/jobs/
```

### Integration Tests
```bash
npm test tests/integration/jobs.test.ts
```

---

## 🛠️ Useful Commands

### Check Job Queue Status
```sql
-- Queue depth
SELECT state, COUNT(*) FROM app.job GROUP BY state;

-- Recent jobs
SELECT id, name, state, createdon 
FROM app.job 
ORDER BY createdon DESC 
LIMIT 10;

-- Failed jobs
SELECT id, name, data, output 
FROM app.job 
WHERE state = 'failed' 
ORDER BY completedon DESC;
```

### Job Management API (if implemented)
```bash
# Get job stats
GET /api/v1/jobs/stats

# List jobs
GET /api/v1/jobs/list?state=active&limit=50

# Retry failed job
POST /api/v1/jobs/{jobId}/retry

# Cancel job
POST /api/v1/jobs/{jobId}/cancel
```

---

## 🚨 Troubleshooting

### Jobs not processing?
1. Check workers are started: Look for "All job workers started" in logs
2. Check database connection: `psql $DATABASE_URL`
3. Check pg-boss tables exist: `\dt app.*` in psql
4. Check for errors: `SELECT * FROM app.job WHERE state = 'failed';`

### Emails not sending?
1. Check SMTP configuration in `.env`
2. Check email job state: `SELECT * FROM app.job WHERE name = 'send-email';`
3. Check application logs for SMTP errors
4. Test direct email: Call `sendEmail()` directly from a test script

### High queue depth?
1. Increase worker concurrency: Update `JOB_CONCURRENCY` in `.env`
2. Check for slow jobs: Monitor logs for job duration
3. Consider separating worker process

### Database connections exhausted?
1. Reduce connection pool sizes in `configs/db.ts` and `configs/jobs/dispatcher.ts`
2. Ensure total connections < PostgreSQL `max_connections`
3. Monitor active connections: `SELECT count(*) FROM pg_stat_activity;`

---

## 📈 Monitoring

### What to Monitor
- **Queue Depth:** Alert if > 1000 jobs queued
- **Failed Jobs:** Alert if > 50 failed jobs
- **Processing Time:** Alert if avg > 30 seconds
- **Worker Health:** Alert if no jobs processed in 1 hour

### How to Monitor
- **Logs:** Structured logging via pino
- **Database:** Query `app.job` table
- **API:** Job statistics endpoint (if implemented)
- **External:** Integration with monitoring service (future)

---

## 🔄 Rollback Strategy

If something goes wrong:

### Option 1: Disable Workers (Keep API Running)
```typescript
// In app.ts, comment out:
// await startWorkers();
```

### Option 2: Full Rollback
```bash
git revert HEAD
npm install
npm run build
pm2 restart ypf-backend
```

### Option 3: Emergency Bypass
Temporarily revert `announcementService.ts` to use synchronous logic (commented code in file)

---

## 📚 Resources

- **Full Implementation Plan:** [`pg-boss-implementation-plan.md`](./pg-boss-implementation-plan.md)
- **pg-boss Documentation:** https://github.com/timgit/pg-boss
- **Original Analysis:** [`scheduled-jobs-integration.md`](./scheduled-jobs-integration.md)

---

## ✅ Pre-Deployment Checklist

- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Database migration updated and run
- [ ] All files created with correct code
- [ ] Tests passing
- [ ] Manual test successful
- [ ] Monitoring setup
- [ ] Rollback plan documented

---

## 🎉 Ready to Implement?

Start with Phase 1 and refer to the full implementation plan for complete code snippets. Each file has production-ready code that follows YPF codebase conventions.

**Questions?** See the full plan or open a GitHub issue.

---

**Last Updated:** January 7, 2026  
**Status:** Implementation Ready  
**Estimated Time:** 4-6 days
