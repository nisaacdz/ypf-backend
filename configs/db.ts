import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import envConfig from "./env";

const connectionString = envConfig.databaseUrl;
const client = postgres(connectionString);

export const db = drizzle(client);
