import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import variables from "./env";
import schema from "@/db/schema";

type Schema = typeof schema;

class PgPool {
  private pool: PostgresJsDatabase<Schema> | null = null;

  initialize(client?: Sql) {
    if (this.pool) return;
    this.pool = drizzle(client ? client : postgres(variables.databaseUrl), {
      schema,
    });

    return this.pool;
  }

  reset() {
    this.pool = null;
  }

  get db() {
    if (!this.pool) {
      throw new Error("Database not initialized. Call initialize() first.");
    }
    return this.pool;
  }
}

const pgPool = new PgPool();

export default pgPool;
