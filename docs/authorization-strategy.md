# Authorization Strategy

**Status:** Implemented
**Location:** `configs/authorizer/`

## Overview

The authorization system uses a flexible **Visitor** pattern combined with a **Role-based** access control (RBAC) model. It allows for defining granular access rules that can be composed together.

## Core Components

### 1. Visitors (`configs/authorizer/index.ts`)

The `Visitors` class provides static guard functions that return a boolean indicating if access is granted.

- **`Visitors.ALL`**: Public access.
- **`Visitors.AUTHENTICATED`**: Requires a valid user session (`req.User`).
- **`Visitors.hasProfile(...profiles)`**: Checks if the user has one of the specified profiles (e.g., "ADMIN", "MEMBER").
- **`Visitors.hasRole(...roles)`**: Checks if the user has a specific role.

### 2. Role Definitions (`configs/authorizer/roles.ts`)

Roles are defined as objects with a `cmp` (compare) function, allowing for dynamic matching (e.g., wildcards).

```typescript
// Exact match
export const ADMIN = {
  REGULAR: new Role((role) => role === "ADMIN.REGULAR"),
};

// Dynamic match (e.g., chapter lead for any chapter)
export const MEMBER = {
  chapterLead: (chapterId: string) =>
    new Role((role) => role === `MEMBER.lead.${chapterId}`),
};
```

### 3. Combinators

Guard functions can be combined using `anyOf` (OR) and `allOf` (AND).

```typescript
import { Visitors, anyOf } from "@/configs/authorizer";

// Allow if user is an ADMIN OR if they are the chapter lead for the specific resource
const canEditChapter = anyOf(
  Visitors.hasProfile("ADMIN"),
  Visitors.hasRole(MEMBER.chapterLead(chapterId)),
);
```

## Usage in Routes

Apply the guards in your route handlers or middleware.

```typescript
router.post(
  "/chapters/:id/events",
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.params.id)),
    ),
  ),
  controller.createEvent,
);
```
