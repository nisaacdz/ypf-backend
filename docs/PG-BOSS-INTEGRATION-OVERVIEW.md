# pg-boss Integration: Executive Overview

**Date:** January 7, 2026  
**Status:** Architecture Complete - Ready for Implementation  
**Estimated Timeline:** 4-6 days

---

## 📋 What Was Delivered

This architecture plan provides everything needed to integrate scheduled job processing into the YPF Backend **without blockers**:

### 1. **Complete Implementation Plan** (49KB, 1809 lines)

- File: [`pg-boss-implementation-plan.md`](./pg-boss-implementation-plan.md)
- Full production-ready code for all components
- Step-by-step implementation guide
- Database schema changes
- Testing strategy
- Deployment checklist
- Monitoring & rollback strategies

### 2. **Quick Start Guide** (8.5KB, 348 lines)

- File: [`IMPLEMENTATION-SUMMARY.md`](./IMPLEMENTATION-SUMMARY.md)
- 5-minute setup overview
- File structure and creation order
- Troubleshooting guide
- Useful commands

---

## 🎯 Problem & Solution

### Problems Addressed

1. **Announcement Broadcasting Inefficiency**
   - Current: Synchronous processing blocks API responses
   - Duplicates when constituents belong to multiple groups
   - No retry on email failures
   - No visibility into delivery status

2. **Email Reliability**
   - Current: Direct `await` blocks requests
   - No retry logic for transient failures
   - Fire-and-forget pattern loses track of failures

3. **Missing Scheduled Tasks**
   - No automated cleanup of expired announcements
   - No support for digest emails or periodic reports

### Solution: pg-boss Job Queue

- **PostgreSQL-based** job queue (leverages existing infrastructure)
- **Reliable** message delivery with automatic retries
- **Deduplication** via database constraints
- **Scalable** to handle 1000+ recipients per announcement
- **Observable** with job tracking and monitoring

---

## 🏗️ Architecture Highlights

### Technology Choice: pg-boss

**Why pg-boss over BullMQ or other solutions?**

| Factor           | pg-boss               | BullMQ        | Decision                |
| ---------------- | --------------------- | ------------- | ----------------------- |
| Infrastructure   | PostgreSQL (existing) | Redis (new)   | ✅ pg-boss              |
| Throughput       | 1k jobs/min           | 10k+ jobs/min | ✅ pg-boss (sufficient) |
| Operational Cost | Low                   | Medium-High   | ✅ pg-boss              |
| Codebase Fit     | Perfect               | Good          | ✅ pg-boss              |

### Key Design Decisions

1. **Schema Location:** `app` schema (all pg-boss tables)
   - Consistent with existing application structure
   - No separate schema management needed

2. **Runtime Model:** Same process (API + Workers)
   - Simplifies initial deployment
   - Can be separated later if needed

3. **Migration Strategy:** Update 0001 migration
   - Pre-production, so no new migration needed
   - Just adds performance indexes

4. **Job Processing:** Background workers
   - Email worker: Handles all email sending
   - Announcement worker: Resolves audience, creates inbox, sends emails
   - Cleanup worker: Scheduled tasks (daily, weekly, monthly)

---

## 📦 What Gets Installed

### NPM Packages

- `pg-boss@10.1.5` - Job queue library
- `@types/pg-boss@9.0.6` - TypeScript definitions

### New Files Created (10 files)

```
configs/jobs/
├── dispatcher.ts          # pg-boss client wrapper
├── workers.ts             # Worker registration
└── index.ts               # Public exports

shared/jobs/
├── types/
│   └── definitions.ts     # Job names, data types
└── workers/
    ├── emailWorker.ts     # Email job handlers
    ├── announcementWorker.ts  # Announcement handlers
    └── cleanupWorker.ts   # Cleanup handlers

features/api/v1/jobs/      # Optional job management API
├── index.ts
└── jobHandler.ts
```

### Modified Files (3 files)

- `configs/env.ts` - Add job configuration
- `app.ts` - Initialize job system
- `shared/services/announcementService.ts` - Use job queue

### Database Changes

- Add 6 indexes for performance optimization (in 0001 migration)
- pg-boss auto-creates 4 tables in `app` schema

---

## 🚀 Implementation Phases

### Phase 1: Core Infrastructure (1-2 days)

- Install dependencies
- Create job dispatcher
- Define job types
- Update environment configuration

### Phase 2: Job Workers (1-2 days)

- Implement email worker
- Implement announcement worker
- Implement cleanup worker
- Register workers with dispatcher

### Phase 3: Integration (1 day)

- Update `app.ts` for initialization
- Update announcement service to use jobs
- Test end-to-end flow

### Phase 4: Testing & Polish (1-2 days)

- Unit tests
- Integration tests
- Manual testing
- Monitoring setup
- Optional: Job management API

**Total Estimated Time:** 4-6 days

---

## 🔍 How It Works

### Announcement Publication Flow

```
1. User clicks "Publish Announcement" in dashboard
   ↓
2. API Handler receives request
   ↓
3. Service queues PUBLISH_ANNOUNCEMENT job
   ↓
4. Worker picks up job, spawns RESOLVE_AUDIENCE job
   ↓
5. Worker resolves target constituents (e.g., all chapter leaders)
   ↓
6. Worker creates inbox entries (1 per constituent)
   ↓
7. Worker deduplicates email addresses
   ↓
8. Worker spawns SEND_ANNOUNCEMENT_EMAILS job
   ↓
9. Worker sends emails in batches of 100 (respects SMTP limits)
   ↓
10. Worker marks inbox entries as "emailSent"
    ↓
11. Announcement status updated to "PUBLISHED"
```

**Benefits:**

- ✅ API responds immediately (non-blocking)
- ✅ Emails deduplicated automatically
- ✅ Retries on failure
- ✅ Full tracking and observability

---

## 📊 Performance & Scalability

### Expected Load

- Announcements: ~50 per month
- Recipients per announcement: ~500 constituents
- Total email jobs: ~25,000 per month
- Peak rate: ~100 emails per hour

### pg-boss Capacity

- Handles: 1,000+ jobs per minute
- Our need: ~2 jobs per minute (peak)
- **Headroom:** 500x capacity margin

### Scalability Path

1. **Current:** Single instance (API + Workers)
2. **Phase 2:** Increase worker concurrency via env variable
3. **Phase 3:** Separate worker process (if needed)
4. **Phase 4:** Multiple worker instances (if needed)
5. **Phase 5:** Migrate to BullMQ (if >2k jobs/min sustained)

---

## 🛡️ Reliability & Error Handling

### Retry Strategy

- **Email jobs:** 3 retries with exponential backoff
- **Announcement jobs:** 2 retries with 5-minute delay
- **Cleanup jobs:** 1 retry with 10-minute delay

### Dead Letter Queue

- Failed jobs after max retries → `failed` state
- Retained for 7 days for debugging
- Admin can manually retry via API or SQL

### Monitoring

- Queue depth alerts (>1000 queued jobs)
- Failed job alerts (>50 failed jobs)
- Processing time alerts (avg >30 seconds)
- Worker health checks

---

## 💰 Cost & Infrastructure Impact

### Infrastructure Changes

- **None** - Uses existing PostgreSQL database
- **No new services** - No Redis, no separate queue service
- **Same deployment** - No changes to deployment pipeline

### Database Impact

- **Storage:** Minimal (~100MB for job history)
- **Connections:** +10 connections from pg-boss pool
- **CPU/Memory:** Negligible increase
- **Cost:** $0 additional infrastructure

### Operational Impact

- **Monitoring:** Same PostgreSQL monitoring
- **Backups:** Already covered by DB backups
- **Maintenance:** pg-boss auto-cleanup (7-day retention)

---

## ✅ Pre-Implementation Checklist

### Technical Prerequisites

- [ ] Node.js 18+ (already have)
- [ ] PostgreSQL 12+ (already have)
- [ ] Database backup strategy (already have)
- [ ] SMTP configuration (already have)

### Environment Setup

- [ ] Add job configuration to `.env`
- [ ] Verify database connection limits
- [ ] Review SMTP sending limits

### Team Readiness

- [ ] Review implementation plan
- [ ] Assign developer(s) to implementation
- [ ] Schedule implementation timeframe
- [ ] Plan for testing and monitoring

---

## 🚨 Risk Assessment

### Low Risk

- **Technology:** pg-boss is mature, battle-tested
- **Infrastructure:** No new services or dependencies
- **Code:** All code provided, follows codebase conventions
- **Rollback:** Easy rollback if issues arise

### Mitigation Strategies

1. **Graceful Degradation:** Can disable workers, keep API running
2. **Rollback Plan:** Documented emergency rollback procedures
3. **Testing:** Comprehensive unit and integration tests
4. **Monitoring:** Built-in observability from day one

---

## 📈 Success Metrics

### Immediate (Week 1)

- ✅ Announcements publish without blocking API
- ✅ Emails deduplicated and sent reliably
- ✅ Zero manual intervention for job processing

### Short-term (Month 1)

- ✅ 100% announcement delivery success rate
- ✅ <1% email bounce rate
- ✅ Automated cleanup tasks running daily

### Long-term (Quarter 1)

- ✅ Support 1000+ recipients per announcement
- ✅ Sub-second API response times
- ✅ Comprehensive job observability

---

## 🎓 Developer Experience

### Learning Curve

- **Minimal** - Straightforward API: `jobDispatcher.client.send(jobName, data)`
- **Familiar** - Uses existing PostgreSQL knowledge
- **Well-documented** - 2000+ lines of documentation and code

### Code Quality

- ✅ TypeScript types for all job data
- ✅ Consistent with codebase conventions
- ✅ Uses `@/` import alias
- ✅ Structured logging with pino
- ✅ Error handling with ApiError

### Maintainability

- ✅ Clear separation of concerns
- ✅ Testable worker functions
- ✅ Observable via logs and database queries
- ✅ Easy to debug with SQL

---

## 🔄 Next Steps

### Immediate Actions

1. **Review:** Team reviews this overview and full implementation plan
2. **Approve:** Stakeholder approval for implementation
3. **Schedule:** Assign developer and timeframe
4. **Start:** Begin Phase 1 implementation

### Implementation Path

1. Follow [`IMPLEMENTATION-SUMMARY.md`](./IMPLEMENTATION-SUMMARY.md) for quick setup
2. Refer to [`pg-boss-implementation-plan.md`](./pg-boss-implementation-plan.md) for complete code
3. Create files in order specified in Phase 1-4
4. Test each phase before moving to next
5. Deploy to staging for final validation
6. Deploy to production with monitoring

---

## 📚 Documentation Hierarchy

```
1. THIS FILE (PG-BOSS-INTEGRATION-OVERVIEW.md)
   └─ Executive summary for stakeholders

2. IMPLEMENTATION-SUMMARY.md
   └─ Quick start guide for developers (5 min read)

3. pg-boss-implementation-plan.md
   └─ Complete implementation guide (30 min read)
      └─ Full code for all components
      └─ Step-by-step instructions
      └─ Testing and deployment guides

4. scheduled-jobs-integration.md
   └─ Original research and analysis (reference)
```

---

## 🎉 Conclusion

This architecture provides a **production-ready, low-risk, high-value** solution for integrating scheduled job processing into the YPF Backend.

### Key Strengths

- ✅ **Complete:** All code provided, no blockers
- ✅ **Consistent:** Follows codebase conventions
- ✅ **Simple:** Uses existing PostgreSQL infrastructure
- ✅ **Scalable:** Handles expected load with room to grow
- ✅ **Observable:** Built-in monitoring and logging
- ✅ **Recoverable:** Clear rollback and error handling

### Implementation Confidence

- **High** - All components architected and coded
- **Low Risk** - Minimal infrastructure changes
- **Fast** - 4-6 day implementation timeline
- **Reversible** - Easy rollback if needed

**Ready to proceed with implementation.**

---

**Questions or Feedback?**

- Review full plan: [`pg-boss-implementation-plan.md`](./pg-boss-implementation-plan.md)
- Quick start: [`IMPLEMENTATION-SUMMARY.md`](./IMPLEMENTATION-SUMMARY.md)
- Open GitHub issue for questions

---

**Prepared by:** GitHub Copilot  
**Date:** January 7, 2026  
**Status:** Ready for Implementation
