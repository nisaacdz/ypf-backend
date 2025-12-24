# Announcement Creation

**Status:** Implemented
**Endpoint:** `POST /api/v1/announcements`

## Overview

The Announcement Creation API allows authorized users ("Leaders") to broadcast messages to specific segments of the constituency. The targeting system uses a **Strict Intersection Strategy**—users must match _all_ provided top-level criteria to be included.

## Authorization

Access is restricted to users with the following roles:

- **Super Admins** (`ADMIN.SUPER`)
- **Regular Admins** (`ADMIN.REGULAR`)
- **Leaders** (Any role matching `MEMBER.*`, e.g., `MEMBER.president`, `MEMBER.chapterLead`)

## Request Body

The request body must conform to the `CreateAnnouncementSchema`.

```typescript
{
  title: string;           // Required, 1-255 chars
  content: string;         // Required, min 1 char (Markdown/HTML)
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; // Default: "DRAFT"
  publishedAt?: string;    // ISO 8601 datetime string (optional)
  expiresAt?: string;      // ISO 8601 datetime string (optional)
  targetCriteria: TargetingFilter; // Required, see below
}

```

## Targeting Methodology (`TargetingFilter`)

The `targetCriteria` object defines the audience using a filtering engine. It is crucial to understand how fields interact to avoid accidentally excluding intended users.

### 1. The Intersection Rule (Top-Level Logic)

All top-level fields provided in the object are combined using **AND**.

> _User must match (Scope) **AND** (Role/Type) **AND** (Status)._

### 2. The Union Rule (Array Logic)

Values provided _within_ a specific array field are combined using **OR**.

> _User must be in (Chapter A **OR** Chapter B)._

### 3. Implicit Member Scoping (⚠️ Important)

The fields `chapterIds`, `committeeIds`, and `roles` describe attributes that technically belong to **Members**.

- **If you provide these fields**, the system inherently filters for users who possess these attributes.
- **Pitfall:** If you select `constituentTypes: ["VOLUNTEER"]` but also provide a `chapterIds` filter, the system will search for "Volunteers who belong to Chapter X". If your data model does not assign Volunteers to Chapters, **this will result in 0 recipients.**

### Interface

```typescript
interface TargetingFilter {
  // --- Scope Filters (Implicitly targets Members) ---
  chapterIds?: string[]; // Users must belong to ONE of these Chapters
  committeeIds?: string[]; // Users must belong to ONE of these Committees

  // --- Attribute Filters ---
  // Implicitly targets Members. Checks specific titles held within the Scope.
  roles?: string[]; // e.g. ["PRESIDENT", "TREASURER"]

  // --- Type Filters ---
  // If omitted, defaults to ALL types that satisfy the Scope/Role filters.
  constituentTypes?: Array<"MEMBER" | "VOLUNTEER" | "ADMIN">;

  // --- State Filters ---
  status?: "ACTIVE" | "PAST" | "ALL"; // Default: "ACTIVE"
}
```

---

## Scenarios & Examples

### Scenario 1: Broad Broadcast

**Goal:** Email every single Active Member in the system.
**Logic:** No scope constraints = Global. `constituentTypes` ensures we don't accidentally email system admins or temporary volunteers.

```json
{
  "title": "Annual General Meeting",
  "targetCriteria": {
    "constituentTypes": ["MEMBER"],
    "status": "ACTIVE"
  }
}
```

### Scenario 2: Targeted Leadership (Scope + Role)

**Goal:** Email the President or Secretary of Chapter X.
**Logic:** The user must be in Chapter X **AND** hold one of the specified titles.
_Note: We do not need to specify `constituentTypes: ["MEMBER"]` here; the presence of `roles` and `chapterIds` implies it._

```json
{
  "title": "Chapter X Leadership Sync",
  "targetCriteria": {
    "chapterIds": ["uuid-chapter-x"],
    "roles": ["PRESIDENT", "SECRETARY"],
    "status": "ACTIVE"
  }
}
```

### Scenario 3: The "Disjoint" Pitfall (Invalid Logic)

**Goal:** Email "All Volunteers" **AND** "Members of Committee A".
**❌ Incorrect Approach:**
Putting both in one filter will fail because the logic is **AND**.

```json
{
  "targetCriteria": {
    "constituentTypes": ["VOLUNTEER", "MEMBER"],
    "committeeIds": ["uuid-committee-a"]
  }
}
```

_Result:_ This will find Members of Committee A, and "Volunteers of Committee A". It will **NOT** email Volunteers who are not in Committee A.
_Fix:_ Create two separate announcements, or leave `committeeIds` blank to email everyone, then rely on content to specify relevance.

### Scenario 4: Committee Action (Scope Only)

**Goal:** Email everyone in Committee A (Active only).

```json
{
  "title": "Committee A Updates",
  "targetCriteria": {
    "committeeIds": ["uuid-committee-a"],
    "status": "ACTIVE"
  }
}
```
