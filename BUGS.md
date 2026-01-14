# Potential Bugs and Issues Report

This document outlines potential bugs, security concerns, and code quality issues identified in the YPF Backend codebase.

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [Security Vulnerabilities](#security-vulnerabilities)
3. [Race Conditions & Concurrency](#race-conditions--concurrency)
4. [Data Integrity Issues](#data-integrity-issues)
5. [Error Handling Problems](#error-handling-problems)
6. [Logic Bugs](#logic-bugs)
7. [Memory & Resource Leaks](#memory--resource-leaks)
8. [Configuration Issues](#configuration-issues)

---

## Critical Issues

### 1. Stock Decrement Without Rollback on Payment Failure

**Files:**

- [shared/services/shopService.ts](shared/services/shopService.ts#L150-L165)

**Description:**
When creating an order, stock is decremented within a database transaction. However, if the Paystack API call fails after the transaction commits, the stock remains decremented but the order is marked as failed. There's no mechanism to restore the stock.

**Impact:**

- Products may show as "out of stock" when they shouldn't be
- Inventory management becomes incorrect over time
- Lost sales due to falsely unavailable products

**Current Code:**

```typescript
// Stock decremented inside transaction
await Promise.all(
  validatedItems.map(
    (item) =>
      tx.update(schema.Products).set({
        stockQuantity: sql`${schema.Products.stockQuantity} - ${item.quantity}`,
      })
    // ...
  )
);
// Transaction commits here
// If Paystack fails below, stock is NOT restored
```

**Possible Fix:**
Implement a compensation mechanism that restores stock when payment initialization fails:

```typescript
} catch (apiError) {
  // Compensate stock
  await Promise.all(
    validatedItems.map((item) =>
      dbClient.db
        .update(schema.Products)
        .set({
          stockQuantity: sql`${schema.Products.stockQuantity} + ${item.quantity}`,
        })
        .where(eq(schema.Products.id, item.productId))
    )
  );
  // Mark transaction as failed...
  throw apiError;
}
```

---

### 2. Guest Order Creates Duplicate Constituents

**Files:**

- [shared/services/shopService.ts](shared/services/shopService.ts#L340-L365)

**Description:**
When a guest completes an order, a new `Constituent` is always created without checking if one already exists with the same email. This leads to duplicate constituents in the database.

**Impact:**

- Data fragmentation - same person has multiple constituent records
- Reporting inaccuracies
- Potential issues if the guest later registers as a member

**Current Code:**

```typescript
// Always creates new constituent without checking for existing
const [newConstituent] = await tx
  .insert(schema.Constituents)
  .values({
    firstName: payload.firstName,
    lastName: payload.lastName,
    email: payload.email,
    phone: payload.phone,
  })
  .returning();
```

**Possible Fix:**
Check for existing constituent by email first:

```typescript
let constituentId: string;

// Check for existing constituent
const [existing] = await tx
  .select({ id: schema.Constituents.id })
  .from(schema.Constituents)
  .where(eq(schema.Constituents.email, payload.email))
  .limit(1);

if (existing) {
  constituentId = existing.id;
} else {
  const [newConstituent] = await tx
    .insert(schema.Constituents)
    .values({ ... })
    .returning();
  constituentId = newConstituent.id;
}
```

---

### 3. OTP Expiry Check Missing in `completeGuestOrder`

**Files:**

- [shared/services/shopService.ts](shared/services/shopService.ts#L300-L330)

**Description:**
The `completeGuestOrder` function fetches OTP without checking if it's expired in the database query. It checks expiry manually afterward, but the query itself doesn't filter by `expiresAt`, potentially fetching an expired OTP from the database.

**Impact:**

- Slightly inefficient (minor)
- Could be exploited if the expiry check has bugs

**Current Code:**

```typescript
const [otpRecord] = await dbClient.db
  .select()
  .from(schema.Otps)
  .where(eq(schema.Otps.email, email)); // No expiry check in query
```

**Possible Fix:**
Add expiry check to the query itself for consistency:

```typescript
const [otpRecord] = await dbClient.db
  .select()
  .from(schema.Otps)
  .where(
    and(
      eq(schema.Otps.email, email),
      isNull(schema.Otps.usedAt),
      gte(schema.Otps.expiresAt, sql`now()`)
    )
  );
```

---

## Security Vulnerabilities

### 4. Weak Password Validation

**Files:**

- [features/api/v1/auth/schemas.ts](features/api/v1/auth/schemas.ts#L5-L10)

**Description:**
Password requirements are too lenient - only 4 characters minimum with no complexity requirements.

**Impact:**

- User accounts are vulnerable to brute force attacks
- Easy to guess passwords
- Security compliance issues

**Current Code:**

```typescript
password: z
  .string({ message: "Password is required." })
  .min(4, { message: "Password must be at least 4 characters." })
  .max(55, { message: "Password must not exceed 55 characters." }),
```

**Possible Fix:**
Implement stronger password requirements:

```typescript
password: z
  .string({ message: "Password is required." })
  .min(8, { message: "Password must be at least 8 characters." })
  .max(72, { message: "Password must not exceed 72 characters." }) // bcrypt limit
  .regex(/[A-Z]/, { message: "Password must contain an uppercase letter." })
  .regex(/[a-z]/, { message: "Password must contain a lowercase letter." })
  .regex(/[0-9]/, { message: "Password must contain a number." }),
```

---

### 5. Paystack Secret Key Used Without Validation

**Files:**

- [configs/env.ts](configs/env.ts#L41-L43)

**Description:**
The Paystack secret has a default empty string, meaning the application could run with payment functionality appearing to work but failing silently.

**Impact:**

- Payment API calls will fail
- Silent failures in production if environment variable is missing

**Current Code:**

```typescript
PAYSTACK_SECRET: z
  .string()
  .min(1, "PAYSTACK_SECRET is required")
  .default(""), // TODO remove default soon!
```

**Possible Fix:**
Remove the default and make it required in production:

```typescript
PAYSTACK_SECRET: z.string().min(1, "PAYSTACK_SECRET is required"),
```

---

### 6. Role Alias Mismatch in Authorization

**Files:**

- [configs/authorizer/roles.ts](configs/authorizer/roles.ts#L17-L27)

**Description:**
There's an inconsistency between how roles are defined in the code vs how they're stored in the database. The `MEMBER.chapterlead` role uses lowercase, but `getConstituentRoles` may produce different casing.

**Impact:**

- Authorization checks may fail unexpectedly
- Users may be denied access to resources they should have access to

**Current Code:**

```typescript
// In roles.ts - lowercase
chapterLead: (chapterId: string) =>
  Role.new(`MEMBER.chapterlead.${chapterId}`),

// In usersService.ts - uses MemberTitles.alias which could have different casing
CONCAT('MEMBER.', ${schema.MemberTitles.alias}, ...)
```

**Possible Fix:**
Normalize role strings to a consistent case:

```typescript
// Always use lowercase in Role comparisons
static new(expectedRole: string) {
  const normalized = expectedRole.toLowerCase();
  return new Role((role) => role.toLowerCase() === normalized);
}
```

---

### 7. SQL Injection Risk in Search Parameters

**Files:**

- [shared/services/membersService.ts](shared/services/membersService.ts#L110-L112)

**Description:**
While Drizzle ORM generally protects against SQL injection, the `ilike` pattern uses string interpolation which could be risky if special characters aren't escaped.

**Impact:**

- Potential SQL injection if special LIKE pattern characters (%, \_) are in user input
- Query manipulation

**Current Code:**

```typescript
if (search) {
  const fullName = sql<string>`concat(${schema.Constituents.firstName}, ' ', ${schema.Constituents.lastName})`;
  whereClauses.push(ilike(fullName, `%${search}%`));
}
```

**Possible Fix:**
Escape special LIKE characters:

```typescript
const escapedSearch = search.replace(/[%_\\]/g, "\\$&");
whereClauses.push(ilike(fullName, `%${escapedSearch}%`));
```

---

## Race Conditions & Concurrency

### 8. Race Condition in Order Stock Validation

**Files:**

- [shared/services/shopService.ts](shared/services/shopService.ts#L41-L85)

**Description:**
Stock is validated in `validateOrderItems` but there's a time gap before the actual stock decrement occurs in the transaction. Another concurrent order could claim the same stock.

**Impact:**

- Overselling products
- Negative stock quantities
- Customer complaints for unfulfillable orders

**Current Code:**

```typescript
// Validation happens here
const { validatedItems, totalAmount } = await validateOrderItems(items);

// Time gap...

// Decrement happens later in transaction
await dbClient.db.transaction(async (tx) => {
  // Stock might have changed!
  ...
});
```

**Possible Fix:**
Use `FOR UPDATE` locking or optimistic locking with version check:

```typescript
// Inside transaction, re-validate with locking
const products = await tx
  .select()
  .from(schema.Products)
  .where(inArray(schema.Products.id, productIds))
  .for("update"); // Lock rows

// Validate stock again
for (const item of items) {
  const product = products.find((p) => p.id === item.productId);
  if (product.stockQuantity < item.quantity) {
    throw new ApiError(`Stock changed for ${product.name}`, 409);
  }
}
```

---

### 9. Token Refresh Race Condition

**Files:**

- [shared/middlewares/auth.ts](shared/middlewares/auth.ts#L55-L85)

**Description:**
When refreshing tokens, there's no mechanism to prevent multiple concurrent requests from all trying to refresh at the same time, potentially causing issues.

**Impact:**

- Multiple tokens could be generated
- Slight inefficiency

**Possible Fix:**
Consider implementing token refresh with a short lock or using refresh token rotation with invalidation.

---

## Data Integrity Issues

### 10. Missing Cascade Deletes May Leave Orphaned Records

**Files:**

- [db/schema/finance.ts](db/schema/finance.ts#L62-L75)

**Description:**
The `Donations` table has `onDelete: "restrict"` for `transactionId`, which prevents deletion but if a transaction is somehow deleted by another means, donations could become orphaned.

**Impact:**

- Data integrity issues
- Orphaned records in the database

**Possible Fix:**
Ensure consistent use of cascade rules and add database-level constraints.

---

### 11. OTP Table Lacks Cleanup

**Files:**

- [db/schema/app.ts](db/schema/app.ts#L34-L41)
- [shared/jobs/workers/cleanupWorker.ts](shared/jobs/workers/cleanupWorker.ts) (if exists)

**Description:**
Expired and used OTPs are never cleaned up from the database. Over time, this table will grow unbounded.

**Impact:**

- Database bloat
- Slower queries on the OTP table
- Storage costs

**Possible Fix:**
Add a scheduled cleanup job:

```typescript
// In cleanup worker
await dbClient.db
  .delete(schema.Otps)
  .where(
    or(
      lt(schema.Otps.expiresAt, sql`now() - interval '1 day'`),
      and(
        isNotNull(schema.Otps.usedAt),
        lt(schema.Otps.usedAt, sql`now() - interval '1 hour'`)
      )
    )
  );
```

---

## Error Handling Problems

### 12. Silent Email Failures in Application Submission

**Files:**

- [shared/services/applicationsService.ts](shared/services/applicationsService.ts#L85-L90)

**Description:**
Email failures are caught and logged but not reported back to the user or tracked for retry.

**Impact:**

- Users may not receive confirmation emails
- No visibility into email delivery failures
- Important communications lost

**Current Code:**

```typescript
sendMembershipApplicationAcknowledgementEmail({...}).catch((error) => {
  logger.error("Failed to send application acknowledgement email", error);
});
```

**Possible Fix:**
Use the job queue for sending emails to ensure retries:

```typescript
await jobDispatcher.client.send(
  JobNames.SEND_EMAIL,
  {
    to: constituentData.email,
    subject: "Application Received",
    html: generateEmailHtml(...),
  },
  { retryLimit: 3 }
);
```

---

### 13. Unhandled Promise in `verifyTransaction`

**Files:**

- [features/api/v1/transactions/transactionsHandler.ts](features/api/v1/transactions/transactionsHandler.ts#L15-L17)

**Description:**
`sendTransactionSuccessEmail` is called without `await` and without `.catch()`, meaning failures are completely silent.

**Impact:**

- Email failures are not logged
- No error tracking
- Users may not receive important notifications

**Current Code:**

```typescript
if (result.wasUpdated && result.status === "COMPLETED") {
  transactionsService.sendTransactionSuccessEmail(result.transactionId);
  // No await, no catch!
}
```

**Possible Fix:**
Either await or add error handling:

```typescript
if (result.wasUpdated && result.status === "COMPLETED") {
  transactionsService
    .sendTransactionSuccessEmail(result.transactionId)
    .catch((err) =>
      logger.error(err, "Failed to send transaction success email")
    );
}
```

---

### 14. Database Pool Not Properly Closed

**Files:**

- [configs/db.ts](configs/db.ts#L32-L36)

**Description:**
The `reset()` method sets pool to null but doesn't actually close existing connections.

**Impact:**

- Connection leaks if `reset()` is called
- Resource exhaustion

**Current Code:**

```typescript
reset() {
  this._db = null;
  this._pool = null; // Connections not closed!
}
```

**Possible Fix:**
Close the pool before resetting:

```typescript
async reset() {
  if (this._pool) {
    await this._pool.end();
  }
  this._db = null;
  this._pool = null;
}
```

---

## Logic Bugs

### 15. Incorrect Cookie Max Age for Access Token

**Files:**

- [features/api/v1/auth/index.ts](features/api/v1/auth/index.ts#L23-L31)
- [shared/middlewares/auth.ts](shared/middlewares/auth.ts#L62-L71)

**Description:**
The access token has `expiresIn: "30m"` but the cookie `maxAge` is set to 3 days. This means the cookie persists long after the token is invalid.

**Impact:**

- Confusion about token validity
- Cookie storage used unnecessarily
- Slight security concern (cookie stays around longer than needed)

**Current Code:**

```typescript
const accessToken = encodeData(authenticatedUser, { expiresIn: "30m" });
res.cookie("access_token", accessToken, {
  ...
  maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days - but token expires in 30 min!
});
```

**Possible Fix:**
Align cookie maxAge with refresh mechanism needs:

```typescript
res.cookie("access_token", accessToken, {
  ...
  maxAge: 30 * 60 * 1000, // 30 minutes to match token expiry
});
```

---

### 16. Chat Namespace Allows Unauthenticated Connections

**Files:**

- [features/chat/v1/index.ts](features/chat/v1/index.ts#L1-L17)

**Description:**
Unlike the notifications namespace, the chat namespace doesn't check if the user is authenticated before allowing connection. It only uses `user?.id` which could be undefined.

**Impact:**

- Unauthenticated users could connect to chat
- Potential security issue
- Undefined user ID in room joins

**Current Code:**

```typescript
chatNamespace.on("connection", (socket: Socket) => {
  const user = socket.request.User;
  socket.join(`user:${user?.id}`); // user could be undefined!
  // No authentication check!
});
```

**Possible Fix:**
Add authentication middleware like notifications:

```typescript
chatNamespace.use((socket, next) => {
  if (!socket.request.User) {
    return next(new Error("Authentication required"));
  }
  next();
});
```

---

### 17. Donation Callback URL Uses Host Instead of Dashboard URL

**Files:**

- [shared/services/donationsService.ts](shared/services/donationsService.ts#L250-L255)

**Description:**
The Paystack callback URL uses `variables.app.host` (the API server) instead of a frontend URL, which would redirect users to the backend after payment.

**Impact:**

- Poor user experience after payment
- Users land on API endpoint instead of a proper page
- Confusion for users

**Current Code:**

```typescript
body: JSON.stringify({
  ...
  callback_url: `${variables.app.host}/donations/callback`,
});
```

**Possible Fix:**
Use the dashboard URL for callbacks:

```typescript
callback_url: `${variables.app.dashboardUrl}/donations/callback`,
```

---

### 18. `and()` with Empty Array Produces Invalid SQL

**Files:**

- [shared/services/donationsService.ts](shared/services/donationsService.ts#L57-L60)
- [shared/services/eventsService.ts](shared/services/eventsService.ts#L44)

**Description:**
When `whereClauses` is empty, calling `and(...whereClauses)` with an empty spread might produce unexpected results.

**Impact:**

- Potential runtime errors
- Incorrect query behavior

**Current Code:**

```typescript
const whereClauses = [];
// ... conditionally push
.where(and(...whereClauses)) // Empty spread!
```

**Possible Fix:**
Check for empty array:

```typescript
const whereClause = whereClauses.length > 0 ? and(...whereClauses) : undefined;
.where(whereClause)
```

---

## Memory & Resource Leaks

### 19. Temp Files May Not Be Cleaned Up on Success

**Files:**

- [shared/middlewares/errorHandler.ts](shared/middlewares/errorHandler.ts#L8-L38)

**Description:**
The `cleanupFiles` function is only called in the error handler. If a request succeeds, temp files are cleaned up in individual upload functions, but if there's a bug in those functions, files could be left behind.

**Impact:**

- Disk space consumption over time
- Potential disk full errors

**Possible Fix:**
Consider using `onFinished` middleware to always clean up:

```typescript
import onFinished from "on-finished";

app.use((req, res, next) => {
  onFinished(res, () => cleanupFiles(req));
  next();
});
```

---

### 20. Redis Connection Not Closed on Shutdown

**Files:**

- [app.ts](app.ts#L9-L30)
- [configs/redis.ts](configs/redis.ts#L1-L75)

**Description:**
The Redis client is initialized but never explicitly closed during shutdown, unlike the database pool.

**Impact:**

- Open connections during shutdown
- Potential issues with connection pooling

**Current Code:**

```typescript
async function shutdown() {
  // Redis is not closed!
  await jobDispatcher.shutdown();
  emailer.transporter.close();
  await dbClient.pool.end({ timeout: 5 });
}
```

**Possible Fix:**
Add Redis disconnect to shutdown:

```typescript
async function shutdown() {
  await jobDispatcher.shutdown();
  if (redisClient._redis) {
    await redisClient._redis.quit();
  }
  emailer.transporter.close();
  await dbClient.pool.end({ timeout: 5 });
}
```

---

## Configuration Issues

### 21. Rate Limit Too Low for Normal Operations

**Files:**

- [configs/server.ts](configs/server.ts#L39)

**Description:**
The global rate limit is set to 99 requests per 15 minutes, which is quite restrictive for a modern web application.

**Impact:**

- Legitimate users may be rate limited
- Poor user experience for power users
- API integrations may fail

**Current Code:**

```typescript
app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 99 }));
```

**Possible Fix:**
Increase limit or implement tiered rate limiting:

```typescript
app.use(rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 500 }));

// Or use different limits per route
app.use(
  "/api/v1/auth",
  rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 20 })
);
```

---

### 22. CORS Credentials Without Proper Origin Validation

**Files:**

- [configs/server.ts](configs/server.ts#L24-L30)

**Description:**
While CORS is configured with specific origins, if `ALLOWED_ORIGINS` contains a wildcard or is misconfigured, it could expose credentials to unauthorized origins.

**Impact:**

- Potential CSRF vulnerabilities
- Cookie theft if misconfigured

**Possible Fix:**
Add validation to ensure origins are properly formatted:

```typescript
// In env.ts
ALLOWED_ORIGINS: z
  .string()
  .transform((val) => val.split(",").map((s) => s.trim()))
  .refine(
    (origins) => origins.every(o => o.startsWith("http")),
    "Origins must be valid URLs"
  ),
```

---

### 23. Video Dimensions Set to 0x0

**Files:**

- [shared/utils/files.ts](shared/utils/files.ts#L54-L58)

**Description:**
For video uploads, dimensions are hardcoded to 0x0 because getting actual video dimensions is complex. This loses metadata.

**Impact:**

- No video dimension metadata stored
- Cannot display proper aspect ratio without loading video
- Poor UX for video display

**Current Code:**

```typescript
if (isVideo) {
  dimensions = { width: 0, height: 0 }; // Hardcoded!
}
```

**Possible Fix:**
Use ffprobe or a video metadata library:

```typescript
import ffprobe from "ffprobe";
if (isVideo) {
  const data = await ffprobe(file.path);
  const videoStream = data.streams.find((s) => s.codec_type === "video");
  dimensions = {
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
  };
}
```

---

## Summary

| Severity | Count | Categories                                         |
| -------- | ----- | -------------------------------------------------- |
| Critical | 3     | Stock management, data duplication, OTP handling   |
| High     | 4     | Security vulnerabilities                           |
| Medium   | 10    | Race conditions, data integrity, logic bugs        |
| Low      | 6     | Error handling, resource management, configuration |

### Recommended Priority:

1. **Immediate:** Fix stock decrement rollback, guest constituent duplication, password requirements
2. **Short-term:** Address race conditions in order processing, fix authorization role casing
3. **Medium-term:** Implement OTP cleanup, fix email error handling, close resources properly
4. **Long-term:** Refactor callback URLs, improve rate limiting, add video dimension extraction
