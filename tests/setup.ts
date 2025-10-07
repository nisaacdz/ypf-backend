import { beforeAll, afterAll } from "vitest";
import pgPool from "@/configs/db";
import authorizer from "@/configs/authorizer";
import emailer from "@/configs/emailer";
import { migrate } from "drizzle-orm/postgres-js/migrator";

beforeAll(async () => {
  pgPool.initialize();

  console.log("Running migrations on in-memory database...");
  await migrate(pgPool.db, { migrationsFolder: "db/migrations" });
  console.log("Migrations complete.");

  await Promise.all([emailer.initialize(), authorizer.initialize()]);
});

afterAll(() => {
  pgPool.reset();
  console.log("Database pool reset.");
});
