import { describe, it, expect, beforeAll, afterAll } from "vitest";
import dbClient from "@/configs/db";

describe("DbClient", () => {
  beforeAll(async () => {
    await dbClient.initialize();
  });

  afterAll(async () => {
    // Clean up after tests
    await dbClient.pool.end();
    dbClient.reset();
  });

  it("should expose a pool getter after initialization", () => {
    expect(dbClient.pool).toBeDefined();
    expect(typeof dbClient.pool.end).toBe("function");
  });

  it("should throw an error when accessing pool before initialization", async () => {
    const uninitializedClient = new (dbClient.constructor as any)();
    expect(() => uninitializedClient.pool).toThrow(
      "Database pool not initialized. Call initialize() first.",
    );
  });

  it("should throw an error when accessing db before initialization", () => {
    const uninitializedClient = new (dbClient.constructor as any)();
    expect(() => uninitializedClient.db).toThrow(
      "Database not initialized. Call initialize() first.",
    );
  });

  it("should have database instance after initialization", () => {
    expect(dbClient.db).toBeDefined();
  });

  it("should allow querying the database through the pool", async () => {
    // Simple query to verify pool is working
    const result = await dbClient.db.execute`SELECT 1 as value`;
    expect(result).toBeDefined();
  });
});
