# Test Isolation Strategy

**Date:** November 8, 2025  
**Project:** YPF Backend  
**Status:** Implemented

---

## Overview

This document describes the test isolation strategy currently implemented in the YPF Backend codebase. The strategy focuses on using **UUID-based unique identifiers** for test data to prevent conflicts when tests run concurrently or sequentially.

---

## Core Strategy

### UUID-Based Test Data Generation

The primary mechanism for test isolation is generating unique test data using UUIDs. This approach ensures that each test run creates data that won't conflict with previous or concurrent test runs.

**Location:** `tests/factories.ts`

### Test Data Factories

The codebase provides factory functions that generate unique test data:

```typescript
export function generateTestUser() {
  const uniqueId = randomUUID().substring(0, 8);
  return {
    email: `test-${uniqueId}@example.com`,
    password: faker.internet.password({ length: 16 }),
    name: {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    },
    constituentId: "",
  };
}
```

### Available Factories

1. **`generateTestUser()`** - Creates unique test user data
   - Generates unique email: `test-{uuid}@example.com`
   - Random password using faker
   - Random first and last names

2. **`generateTestChapter()`** - Creates unique test chapter data
   - Unique name: `Test Chapter {uuid}`
   - Random country, description, and founding date

3. **`generateTestCommittee()`** - Creates unique test committee data
   - Unique name: `Test Committee {uuid}`
   - Random description

4. **`generateTestEvent()`** - Creates unique test event data
   - Unique name: `Test Event {uuid}`
   - Random dates, location, and description

5. **`generateTestProject()`** - Creates unique test project data
   - Unique title: `Test Project {uuid}`
   - Random abstract, description, and dates

---

## Benefits

### 1. Fault Tolerance

- **No Hardcoded IDs**: Tests don't rely on specific hardcoded IDs or emails
- **Conflict Prevention**: Each test run generates unique data that won't conflict with existing data
- **Concurrent Execution**: Multiple test suites can run simultaneously without interference

### 2. Cleanup Resilience

- **Idempotent**: Tests can be re-run even if cleanup failed previously
- **No State Pollution**: Failed tests don't leave data that breaks subsequent tests
- **Database Independence**: Tests work regardless of the initial database state

### 3. Developer Experience

- **Simple to Use**: Just import and call the factory functions
- **Consistent Pattern**: All test data follows the same generation pattern
- **Easy Debugging**: UUID prefixes in names make test data easily identifiable

---

## Usage Example

```typescript
import { generateTestUser, generateTestChapter } from "../factories";

describe("Chapters API", () => {
  let testUser;
  let testChapter;

  beforeAll(async () => {
    // Generate unique test data
    testUser = generateTestUser();
    testChapter = generateTestChapter();

    // Create the test user
    await createUserInDatabase(testUser);

    // Create the test chapter
    await createChapterInDatabase(testChapter);
  });

  afterAll(async () => {
    // Cleanup (optional - next run will have different IDs anyway)
    await deleteUserByEmail(testUser.email);
    await deleteChapterByName(testChapter.name);
  });

  it("should retrieve chapter", async () => {
    const response = await request(app)
      .get(`/api/v1/chapters/${testChapter.id}`)
      .set("Cookie", authCookie);

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe(testChapter.name);
  });
});
```

---

## Cleanup Strategy

### Manual Cleanup

The current implementation uses **manual cleanup** in `afterAll` hooks:

```typescript
afterAll(async () => {
  // Delete test user by email
  await pgPool.db
    .delete(schema.Users)
    .where(eq(schema.Users.email, testUser.email));

  // Delete test chapter by name
  await pgPool.db
    .delete(schema.Chapters)
    .where(eq(schema.Chapters.name, testChapter.name));
});
```

### Why Manual Cleanup Works

1. **UUID-based names are unique** - Cleanup can target specific test data without affecting other tests
2. **Idempotent operations** - Delete by UUID/email will only remove the specific test data
3. **Fault-tolerant** - If cleanup fails, next run generates new unique IDs

---

## Test Configuration

### Vitest Configuration

**Location:** `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Ensures serial execution
      },
    },
  },
});
```

**Key Configuration:**

- **Single Fork Mode**: Tests run serially within a single process
- **Node Environment**: Standard Node.js environment for API testing
- **Setup Files**: Initializes database and services before tests

---

## Database Management

### Connection Pooling

The application uses `postgres-js` with Drizzle ORM:

```typescript
// configs/db.ts
class PgPool {
  private database: PostgresJsDatabase<Schema> | null = null;

  async initialize() {
    if (this.database) return;
    this.database = drizzle(postgres(variables.database.url), { schema });
  }
}
```

### Test Setup

**Location:** `tests/setup.ts`

```typescript
beforeAll(async () => {
  await Promise.all([emailer.initialize(), pgPool.initialize()]);
});

afterAll(async () => {
  pgPool.reset();
  logger.info("Test database cleaned up.");
});
```

---

## Best Practices

### DO ✅

1. **Always use factory functions** for generating test data
2. **Use unique identifiers** in all test data (emails, names, etc.)
3. **Clean up in afterAll** hooks to keep database clean
4. **Use descriptive test names** that include what they're testing
5. **Check for existing data** before creating if necessary

### DON'T ❌

1. **Don't use hardcoded emails or IDs** (e.g., `test@example.com`)
2. **Don't rely on specific database state** between tests
3. **Don't skip cleanup** - always clean up test data
4. **Don't share test data** between test suites
5. **Don't use `beforeEach` for expensive operations** - use `beforeAll` instead

---

## Future Enhancements

While the current UUID-based strategy works well, potential improvements include:

### 1. Transaction-Based Isolation

Wrap each test in a database transaction that rolls back:

```typescript
beforeEach(async () => {
  await pgPool.db.transaction(async (tx) => {
    // Store transaction for test
  });
});

afterEach(async () => {
  // Rollback transaction
});
```

**Benefits:**

- Automatic cleanup
- Complete isolation
- Faster test execution

**Challenges:**

- More complex to implement
- May not work with all test scenarios
- Requires refactoring of database access

### 2. Test Database Per Suite

Create a separate test database for each test suite:

```typescript
beforeAll(async () => {
  const dbName = `ypf_test_${randomUUID().substring(0, 8)}`;
  await createDatabase(dbName);
  await runMigrations(dbName);
});

afterAll(async () => {
  await dropDatabase(dbName);
});
```

**Benefits:**

- Complete isolation between suites
- Can run suites in parallel
- No cleanup needed (just drop database)

**Challenges:**

- Requires database creation permissions
- Slower setup time
- More complex infrastructure

### 3. Dedicated Test Environment

Use a separate test database with automatic cleanup:

```typescript
// .env.test
DATABASE_URL=postgresql://localhost:5432/ypf_test
```

**Benefits:**

- Isolated from development data
- Can reset entire database between runs
- Better separation of concerns

**Challenges:**

- Requires separate database setup
- Need to manage multiple database instances
- More complex CI/CD configuration

---

## Testing the Strategy

To verify the test isolation strategy works:

1. **Run tests multiple times:**

   ```bash
   npm test
   npm test  # Should pass even if cleanup failed
   ```

2. **Run specific test suites:**

   ```bash
   npm test -- chaptersRoutes
   npm test -- eventsRoutes
   ```

3. **Check for conflicts:**
   ```bash
   # Run the same test suite concurrently (in different terminals)
   npm test & npm test
   ```

If all tests pass consistently, the isolation strategy is working correctly.

---

## Troubleshooting

### Tests Fail with Unique Constraint Violations

**Cause:** Test is using hardcoded data instead of factory functions

**Solution:** Replace hardcoded data with factory-generated data:

```typescript
// ❌ Wrong
const testUser = { email: "test@example.com" };

// ✅ Correct
const testUser = generateTestUser();
```

### Tests Fail Intermittently

**Cause:** Tests might be sharing state or not cleaning up properly

**Solution:**

1. Ensure each test generates unique data
2. Verify cleanup in `afterAll` hooks
3. Check if tests modify shared data

### Database Connection Errors

**Cause:** Database pool not initialized or connection limit reached

**Solution:**

1. Verify database URL in `.env.test`
2. Check connection pool configuration
3. Ensure `pgPool.reset()` is called in `afterAll`

---

## Conclusion

The UUID-based test isolation strategy provides a simple, effective approach to preventing test conflicts. By generating unique identifiers for all test data, tests can run reliably regardless of database state or execution order.

This strategy balances simplicity with effectiveness, making it easy for developers to write and maintain tests while ensuring reliability in CI/CD environments.

---

**Document Version:** 2.0  
**Last Updated:** November 8, 2025  
**Status:** Implemented and Actively Used
