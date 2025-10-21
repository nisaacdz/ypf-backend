import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import variables from "./env";
import schema from "@/db/schema";

type Schema = typeof schema;

class PgPool {
  private database: PostgresJsDatabase<Schema> | null = null;

  initialize(db?: PostgresJsDatabase<Schema>) {
    if (this.database) return;
    this.database =
      db ??
      drizzle(postgres(variables.database.url), {
        schema,
      });
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
