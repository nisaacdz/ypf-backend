import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import variables from "./env";
import schema from "@/db/schema";

const connectionString = variables.databaseUrl;
const client = postgres(connectionString);

const db = drizzle(client, { schema });

export default db;
