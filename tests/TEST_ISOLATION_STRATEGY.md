# Test Isolation Strategy - Investigation and Solutions

## Executive Summary

This document analyzes the test isolation issues in the YPF Backend test suite and proposes practical solutions to ensure reliable, concurrent test execution without requiring extensive codebase changes.

## Problem Statement

Tests currently share the same `DATABASE_URL` and other resources with the development environment. When multiple test instances run simultaneously (e.g., in GitHub Actions CI runs, local development, or multiple CI jobs), tests experience intermittent failures that are difficult to reproduce.

## Root Cause Analysis

### 1. **Shared Database Resource**

**Issue**: All test environments use the same `DATABASE_URL` from environment variables.

**Evidence**:
- `vitest.config.ts` loads `.env.test` but falls back to default `.env`
- `configs/env.ts` reads `DATABASE_URL` from `process.env`
- GitHub Actions CI workflow uses the same `DATABASE_URL` secret for all runs
- No database-level isolation mechanism exists

**Impact**: When tests run concurrently, they all operate on the same database tables simultaneously, causing:
- Data race conditions
- Unpredictable test data states
- Cleanup operations affecting other running tests

### 2. **Hardcoded Test Data Identifiers**

**Issue**: Tests use hardcoded, predictable identifiers for test entities.

**Evidence from codebase**:

```typescript
// tests/integration/authRoutes.ts
const testUser = {
  email: "login-test@example.com",  // Static, not unique
  password: "SecurePassword123!",
  // ...
};

// tests/integration/chaptersRoutes.ts
const testUser = {
  email: "chapters-test@example.com",  // Static, not unique
  // ...
};

// tests/integration/committeesRoutes.ts
const testUser = {
  email: "committees-test@example.com",  // Static, not unique
  // ...
};

// tests/integration/membersRoutes.ts
const testUser = {
  email: "members-test@example.com",  // Static, not unique
  // ...
};
```

**Impact**: When the same test suite runs twice concurrently:
1. First run's `beforeAll` creates user with email "login-test@example.com"
2. Second run's `beforeAll` tries to create the same user → **Unique constraint violation**
3. Or first run's `afterAll` deletes the user while second run is using it → **Test failures**

### 3. **Shared Application Instance**

**Issue**: The test Express application is cached and reused across all tests.

**Evidence from `tests/app.ts`**:
```typescript
let app: Express | null = null;

export async function createTestApp(): Promise<Express> {
  if (app) return app;  // Returns cached instance
  
  app = express();
  // ... setup
  return app;
}
```

**Impact**: All tests share the same Express instance, potentially causing:
- Middleware state pollution
- Route handler side effects affecting other tests
- Socket/connection leaks

### 4. **Global Database Connection Pool**

**Issue**: A singleton database connection pool is shared across all tests.

**Evidence from `configs/db.ts`**:
```typescript
class PgPool {
  private database: PostgresJsDatabase<Schema> | null = null;

  async initialize(db?: PostgresJsDatabase<Schema>) {
    if (this.database) return;  // Only initializes once
    this.database = db ?? drizzle(postgres(variables.database.url), { schema });
    // ...
  }
}

const pgPool = new PgPool();  // Singleton instance
export default pgPool;
```

**Impact**:
- All tests share the same connection pool
- No per-test transaction isolation
- Cleanup operations affect all running tests

### 5. **No Transaction-Level Isolation**

**Issue**: Tests modify the database directly without transaction rollback mechanisms.

**Evidence**:
- Tests use `INSERT`, `DELETE`, `UPDATE` directly on the shared database
- No transaction wrapping around test execution
- Cleanup is done in `afterAll` hooks, not automatic rollback
- If a test fails mid-execution, cleanup might not run, polluting the database

### 6. **Vitest Configuration Limitations**

**Current configuration** (`vitest.config.ts`):
```typescript
pool: "forks",
poolOptions: {
  forks: {
    singleFork: true,  // Forces serial execution
  },
},
```

**Impact**: While `singleFork: true` prevents tests from running in parallel within a single process, it doesn't prevent:
- Multiple CI jobs running simultaneously
- Local development tests running while CI is running
- Multiple developer machines running tests against the same database

## Critical Scenarios Leading to Failures

### Scenario 1: Concurrent Test Runs (Most Common)
```
Time    | CI Job 1                          | CI Job 2
--------|-----------------------------------|-----------------------------------
T0      | Start authRoutes tests            | Start authRoutes tests
T1      | Delete "login-test@example.com"   | Delete "login-test@example.com"
T2      | Create user                       | Create user ❌ (Already exists)
T3      | Run test                          | Test fails
T4      | Delete user                       | User already deleted ❌
```

### Scenario 2: Cleanup Race Condition
```
Time    | Test Suite A                      | Test Suite B
--------|-----------------------------------|-----------------------------------
T0      | Create constituent C1             | Create constituent C2
T1      | Create user U1 with C1            | Create user U2 with C2
T2      | Test completes                    | Using U2 in tests
T3      | afterAll: Delete C1               | afterAll: Delete C2
T4      | -                                 | Tests using U2 fail ❌ (C2 deleted)
```

### Scenario 3: Shared State Pollution
```
Time    | Test File 1                       | Test File 2
--------|-----------------------------------|-----------------------------------
T0      | Create chapter "Test Chapter"     | Query all chapters
T1      | Run tests                         | Expects N chapters
T2      | -                                 | Finds N+1 chapters ❌
```

## Proposed Solutions

### Solution 1: Database-Level Isolation (Recommended)

**Approach**: Use unique database schemas or test databases for each test run.

**Implementation**:

1. **Modify `.env.test`** to use a template database URL:
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/ypf_test_template
TEST_DATABASE_PREFIX=ypf_test
```

2. **Create a test database helper** (`tests/helpers.ts`):
```typescript
import { randomUUID } from 'crypto';
import postgres from 'postgres';

export function getTestDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || '';
  const testId = randomUUID().substring(0, 8);
  const dbName = `${process.env.TEST_DATABASE_PREFIX || 'ypf_test'}_${testId}`;
  
  // Replace database name in URL
  return baseUrl.replace(/\/[^\/]+$/, `/${dbName}`);
}

export async function createTestDatabase(url: string): Promise<void> {
  const baseUrl = process.env.DATABASE_URL || '';
  const sql = postgres(baseUrl);
  const dbName = url.split('/').pop();
  
  try {
    await sql`CREATE DATABASE ${sql(dbName)} TEMPLATE ypf_test_template`;
  } finally {
    await sql.end();
  }
}

export async function dropTestDatabase(url: string): Promise<void> {
  const baseUrl = process.env.DATABASE_URL || '';
  const sql = postgres(baseUrl);
  const dbName = url.split('/').pop();
  
  try {
    await sql`DROP DATABASE IF EXISTS ${sql(dbName)}`;
  } finally {
    await sql.end();
  }
}
```

3. **Update `tests/setup.ts`**:
```typescript
import { beforeAll, afterAll } from "vitest";
import pgPool from "@/configs/db";
import emailer from "@/configs/emailer";
import logger from "@/configs/logger";
import { createTestDatabase, dropTestDatabase, getTestDatabaseUrl } from "./helpers";

let testDbUrl: string;

beforeAll(async () => {
  testDbUrl = getTestDatabaseUrl();
  await createTestDatabase(testDbUrl);
  
  // Initialize pool with test database
  process.env.DATABASE_URL = testDbUrl;
  await pgPool.initialize();
  await Promise.all([emailer.initialize()]);
});

afterAll(async () => {
  pgPool.reset();
  await dropTestDatabase(testDbUrl);
  logger.info("Test database cleaned up.");
});
```

**Pros**:
- Complete isolation between test runs
- No changes to individual test files
- Works with concurrent CI jobs
- Clean slate for each test run

**Cons**:
- Requires database creation permissions
- Slightly slower setup time
- Need to maintain a template database with schema

### Solution 2: Dynamic Test Data (Simple, Immediate Fix)

**Approach**: Use random identifiers for test data to avoid collisions.

**Implementation**:

1. **Create a test data factory** (`tests/factories.ts`):
```typescript
import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';

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

export function generateTestChapter() {
  const uniqueId = randomUUID().substring(0, 8);
  return {
    id: "",
    name: `Test Chapter ${uniqueId}`,
    country: faker.location.country(),
    description: faker.lorem.sentence(),
    foundingDate: faker.date.past(),
  };
}

// Similar factories for other entities...
```

2. **Update test files** (example for `authRoutes.ts`):
```typescript
import { generateTestUser } from "../factories";

describe("Authentication API", () => {
  let app: Express;
  const testUser = generateTestUser(); // Now unique per run

  beforeAll(async () => {
    app = await createTestApp();
    
    // Cleanup is now safe as email is unique
    await pgPool.db
      .delete(schema.Users)
      .where(eq(schema.Users.email, testUser.email));
    
    // ... rest of setup
  });
  
  // ... tests
});
```

**Pros**:
- Simple to implement
- Immediate benefit
- No infrastructure changes
- Minimal code changes

**Cons**:
- Doesn't solve all isolation issues
- Database still shared (potential cleanup issues)
- Doesn't prevent all race conditions

### Solution 3: Transaction-Based Isolation (Advanced)

**Approach**: Wrap each test in a database transaction that rolls back after completion.

**Implementation**:

1. **Create transaction wrapper** (`tests/helpers.ts`):
```typescript
import { beforeEach, afterEach } from "vitest";
import pgPool from "@/configs/db";

let transaction: any = null;

export function setupTestTransaction() {
  beforeEach(async () => {
    transaction = await pgPool.db.transaction((tx) => {
      return tx;
    });
  });

  afterEach(async () => {
    if (transaction) {
      await transaction.rollback();
      transaction = null;
    }
  });
}

export function getTestDb() {
  return transaction || pgPool.db;
}
```

2. **Use in tests**:
```typescript
import { setupTestTransaction, getTestDb } from "../helpers";

describe("Authentication API", () => {
  setupTestTransaction();
  
  it("should create user", async () => {
    const db = getTestDb();
    await db.insert(schema.Users).values({ /* ... */ });
    // Automatically rolled back after test
  });
});
```

**Pros**:
- Automatic cleanup
- True test isolation
- Fast execution

**Cons**:
- Complex to implement correctly
- Requires significant refactoring
- May not work with all database operations
- External services (email, file storage) still need mocking

## Recommended Implementation Plan

### Phase 1: Immediate Fix (Low Effort, High Impact)

**Implement Solution 2: Dynamic Test Data**

1. Create `tests/factories.ts` with data generators
2. Update each test file to use dynamic data (6 files)
3. Verify tests pass locally and in CI

**Estimated effort**: 2-4 hours
**Risk**: Low

### Phase 2: Complete Isolation (Medium Effort, Complete Solution)

**Implement Solution 1: Database-Level Isolation**

1. Set up template database with schema
2. Create database helper functions
3. Update `tests/setup.ts` to use per-run databases
4. Update CI workflow to create template database
5. Document database permissions required

**Estimated effort**: 4-8 hours
**Risk**: Medium (requires DBA permissions)

### Phase 3: Advanced Optimization (Optional)

**Implement Solution 3: Transaction-Based Isolation**

1. Create transaction management utilities
2. Refactor tests to use transaction wrapper
3. Handle edge cases (migrations, external services)

**Estimated effort**: 8-16 hours
**Risk**: High (complex refactoring)

## Additional Recommendations

### 1. Separate Test Environment Configuration

Create a dedicated `.env.test` file:
```env
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/ypf_test
# Use separate test credentials/resources for:
# - Azure Storage (separate container)
# - ImageKit (test account)
# - SMTP (test email service or mock)
```

### 2. Mock External Services

Update `tests/setup.ts` to mock external services in test environment:
```typescript
if (process.env.NODE_ENV === 'test') {
  // Mock imagekit
  // Mock azure storage
  // Mock email sender
}
```

### 3. Improve Vitest Configuration

Remove `singleFork: true` once isolation is implemented:
```typescript
// vitest.config.ts
pool: "forks",
poolOptions: {
  forks: {
    singleFork: false,  // Allow parallel execution
    maxForks: 4,        // Control concurrency
  },
},
```

### 4. CI/CD Improvements

Update GitHub Actions workflow:
```yaml
jobs:
  test:
    strategy:
      matrix:
        test-shard: [1, 2, 3, 4]  # Parallel shards
    steps:
      # ... existing steps
      - name: Run tests
        run: npm run test -- --shard=${{ matrix.test-shard }}/4
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          TEST_DATABASE_PREFIX: ypf_test_ci_${{ github.run_id }}_${{ matrix.test-shard }}
```

## Conclusion

The test isolation issues stem from shared database resources and predictable test data identifiers. The recommended approach is a two-phase implementation:

1. **Phase 1 (Immediate)**: Implement dynamic test data generation to eliminate the most common failure mode
2. **Phase 2 (Complete)**: Implement database-level isolation for true test independence

This strategy provides immediate relief while building toward a robust, scalable testing infrastructure that supports concurrent test execution across multiple environments.

## References

- Test Setup: `tests/setup.ts`
- Vitest Config: `vitest.config.ts`
- Database Config: `configs/db.ts`
- CI Workflow: `.github/workflows/ci.yml`
- Integration Tests: `tests/integration/*.ts`
