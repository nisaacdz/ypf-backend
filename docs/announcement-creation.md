# Announcement Creation

**Status:** Implemented
**Endpoint:** `POST /api/v1/announcements`

## Overview

The Announcement Creation API allows authorized users ("Leaders") to create and target announcements to specific groups of constituents. The targeting system is flexible, allowing for complex combinations of criteria (e.g., "Active Members AND (Volunteers OR Donors)").

## Authorization

Access is restricted to users with the following roles:

- **Super Admins** (`ADMIN.SUPER`)
- **Regular Admins** (`ADMIN.REGULAR`)
- **Leaders** (Any role matching `MEMBER.*`, e.g., `MEMBER.president`, `MEMBER.chapterLead`)

## Request Body

The request body must conform to the `CreateAnnouncementSchema`.

```typescript
{
  title: string;          // Required, 1-255 chars
  content: string;        // Required, min 1 char
  status?: "DRAFT" | "PUBLISHED"; // Default: "DRAFT"
  sendAt?: string;        // ISO 8601 datetime string (optional, for future scheduling)
  targetCriteria: AudienceRule; // Required, see below
}
```

## Targeting Criteria (`AudienceRule`)

The `targetCriteria` field defines who receives the announcement. It is a recursive structure that can be either an **Atomic Rule** or a **Composite Rule**.

### 1. Atomic Rules

Atomic rules target specific segments of the population. All atomic rules have a `kind` property.

#### `CONSTITUENTS`

Targets the general constituent base.

```json
{
  "kind": "CONSTITUENTS",
  "filters": {
    "isActive": true,
    "hasEmail": true
  }
}
```

#### `MEMBERS`

Targets members based on scope, status, or roles.

```json
{
  "kind": "MEMBERS",
  "status": "ACTIVE", // "ACTIVE" | "PAST" | "ALL"
  "scope": {
    "chapterId": "uuid...",
    "committeeId": "uuid..."
  },
  "roles": ["PRESIDENT", "TREASURER"]
}
```

#### `VOLUNTEERS`

Targets volunteers.

```json
{
  "kind": "VOLUNTEERS",
  "status": "ACTIVE" // "ACTIVE" | "PAST" | "ALL"
}
```

#### `ADMINS`

Targets administrators.

```json
{
  "kind": "ADMINS",
  "roles": ["SUPER_ADMIN", "REGULAR_ADMIN"],
  "status": "ACTIVE"
}
```

#### `PROFILES`

Targets specific profile types (Directors, Auditors).

```json
{
  "kind": "PROFILES",
  "profileType": "DIRECTOR", // "DIRECTOR" | "AUDITOR"
  "status": "ACTIVE"
}
```

#### `LEADERS`

Targets all organizational leaders (Members with Titles + Admins with Roles).

```json
{
  "kind": "LEADERS",
  "status": "ACTIVE"
}
```

#### `DONORS`

Targets constituents based on donation history.

```json
{
  "kind": "DONORS",
  "minTotalDonation": 100,
  "currency": "USD",
  "period": {
    "start": "2023-01-01T00:00:00Z",
    "end": "2023-12-31T23:59:59Z"
  }
}
```

#### `SPECIFIC_USERS`

Targets a specific list of constituent IDs.

```json
{
  "kind": "SPECIFIC_USERS",
  "constituentIds": ["uuid-1", "uuid-2"]
}
```

### 2. Composite Rules

Composite rules combine other rules using logical operators.

#### `OR` (Union)

Matches if **ANY** of the sub-rules match.

```json
{
  "op": "OR",
  "rules": [ ...AudienceRules ]
}
```

#### `AND` (Intersection)

Matches if **ALL** of the sub-rules match.

```json
{
  "op": "AND",
  "rules": [ ...AudienceRules ]
}
```

#### `NOT` (Exclusion)

Matches if the sub-rule does **NOT** match.

```json
{
  "op": "NOT",
  "rule": AudienceRule
}
```

## Examples

### Example 1: Announcement for Active Members

```json
{
  "title": "Monthly Update",
  "content": "Here is the update for this month...",
  "status": "PUBLISHED",
  "targetCriteria": {
    "kind": "MEMBERS",
    "status": "ACTIVE"
  }
}
```

### Example 2: Announcement for Leadership OR High Value Donors

```json
{
  "title": "Strategic Planning Meeting",
  "content": "Please join us...",
  "targetCriteria": {
    "op": "OR",
    "rules": [
      {
        "kind": "LEADERS",
        "status": "ACTIVE"
      },
      {
        "kind": "DONORS",
        "minTotalDonation": 1000,
        "currency": "USD"
      }
    ]
  }
}
```

### Example 3: Announcement for Volunteers but NOT Past Members

```json
{
  "title": "New Volunteer Orientation",
  "content": "Welcome to the team...",
  "targetCriteria": {
    "op": "AND",
    "rules": [
      {
        "kind": "VOLUNTEERS",
        "status": "ACTIVE"
      },
      {
        "op": "NOT",
        "rule": {
          "kind": "MEMBERS",
          "status": "PAST"
        }
      }
    ]
  }
}
```
