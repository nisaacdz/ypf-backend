import { db } from "../configs/db";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as dotenv from "dotenv";

dotenv.config();

async function runMigrations() {
  console.log("Starting migrations...");
  try {
    // This command now expects the path to the migrations folder
    await migrate(db, { migrationsFolder: "./db/migrations" });
    console.log("Migrations applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error applying migrations:", error);
    process.exit(1);
  }
}

runMigrations();
