/**
 * Removes duplicate projects that share the same title (case-insensitive).
 *
 * For each group of duplicates, the project with the most media is kept.
 * Ties broken by enrollment count, then by UUID (alphabetically first = kept).
 * Deleted rows cascade-remove their ProjectMedia and ProjectEnrollments via FK.
 *
 * Usage:
 *   Dry run (default — just shows what would be removed):
 *     npm run script -- dedupe-projects
 *
 *   Apply deletions:
 *     npm run script -- dedupe-projects --apply
 */

import dbClient from "@/configs/db";
import { eq, count } from "drizzle-orm";
import { Projects, ProjectMedia, ProjectEnrollments } from "@/db/schema/activities";

const APPLY = process.argv.includes("--apply");

async function main() {
  await dbClient.initialize();

  // Fetch every project
  const all = await dbClient.db
    .select({ id: Projects.id, title: Projects.title, status: Projects.status })
    .from(Projects);

  // Group by lowercase title
  const byTitle = new Map<string, typeof all>();
  for (const p of all) {
    const key = p.title.trim().toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(p);
  }

  const duplicateGroups = [...byTitle.values()].filter((g) => g.length > 1);

  if (duplicateGroups.length === 0) {
    console.log("No duplicate projects found. Nothing to do.");
    process.exit(0);
  }

  console.log(
    `Found ${duplicateGroups.length} duplicate group(s).\n` +
      (APPLY ? "Applying deletions...\n" : "DRY RUN — pass --apply to delete.\n"),
  );

  let totalDeleted = 0;

  for (const group of duplicateGroups) {
    // Gather media + enrollment counts for each project in this group
    const stats = await Promise.all(
      group.map(async (p) => {
        const [[mediaRow], [enrollRow]] = await Promise.all([
          dbClient.db
            .select({ n: count() })
            .from(ProjectMedia)
            .where(eq(ProjectMedia.projectId, p.id)),
          dbClient.db
            .select({ n: count() })
            .from(ProjectEnrollments)
            .where(eq(ProjectEnrollments.projectId, p.id)),
        ]);
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          media: Number(mediaRow?.n ?? 0),
          enrollments: Number(enrollRow?.n ?? 0),
        };
      }),
    );

    // Keep project with most data; ties → first UUID alphabetically
    const sorted = [...stats].sort((a, b) => {
      if (b.media !== a.media) return b.media - a.media;
      if (b.enrollments !== a.enrollments) return b.enrollments - a.enrollments;
      return a.id.localeCompare(b.id);
    });

    const keep = sorted[0];
    const remove = sorted.slice(1);

    console.log(`  "${keep.title}" — ${stats.length} copies`);
    console.log(
      `    KEEP   id=${keep.id}  status=${keep.status}  media=${keep.media}  enrollments=${keep.enrollments}`,
    );
    for (const d of remove) {
      console.log(
        `    DELETE id=${d.id}  status=${d.status}  media=${d.media}  enrollments=${d.enrollments}`,
      );
    }

    if (APPLY) {
      for (const d of remove) {
        await dbClient.db.delete(Projects).where(eq(Projects.id, d.id));
        totalDeleted++;
      }
    }
  }

  const wouldDelete = duplicateGroups.reduce((s, g) => s + g.length - 1, 0);
  console.log(
    APPLY
      ? `\nDone. Deleted ${totalDeleted} duplicate project(s).`
      : `\nDry run complete. ${wouldDelete} project(s) would be deleted. Run with --apply to proceed.`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
