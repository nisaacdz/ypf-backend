import dbClient from "@/configs/db";
import { sql } from "drizzle-orm";

async function resetDatabase() {
    console.log("🗑️  Starting database reset...");

    try {
        await dbClient.initialize();

        console.log("Dropping schemas...");

        // Drop all custom schemas
        await dbClient.db.execute(sql`DROP SCHEMA IF EXISTS app CASCADE`);
        await dbClient.db.execute(sql`DROP SCHEMA IF EXISTS activities CASCADE`);
        await dbClient.db.execute(sql`DROP SCHEMA IF EXISTS finance CASCADE`);
        await dbClient.db.execute(sql`DROP SCHEMA IF EXISTS shop CASCADE`);
        await dbClient.db.execute(sql`DROP SCHEMA IF EXISTS core CASCADE`);

        console.log("✅ Schemas dropped!");
        console.log("📦 Creating empty schemas...");

        // Create the schemas (empty, no tables yet)
        await dbClient.db.execute(sql`CREATE SCHEMA app`);
        await dbClient.db.execute(sql`CREATE SCHEMA core`);
        await dbClient.db.execute(sql`CREATE SCHEMA activities`);
        await dbClient.db.execute(sql`CREATE SCHEMA finance`);
        await dbClient.db.execute(sql`CREATE SCHEMA shop`);

        console.log("✅ Empty schemas created successfully!");
        console.log("📝 Next steps:");
        console.log("   1. Run: npx drizzle-kit push");
        console.log("   2. Run: npx tsx scripts/seed.ts");

        process.exit(0);
    } catch (error) {
        console.error("❌ Reset failed:", error);
        process.exit(1);
    }
}

resetDatabase();