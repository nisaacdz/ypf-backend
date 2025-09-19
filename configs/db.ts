import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import envConfig from "./env";
import schema from "@/db/schema";

const connectionString = envConfig.databaseUrl;
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
