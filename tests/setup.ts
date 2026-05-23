import { beforeAll, afterAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import dbClient from "@/configs/db";
import emailer from "@/configs/emailer";
import logger from "@/configs/logger";
import variables from "@/configs/env";

variables.app.environment = "test";

beforeAll(async () => {
  await dbClient.initialize();
  // configs/db.ts only auto-migrates in production. Tests need the
  // schema to match the code that's about to query it, so apply any
  // pending migrations explicitly here. Drizzle's migrator is
  // idempotent — it records applied migrations in
  // `drizzle.__drizzle_migrations` and skips ones already in there.
  logger.info("Applying database migrations for the test suite…");
  await migrate(dbClient.db, { migrationsFolder: "./db/migrations" });
  logger.info("Test database schema is up to date.");
  await Promise.all([emailer.initialize()]);
});

afterAll(() => {
  logger.info("Database pool reset.");
});
