import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import variables from "./env";
import schema from "@/db/schema";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import logger from "./logger";

type Schema = typeof schema;

class PgPool {
  private database: PostgresJsDatabase<Schema> | null = null;

  async initialize(db?: PostgresJsDatabase<Schema>) {
    if (this.database) return;
    this.database =
      db ??
      drizzle(postgres(variables.database.url), {
        schema,
      });

    logger.info("Running migrations on database...");
    await migrate(this.database, { migrationsFolder: "./db/migrations" });
    logger.info("Migrations complete.");
  }

  reset() {
    this.database = null;
  }

  get db() {
    if (!this.database) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.database;
  }
}

const pgPool = new PgPool();

export default pgPool;
