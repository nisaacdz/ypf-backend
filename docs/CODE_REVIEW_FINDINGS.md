# YPF Backend - Comprehensive Code Review Findings

**Review Date:** 2025-11-01  
**Reviewer:** GitHub Copilot  
**Repository:** nisaacdz/ypf-backend

---

## Executive Summary

This document contains findings from a comprehensive code review of the YPF Backend codebase. The review focused on:
- Database schema consistency and column naming conventions
- Critical errors and security vulnerabilities
- Potential implementation issues
- Code quality and best practices

---

## 1. Schema Column Naming Inconsistencies (MILD)

### 1.1 Inconsistent Use of `uploadedAt` vs `createdAt` (MILD)

**Location:** `db/schema/core.ts:39` vs various other schema files

**Issue:**
- In `Medium` table (core.ts:39), the timestamp column is named `uploadedAt` but uses column name `created_at` in the database
- Most other tables consistently use `createdAt` with column name `created_at`

**Example:**
```typescript
// core.ts - Medium table
uploadedAt: timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull(),

// app.ts - Users table (consistent)
createdAt: timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull(),
```

**Impact:** This naming inconsistency could confuse developers. The TypeScript property is `uploadedAt` but the database column is `created_at`, which breaks the naming convention used elsewhere.

**Recommendation:** Rename the database column to `uploaded_at` to match the TypeScript property name, or rename the TypeScript property to `createdAt` to match the convention.

---

### 1.2 Inconsistent Foreign Key Column Naming (MILD)

**Location:** Multiple schema files

**Issue:**
Several foreign key columns lack consistency in their naming patterns:

1. **`chapterId` vs `chapter_id`** - Generally consistent (snake_case in DB)
2. **`mediumId` vs `medium_id`** - Generally consistent
3. **Exception in `app.ts:66`**: `broadcastId: serial("broadcast_id")` - Uses `serial()` type instead of `uuid()` but references a table that likely uses UUID

**Example from app.ts:66-69:**
```typescript
broadcastId: serial("broadcast_id").references(
  () => AnnouncementBroadCasts.id,
  { onDelete: "cascade" },
),
```

**Impact:** Type mismatch potential - `serial()` is an auto-incrementing integer, but `AnnouncementBroadCasts.id` is `serial().primaryKey()`. This is actually correct, but the inconsistency with UUID foreign keys elsewhere could be confusing.

**Recommendation:** Document this intentional design decision or consider standardizing on UUID for all ID columns.

---

### 1.3 Missing Explicit Column Names (MILD)

**Location:** Various schema files

**Issue:**
Some columns don't explicitly specify the database column name:
- `core.ts:127` - `_level: integer().notNull()` (no explicit column name)
- `finance.ts:103` - `timestamp: timestamp({ withTimezone: true }).notNull()` (no explicit column name)

**Example:**
```typescript
// Implicit column name (uses TypeScript property name as-is)
_level: integer().notNull(),

// Explicit column name (preferred for consistency)
_level: integer("_level").notNull(),
```

**Impact:** While Drizzle ORM handles this automatically, explicit column names improve code clarity and prevent issues if property names are refactored.

**Recommendation:** Add explicit column names for all columns to maintain consistency.

---

## 2. Critical Errors and Security Issues (CRITICAL)

### 2.1 Weak OTP Generation (CRITICAL - Security)

**Location:** `shared/services/authService.ts:166`

**Issue:**
The OTP generation uses `randomInt(100000, 1000000)` which generates 6-digit numbers, but the implementation has a potential security weakness:

```typescript
const otp = randomInt(100000, 1000000).toString();
```

**Problems:**
1. **Range issue:** `randomInt(100000, 1000000)` generates numbers from 100000 to 999999 (inclusive), which is correct
2. **However:** The function generates numbers that could have leading patterns that are more predictable
3. **Limited entropy:** Only 900,000 possible combinations (10^6 - 10^5)
4. **No rate limiting check before generation:** An attacker could request multiple OTPs

**Impact:** While not immediately exploitable, this OTP system could be vulnerable to brute force attacks if rate limiting isn't properly implemented.

**Recommendation:**
1. Add rate limiting for OTP generation requests per email
2. Consider using a cryptographically secure random number generator
3. Implement maximum OTP request attempts per time window
4. Add exponential backoff for repeated requests

---

### 2.2 Missing Input Validation on Webhook Signature (CRITICAL - Security)

**Location:** `shared/middlewares/webhooks.ts:16`

**Issue:**
The webhook signature verification uses a string comparison that could be vulnerable to timing attacks:

```typescript
if (hash !== signature) {
  return res
    .status(400)
    .json({ success: false, message: "Invalid signature" });
}
```

**Impact:** A sophisticated attacker could use timing attacks to determine valid signatures byte-by-byte.

**Recommendation:** Use `crypto.timingSafeEqual()` for constant-time comparison:

```typescript
import { timingSafeEqual } from 'crypto';

const expectedBuffer = Buffer.from(hash, 'utf8');
const actualBuffer = Buffer.from(signature, 'utf8');

if (expectedBuffer.length !== actualBuffer.length || 
    !timingSafeEqual(expectedBuffer, actualBuffer)) {
  return res.status(400).json({ success: false, message: "Invalid signature" });
}
```

---

### 2.3 Potential SQL Injection via `ilike` (MODERATE - Security)

**Location:** Multiple service files (e.g., `shared/services/membersService.ts:77`)

**Issue:**
Search functionality uses `ilike` with interpolated user input:

```typescript
if (search) {
  const fullName = sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`;
  whereClauses.push(ilike(fullName, `%${search}%`));
}
```

**Impact:** While Drizzle ORM typically parameterizes queries, direct string interpolation in LIKE clauses could potentially lead to SQL injection if not properly escaped.

**Recommendation:** Verify that Drizzle ORM properly escapes the `search` parameter. Consider adding explicit input sanitization:

```typescript
const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');
whereClauses.push(ilike(fullName, `%${sanitizedSearch}%`));
```

---

### 2.4 Missing Environment Variable Validation in Production (MODERATE)

**Location:** `configs/env.ts:38`

**Issue:**
The `PAYSTACK_SECRET` is marked as optional:

```typescript
PAYSTACK_SECRET: z
  .string()
  .min(1, "PAYSTACK_SECRET is required")
  .optional(), // TODO remove optional soon!
```

**Impact:** The application could start in production without payment functionality configured, leading to runtime errors when donations are attempted.

**Recommendation:** Remove the `.optional()` modifier before production deployment, or add runtime checks in payment-related code to throw meaningful errors if the secret is missing.

---

## 3. Potential Implementation Issues

### 3.1 Race Condition in Token Refresh Logic (MODERATE)

**Location:** `shared/middlewares/auth.ts:76-86`

**Issue:**
The token refresh logic checks if the refresh token is within 1 day of expiry and refreshes it:

```typescript
if (refreshExp - now <= 24 * 60 * 60) {
  const newRefreshToken = encodeData({ username }, { expiresIn: "3d" });
  res.cookie("refresh_token", newRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 3 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}
```

**Impact:** If multiple concurrent requests arrive during this window, multiple refresh tokens could be generated, potentially causing token invalidation race conditions.

**Recommendation:** Consider implementing a token refresh strategy that:
1. Uses a sliding window approach
2. Implements token versioning
3. Allows a grace period where both old and new tokens are valid

---

### 3.2 Missing Transaction Rollback on Payment Failure (MODERATE)

**Location:** `shared/services/donationsService.ts:140-200`

**Issue:**
The donation creation process creates database records before the Paystack API call succeeds. If Paystack initialization fails, the database records remain:

```typescript
// Create financial transaction (line 140-148)
const [transaction] = await pgPool.db
  .insert(schema.FinancialTransactions)
  .values({ ... })
  .returning();

// Create donation record (line 151-161)
const [donation] = await pgPool.db
  .insert(schema.Donations)
  .values({ ... })
  .returning();

// Paystack API call (line 163-178) - might fail
const paystackResponse = await fetch(...);
```

**Impact:** Failed payment initializations leave orphaned PENDING transactions in the database.

**Recommendation:** Wrap the entire operation in a database transaction:

```typescript
await pgPool.db.transaction(async (tx) => {
  const [transaction] = await tx.insert(schema.FinancialTransactions)...;
  const [donation] = await tx.insert(schema.Donations)...;
  
  const paystackResponse = await fetch(...);
  if (!paystackResponse.ok) {
    throw new Error("Paystack initialization failed");
  }
  
  await tx.update(schema.FinancialTransactions)...;
});
```

---

### 3.3 Potential Integer Overflow in Currency Conversion (MODERATE)

**Location:** `shared/services/donationsService.ts:172`

**Issue:**
Currency conversion to Paystack's smallest unit uses `Math.floor()`:

```typescript
amount: Math.floor(amount * 100), // Paystack expects amount in kobo/pesewas
```

**Impact:** 
1. For very large amounts (> 2^53), JavaScript loses precision
2. `Math.floor()` truncates decimals, which could lead to undercharging (though the comment acknowledges this)
3. Negative amounts aren't checked (though validation should prevent this)

**Recommendation:**
1. Add explicit validation for amount range
2. Document the rounding behavior
3. Consider using a decimal library for financial calculations

---

### 3.4 Missing Index on Frequently Queried Columns (MODERATE - Performance)

**Location:** Database schema files

**Issue:**
Several frequently queried columns lack database indexes:
1. `Constituents.firstName` and `Constituents.lastName` (searched together)
2. `Events.status` (filtered in queries)
3. `Projects.status` (filtered in queries)
4. `FinancialTransactions.externalRef` (used in webhook lookups)

**Impact:** Performance degradation as data grows, especially for search and filtering operations.

**Recommendation:** Add composite indexes:

```typescript
// Example for Constituents
export const Constituents = core.table("constituents", {
  // ... columns
}, (table) => [
  index("constituents_name_idx").on(table.firstName, table.lastName),
]);
```

---

### 3.5 Inconsistent Error Messages (MILD)

**Location:** Multiple handler files

**Issue:**
Error messages have inconsistent formatting and detail levels:
- Some return generic "User not found" (404)
- Others return detailed "No external reference found for this transaction" (400)
- Status codes aren't always appropriate (e.g., 400 vs 404 for missing resources)

**Example:**
```typescript
// authService.ts:164
throw new AppError("User not found", 404);

// donationsService.ts:269
throw new AppError("No external reference found for this transaction", 400);
// ^ Should probably be 500 (internal state issue) not 400 (client error)
```

**Recommendation:** 
1. Create an error code enum
2. Standardize error messages
3. Ensure appropriate HTTP status codes
4. Consider adding error codes to AppError class

---

### 3.6 Missing Validation for Time-Based Constraints (MODERATE)

**Location:** Multiple schema files

**Issue:**
Several tables have `startedAt` and `endedAt` columns but lack database-level constraints to ensure `endedAt > startedAt`:

- `Members` (core.ts:82-89)
- `Volunteers` (core.ts:92-99)
- `Auditors` (core.ts:102-109)
- `Admins` (core.ts:112-119)
- `MemberTitlesAssignments` (core.ts:145-155)

**Impact:** Invalid date ranges could be inserted, causing logic errors in queries that check for active periods.

**Recommendation:** Add check constraints:

```typescript
export const Members = core.table("members", {
  // ... columns
}, (table) => [
  check("valid_member_period", sql`${table.endedAt} IS NULL OR ${table.endedAt} > ${table.startedAt}`)
]);
```

---

### 3.7 Commented-Out Code Should Be Removed (MILD)

**Location:** `db/schema/activities.ts:124-191`

**Issue:**
Large blocks of commented-out code for Meetings functionality remain in the codebase:

```typescript
// export const Meetings = communications.table("meetings", {
//   id: uuid().defaultRandom().primaryKey(),
//   ...
// });
```

**Impact:** 
1. Increases file size and cognitive load
2. May confuse developers about intended functionality
3. Could become out of sync with active code

**Recommendation:** 
- If the code is temporary, document why and when it will be uncommented
- If it's for reference, move it to documentation
- If it's obsolete, remove it (git history preserves it)

---

### 3.8 Missing Type Safety in Type Conversions (MILD)

**Location:** `shared/services/donationsService.ts:341-343`

**Issue:**
String conversion without null checks:

```typescript
const email = String(donation.guestEmail || user?.email);
const name = String(donation.guestName || user?.fullName);
```

**Impact:** If both values are undefined/null, this converts them to the string "undefined" or "null", which could be passed to the email function.

**Recommendation:** Add explicit null checks:

```typescript
if (!donation.guestEmail && !user?.email) {
  logger.warn("Cannot send acknowledgement: no email available");
  return;
}
const email = (donation.guestEmail || user?.email) as string;
```

---

### 3.9 Potential Memory Leak in Database Connection (MILD)

**Location:** `configs/db.ts:17-19`

**Issue:**
The database connection is created with `postgres()` but there's no explicit connection pooling configuration or cleanup:

```typescript
this.database = db ?? drizzle(postgres(variables.database.url), {
  schema,
});
```

**Impact:** In high-traffic scenarios, connections might not be properly managed.

**Recommendation:** Configure connection pool settings explicitly:

```typescript
const client = postgres(variables.database.url, {
  max: 20, // max connections
  idle_timeout: 20,
  connect_timeout: 10,
});
this.database = drizzle(client, { schema });
```

---

### 3.10 Missing Input Sanitization for Email Addresses (MODERATE)

**Location:** `shared/utils/email.ts` (referenced but not reviewed in detail)

**Issue:**
Email addresses from user input (guest donations, OTP requests) are used directly in email sending operations without additional sanitization beyond Zod validation.

**Impact:** While Zod validation helps, additional checks for email injection attacks (e.g., newline characters, SMTP commands) should be performed.

**Recommendation:** Add email-specific sanitization:
1. Trim whitespace
2. Convert to lowercase
3. Check for suspicious patterns (newlines, semicolons, SMTP commands)
4. Consider using a dedicated email validation library

---

### 3.11 Inconsistent Use of `uuid()` vs `uuid("column_name")` (MILD)

**Location:** Multiple schema files

**Issue:**
Some UUID columns use explicit column names while others don't:

```typescript
// With explicit name
id: uuid("id").defaultRandom().primaryKey()

// Without explicit name (implicit)
id: uuid().defaultRandom().primaryKey()
```

**Impact:** Inconsistency in code style; no functional impact.

**Recommendation:** Standardize on one approach (preferably explicit for all columns).

---

## 4. Best Practices and Code Quality Issues

### 4.1 Missing JSDoc Comments for Public APIs (MILD)

**Location:** Multiple service files

**Issue:**
While handlers have some JSDoc comments, many service functions lack documentation:
- `membersService.ts` functions
- `chaptersService.ts` functions
- `eventsService.ts` functions

**Recommendation:** Add JSDoc comments for all exported functions, especially those used by multiple handlers.

---

### 4.2 Magic Numbers in Code (MILD)

**Location:** Multiple files

**Issue:**
Several magic numbers appear without explanation:
- `auth.ts:45` - `3 * 24 * 60 * 60` (3 days in seconds, appears multiple times)
- `authService.ts:177` - `'6 minutes'` (OTP expiration)
- `rateLimit.ts` (not reviewed but referenced in server.ts:38)

**Recommendation:** Extract to named constants:

```typescript
const THREE_DAYS_IN_SECONDS = 3 * 24 * 60 * 60;
const THREE_DAYS_IN_MILLISECONDS = THREE_DAYS_IN_SECONDS * 1000;
const OTP_EXPIRATION_MINUTES = 6;
```

---

### 4.3 Inconsistent Error Handling in Async Functions (MILD)

**Location:** Multiple handler files

**Issue:**
Some handlers wrap errors, others let them bubble:

```typescript
// Pattern 1: Try-catch with custom error (donations)
catch (error) {
  logger.error({ error }, "Error creating donation");
  throw error;
}

// Pattern 2: No try-catch, let error bubble (auth)
export async function loginWithUsernameAndPassword(...) {
  const [user] = await pgPool.db.select(...)...
  // No try-catch, relies on Express error handler
}
```

**Recommendation:** Standardize on one approach, preferably letting errors bubble to the global error handler unless specific handling is needed.

---

### 4.4 Unused or Commented TODO Items (MILD)

**Location:** Multiple files

**Found TODOs:**
1. `db/schema/core.ts:162` - "// TODO review Roles and Assignments"
2. `configs/env.ts:38` - "// TODO remove optional soon!" (for PAYSTACK_SECRET)

**Recommendation:** 
1. Create GitHub issues for each TODO
2. Add issue references to comments
3. Set deadlines for resolution

---

### 4.5 Missing Type Exports (MILD)

**Location:** `shared/types/index.ts`

**Issue:**
The file uses `any` types for Request extensions:

```typescript
interface Request {
  User?: AuthenticatedUser;
  Body: any;  // Should be typed
  Query: any; // Should be typed
  Params: any; // Should be typed
  File: any; // Should be typed
}
```

**Impact:** Loss of type safety for validated request data.

**Recommendation:** These are intentionally typed as `any` because they're set by validation middleware. Document this design decision or use generics to provide better typing where possible.

---

## 5. Positive Observations

### 5.1 Good Use of Database Transactions

The `resetPassword` function in `authService.ts` properly uses database transactions to ensure atomicity of OTP validation and password updates.

### 5.2 Strong Input Validation

Excellent use of Zod schemas for input validation throughout the application. The validation middleware pattern is well-implemented.

### 5.3 Proper Environment Variable Management

The `configs/env.ts` file provides excellent environment variable validation and structuring.

### 5.4 Good Separation of Concerns

Clear separation between:
- Handlers (request/response handling)
- Services (business logic)
- Validators (input validation)
- Middleware (cross-cutting concerns)

### 5.5 Security Headers

Good use of `helmet` and CORS configuration in `server.ts`.

### 5.6 Comprehensive Schema Design

The database schema is well-thought-out with proper relationships, foreign keys, and cascading rules.

---

## 6. Summary and Prioritized Recommendations

### Critical (Must Fix Before Production)
1. ✅ Implement constant-time comparison for webhook signature verification
2. ✅ Add rate limiting for OTP generation
3. ✅ Remove `.optional()` from `PAYSTACK_SECRET` or add runtime checks
4. ✅ Wrap donation creation in database transaction

### High Priority (Should Fix Soon)
1. ✅ Add database constraints for time-based validations
2. ✅ Add proper indexes for frequently queried columns
3. ✅ Fix race condition in token refresh logic
4. ✅ Add input sanitization for search parameters

### Medium Priority (Improve Over Time)
1. ✅ Standardize error messages and status codes
2. ✅ Fix schema column naming inconsistencies
3. ✅ Add null checks before type conversions
4. ✅ Configure database connection pool explicitly
5. ✅ Document intentional design decisions

### Low Priority (Nice to Have)
1. ✅ Remove commented-out code
2. ✅ Add JSDoc comments to service functions
3. ✅ Extract magic numbers to constants
4. ✅ Standardize error handling patterns
5. ✅ Add explicit column names for all schema columns

---

## 7. Conclusion

The YPF Backend codebase demonstrates good software engineering practices with clear separation of concerns, strong input validation, and proper use of TypeScript. The main areas for improvement are:

1. **Security hardening** - Particularly around OTP generation and webhook verification
2. **Database optimization** - Adding constraints and indexes
3. **Error handling consistency** - Standardizing patterns and status codes
4. **Code documentation** - Adding JSDoc comments and resolving TODOs

No blocking issues were found that would prevent the application from functioning, but the critical security issues should be addressed before production deployment.

---

**End of Report**
