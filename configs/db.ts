import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import variables from "./env";
import schema from "@/db/schema";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import logger from "./logger";

type Schema = typeof schema;

class DbClient {
  private database: PostgresJsDatabase<Schema> | null = null;
  private _pool: Sql | null = null;

  async initialize(db?: PostgresJsDatabase<Schema>) {
    if (this.database) return;
    
    // Create connection pool with standard pooling options
    this._pool = postgres(variables.database.url, {
      max: 10, // Maximum number of connections in the pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
    });
    
    this.database =
      db ??
      drizzle(this._pool, {
        schema,
      });

    if (variables.app.isProduction) {
      logger.info("Running migrations on database...");
      await migrate(this.database, { migrationsFolder: "./db/migrations" });
      logger.info("Migrations complete.");
    }
  }

  reset() {
    this.database = null;
    this._pool = null;
  }

  get db() {
    if (!this.database) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.database;
  }

  get pool() {
    if (!this._pool) {
      throw new Error("Database pool not initialized. Call initialize() first.");
    }
    return this._pool;
  }
}

const dbClient = new DbClient();

export default dbClient;
