import dbClient from "@/configs/db";
import { sql } from "drizzle-orm";

async function main() {
  await dbClient.initialize();
  const rows = await dbClient.db.execute(sql`
    SELECT id, title, target_volunteers, budget
    FROM activities.projects
    ORDER BY title
  `) as unknown as Array<{ id: string; title: string; target_volunteers: number | null; budget: string | null }>;

  if (!rows.length) {
    console.log("No projects found.");
  } else {
    for (const r of rows) {
      console.log(`${r.title} | target_volunteers=${r.target_volunteers} | budget=${r.budget}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
