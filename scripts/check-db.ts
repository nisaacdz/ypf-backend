import dbClient from "../configs/db";
import { sql } from "drizzle-orm";

async function checkTables() {
    try {
        await dbClient.initialize();

        console.log("Checking tables in 'core' schema...");
        const tables = await dbClient.db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'core'
    `);

        console.log("Tables found:", tables);

        console.log("\nChecking types in 'core' schema...");
        const types = await dbClient.db.execute(sql`
      SELECT typname 
      FROM pg_type t 
      JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE n.nspname = 'core'
    `);
        console.log("Types found:", types);

        process.exit(0);
    } catch (error) {
        console.error("Error checking tables:", error);
        process.exit(1);
    }
}

checkTables();
