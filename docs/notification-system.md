# Notification System Plan

**Status:** Planned  
**Last Updated:** 2026-02-12

## Background

YPF has two distinct messaging concepts:

1. **Announcements** — Global broadcasts targeting segments of the constituency (members, volunteers, directors, donors, even unonboarded constituents). They live in the `activities` schema, have a full lifecycle (DRAFT → PUBLISHED → ARCHIVED), and involve email delivery via the pg-boss job pipeline. _These are already implemented._

2. **Notifications** — Lightweight, in-app messages for individual users of the dashboard application. They power the "bell icon" feed and real-time toasts. _The table and WebSocket infrastructure exist but have zero producers._

The goal is to:

- **Wire up the notification system** so that domain events (application approvals, payments, role assignments) create in-app notifications.
- **Bridge announcements into notifications** so published announcements also appear in the dashboard's notification feed, giving onboarded users a richer experience.

---

## Current Infrastructure

### What Already Exists

| Component                                | Location                                    | Status                           |
| ---------------------------------------- | ------------------------------------------- | -------------------------------- |
| `app.notifications` table                | `db/schema/app.ts`                          | ✅ Created, **no writers**       |
| `Ws` singleton with `sendNotification()` | `configs/ws.ts`                             | ✅ Created, **never called**     |
| `/notifications` Socket.IO namespace     | `features/notifications/index.ts`           | ✅ Rooms joined, **never emits** |
| Socket.IO auth middleware                | `shared/middlewares/socket.ts`              | ✅ Working (cookie-based)        |
| Announcement pipeline (pg-boss)          | `shared/jobs/workers/announcementWorker.ts` | ✅ Fully functional              |
| `ConstituentAnnouncements` inbox table   | `db/schema/activities.ts`                   | ✅ Populated by worker           |

### WebSocket Room Strategy

Rooms use `user:{userId}` where `userId` is `app.users.id` (UUID). This is the correct choice because:

- Stable — UUIDs don't change; emails can
- Already implemented — `socket.request.User!.id` is used in both `/notifications` and `/chat` namespaces
- No PII leakage — UUIDs are opaque

The `userId` comes from the auth middleware which decodes the JWT from the `access_token` cookie. The same `userId` is available in REST handlers via `req.User!.id`.

---

## Schema Changes

### Enhance `app.notifications`

Current:

```sql
app.notifications (id, user_id, title, message, is_read, created_at)
```

Proposed:

```sql
app.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,           -- notification type enum (see below)
  title       TEXT,
  message     TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ,            -- NEW: when they dismissed/read it
  metadata    JSONB NOT NULL DEFAULT '{}',  -- NEW: deep-link payload
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

Add index:

```sql
CREATE INDEX idx_notifications_user_unread ON app.notifications (user_id, is_read)
  WHERE is_read = false;
```

### Notification Types

```typescript
const NotificationType = [
  // Announcements (bridged from ConstituentAnnouncements)
  "ANNOUNCEMENT_PUBLISHED",

  // Applications
  "APPLICATION_ACCEPTED",
  "APPLICATION_REJECTED",

  // Financial
  "TRANSACTION_COMPLETED",
  "TRANSACTION_FAILED",
  "TRANSACTION_REFUNDED",

  // Membership & Roles
  "TITLE_ASSIGNED",
  "TITLE_REMOVED",
  "CHAPTER_ADDED",
  "COMMITTEE_ADDED",

  // Generic
  "SYSTEM",
] as const;
```

### Metadata Examples

The `metadata` JSONB column carries type-specific data that the frontend uses for deep-linking without extra API calls.

```jsonc
// ANNOUNCEMENT_PUBLISHED
{ "announcementId": "uuid", "announcementTitle": "Annual General Meeting" }

// APPLICATION_ACCEPTED
{ "applicationId": "uuid", "trackingNumber": "ABC12345" }

// TRANSACTION_COMPLETED
{ "transactionId": "uuid", "amount": "50.00", "currency": "GHS", "transactionType": "donation" }

// TITLE_ASSIGNED
{ "titleName": "Chapter President", "chapterName": "Accra Chapter" }
```

---

## Notification Service

A single service that all producers call. It persists the notification and pushes it via WebSocket in one step.

**Location:** `shared/services/notificationService.ts`

### Interface

```typescript
interface CreateNotificationInput {
  userId: string; // app.users.id (the recipient)
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

// Single notification (most use cases)
function create(input: CreateNotificationInput): Promise<Notification>;

// Bulk notifications (announcements → many users)
function createBulk(inputs: CreateNotificationInput[]): Promise<void>;
```

### Behavior

1. **Persist** — Insert row(s) into `app.notifications`.
2. **Push** — Call `ws.sendNotification(userId, payload)` for each recipient.
   - This is fire-and-forget. If the user is offline, they'll see it on next `GET /notifications`.
   - If the WS push fails, log a warning but do not throw.

### Helper Required

Since most domain events know the `constituentId` but notifications need `userId`, a lookup helper is needed:

```typescript
// shared/services/usersService.ts
async function getUserIdByConstituentId(
  constituentId: string,
): Promise<string | null>;
```

---

## REST Endpoints

**Router:** `features/api/v1/notifications/index.ts`  
**Auth:** All endpoints require `authenticate` + `Visitors.isLoggedIn`

| Method  | Path                          | Description                                                   |
| ------- | ----------------------------- | ------------------------------------------------------------- |
| `GET`   | `/notifications`              | Paginated list. Query: `page`, `pageSize`, `unread` (boolean) |
| `GET`   | `/notifications/unread-count` | Returns `{ count: number }`                                   |
| `PATCH` | `/notifications/:id/read`     | Mark one as read (sets `is_read=true`, `read_at=now()`)       |
| `PATCH` | `/notifications/read-all`     | Mark all as read for current user                             |

---

## WebSocket Enhancement

Update the `Ws` singleton to accept a structured payload:

```typescript
// configs/ws.ts
sendNotification(userId: string, payload: {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}) {
  this.io.of("/notifications").to(`user:${userId}`).emit("notification", payload);
}
```

The frontend client listens on the `notification` event and can immediately render a toast or increment the badge counter without a REST round-trip.

---

## Integration Points

Where existing code needs to call `notificationService.create()`:

### 1. Application Status Change

**File:** `shared/services/applicationsService.ts` — `updateMembershipApplicationStatus()`  
**After:** The email send block (~line 500)

```typescript
// After sending acceptance/rejection email:
const user = await getUserIdByConstituentId(result.constituentId);
if (user) {
  notificationService.create({
    userId: user,
    type:
      newStatus === "ACCEPTED"
        ? "APPLICATION_ACCEPTED"
        : "APPLICATION_REJECTED",
    title: newStatus === "ACCEPTED" ? "Welcome to YPF!" : "Application Update",
    message:
      newStatus === "ACCEPTED"
        ? "Your membership application has been approved."
        : `Your membership application was not approved.${declinedReason ? ` Reason: ${declinedReason}` : ""}`,
    metadata: { applicationId: id, trackingNumber: result.trackingNumber },
  });
}
```

### 2. Transaction Status Change

**File:** `shared/services/transactionsService.ts` — `sendTransactionStatusChangeEmail()`  
**After:** Each email dispatch block

For COMPLETED, FAILED, and REFUNDED statuses — create a notification for the payer/donor.

### 3. Announcement Published

**File:** `shared/jobs/workers/announcementWorker.ts` — `resolveAudience()` handler  
**After:** The inbox entries are created (~line 128)

```typescript
// After creating ConstituentAnnouncements inbox entries:
// Resolve constituentIds → userIds (only onboarded users have app.users rows)
const users = await dbClient.db
  .select({ id: schema.Users.id, constituentId: schema.Users.constituentId })
  .from(schema.Users)
  .where(inArray(schema.Users.constituentId, constituentIds));

if (users.length > 0) {
  await notificationService.createBulk(
    users.map((u) => ({
      userId: u.id,
      type: "ANNOUNCEMENT_PUBLISHED",
      title: announcement.title,
      message: announcement.content.substring(0, 200), // preview
      metadata: {
        announcementId: announcement.id,
        announcementTitle: announcement.title,
      },
    })),
  );
}
```

This means:

- **All targeted constituents** get the email (via the existing email job) and the `ConstituentAnnouncements` inbox entry — whether or not they're onboarded.
- **Only onboarded users** (those with `app.users` rows) also get an `AppNotification` + WebSocket push — because only they can see the dashboard.

### 4. Title/Role Assignment (Future)

When the title management UI is built, the service that inserts/removes `MemberTitlesAssignments` rows should also call `notificationService.create()`.

---

## Frontend Strategy (Hybrid)

```
1. Dashboard mount  → GET /notifications/unread-count → render badge number
2. Connect Socket.IO → /notifications namespace (withCredentials: true)
3. On "notification" event → increment badge, show toast, prepend to list if open
4. On bell click → GET /notifications?page=1 → render dropdown/page
5. On notification click → PATCH /notifications/:id/read → decrement badge, navigate via metadata
6. On socket reconnect → re-fetch unread count (catch-up for missed push events)
```

**Why hybrid and not polling-only?**

- WebSocket push gives <1s latency for badge updates and toasts
- The DB remains the source of truth (handles offline/reconnect gracefully)
- Socket.IO is already deployed, authenticated, and the namespace exists

---

## Implementation Phases

### Phase 1: Backend Foundation

- [ ] Migrate `app.notifications` schema (add `type`, `read_at`, `metadata`)
- [ ] Create `shared/services/notificationService.ts`
- [ ] Update `configs/ws.ts` payload structure
- [ ] Add `getUserIdByConstituentId()` helper
- [ ] Add REST endpoints (`GET /notifications`, `GET /unread-count`, `PATCH /read`, `PATCH /read-all`)

### Phase 2: Wire Up Producers

- [ ] Application accepted/rejected → create notification
- [ ] Transaction completed/failed/refunded → create notification
- [ ] Announcement published → create bulk notifications (for onboarded users)

### Phase 3: Frontend

- [ ] Notification bell component with unread badge
- [ ] Notification dropdown or page with list + mark-as-read
- [ ] Socket.IO client + real-time toast
- [ ] Deep linking from `metadata` to relevant pages

### Phase 4: Future

- [ ] Title assigned/removed notifications
- [ ] Scheduled notifications (event reminders, dues deadlines via pg-boss cron)
- [ ] Notification preferences (per-type opt-out)
