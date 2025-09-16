import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import envConfig from "./env";

if (!envConfig.databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const connectionString = envConfig.databaseUrl;
const client = postgres(connectionString);

export const db = drizzle(client);
