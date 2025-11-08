import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import variables from "./env";
import schema from "@/db/schema";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import logger from "./logger";

type Schema = typeof schema;

class DbClient {
  private _db: PostgresJsDatabase<Schema> | null = null;
  private _pool: Sql | null = null;

  async initialize() {
    if (this._db) return;

    this._pool = postgres(variables.database.url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    this._db = drizzle(this._pool, {
      schema,
    });

    if (variables.app.isProduction) {
      logger.info("Running migrations on database...");
      await migrate(this._db, { migrationsFolder: "./db/migrations" });
      logger.info("Migrations complete.");
    }
  }

  reset() {
    this._db = null;
    this._pool = null;
  }

  get db() {
    if (!this._db) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this._db;
  }

  get pool() {
    if (!this._pool) {
      throw new Error(
        "Database pool not initialized. Call initialize() first.",
      );
    }
    return this._pool;
  }
}

const dbClient = new DbClient();

export default dbClient;
