# Announcement Creation

**Status:** Implemented
**Endpoint:** `POST /api/v1/announcements`

## Overview

The Announcement Creation API allows authorized users ("Leaders") to create and target announcements to specific groups of constituents. The targeting system uses a **simplified flat filter** approach.

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

## Targeting Criteria (`TargetingFilter`)

The `targetCriteria` field is a flat object defining the audience.
**Logic:**

- **Top-level fields** are combined with **AND**. (e.g., must match `chapterIds` AND `roles`).
- **Array values** within fields are combined with **OR**. (e.g., `chapterIds: [A, B]` means Chapter A OR Chapter B).
- If a field is omitted or empty, it is ignored (treated as "All" for that dimension), except for logic dependencies (e.g., `roles` implies checking titles).

### Structure

```typescript
interface TargetingFilter {
  // 1. Scope (Organizational Units)
  chapterIds?: string[]; // UUIDs of Chapters
  committeeIds?: string[]; // UUIDs of Committees

  // 2. Roles & Types
  roles?: string[]; // e.g. "PRESIDENT", "TREASURER" - Checks Member Titles
  constituentTypes?: Array<"MEMBER" | "VOLUNTEER" | "ADMIN">;

  // 3. Status
  status?: "ACTIVE" | "PAST" | "ALL"; // Default: "ACTIVE"
}
```

## Examples

### Example 1: Announcement for All Active Members

```json
{
  "title": "Monthly Update",
  "content": "Here is the update...",
  "status": "PUBLISHED",
  "targetCriteria": {
    "constituentTypes": ["MEMBER"],
    "status": "ACTIVE"
  }
}
```

### Example 2: Announcement for Chapter Leaders (President OR Secretary in Chapter X)

```json
{
  "title": "Chapter X Leadership Meeting",
  "content": "Meeting agenda...",
  "targetCriteria": {
    "chapterIds": ["uuid-chapter-x"],
    "roles": ["PRESIDENT", "SECRETARY"],
    "status": "ACTIVE"
  }
}
```

_Logic:_ Must be in Chapter X **AND** must have (President title **OR** Secretary title) **AND** must be Active.

### Example 3: Announcement for Committee A Members (Active only)

```json
{
  "title": "Committee A Action Items",
  "content": "Please review...",
  "targetCriteria": {
    "committeeIds": ["uuid-committee-a"],
    "status": "ACTIVE"
  }
}
```

### Example 4: Announcement for All Volunteers and Admins

```json
{
  "title": "Thank You to Volunteers & Admins",
  "content": "Great work...",
  "targetCriteria": {
    "constituentTypes": ["VOLUNTEER", "ADMIN"],
    "status": "ACTIVE"
  }
}
```

_Logic:_ (Is Volunteer **OR** Is Admin) **AND** Is Active.
