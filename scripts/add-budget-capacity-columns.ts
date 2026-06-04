/**
 * One-time script: adds budget to projects and max_capacity to events.
 * Safe to run multiple times — skips each column if it already exists.
 *
 * Run: npm run script -- add-budget-capacity-columns
 */
import dbClient from "@/configs/db";
import { sql } from "drizzle-orm";

async function addColumnIfMissing(
  table: string,
  column: string,
  definition: string,
) {
  const rows = await dbClient.db.execute(sql.raw(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = split_part('${table}', '.', 1)
      AND table_name  = split_part('${table}', '.', 2)
      AND column_name = '${column}'
  `)) as unknown as unknown[];

  if ((rows as { length?: number }).length === 0) {
    await dbClient.db.execute(
      sql.raw(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`),
    );
    console.log(`  + Added ${table}.${column}`);
  } else {
    console.log(`  - ${table}.${column} already exists, skipped`);
  }
}

async function main() {
  await dbClient.initialize();

  console.log("Applying column additions...");
  await addColumnIfMissing(
    "activities.projects",
    "budget",
    "numeric(12, 2)",
  );
  await addColumnIfMissing(
    "activities.events",
    "max_capacity",
    "integer",
  );
  await addColumnIfMissing(
    "activities.projects",
    "target_volunteers",
    "integer",
  );

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
