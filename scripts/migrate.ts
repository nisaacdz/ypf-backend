import pgPool from "@/configs/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function runMigrations() {
  console.log("Starting migrations...");
  try {
    await migrate(pgPool.db, { migrationsFolder: "./db/migrations" });
    console.log("Migrations applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error applying migrations:", error);
    process.exit(1);
  }
}

runMigrations();
