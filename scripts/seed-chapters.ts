/**
 * Seed YPF Africa university chapters + their chapter-scoped titles.
 *
 * Parallels `seed-org-structure.ts` (which handles committees) — same
 * idempotent shape so it's safe to re-run any number of times. Each
 * chapter gets two titles: `chapterhead` (level 5) and `chapterlead`
 * (level 10), matching the role-string grammar that
 * `usersService.getConstituentRoles` and the authorizer helpers expect.
 *
 * The seven chapters seeded here are the active campus chapters confirmed
 * by YPF Africa as of 2026. Add/remove rows in CHAPTERS to grow the list.
 *
 * Run from your laptop against PRODUCTION:
 *
 *   DATABASE_URL='postgresql://…?sslmode=require' \
 *     npx tsx scripts/seed-chapters.ts
 */

import { and, eq } from "drizzle-orm";

import dbClient from "@/configs/db";
import schema from "@/db/schema";

type ChapterSeed = {
  name: string;
  country: string;
  description: string;
  headLevel: number;
  leadLevel: number;
};

const CHAPTERS: ChapterSeed[] = [
  {
    name: "University of Ghana",
    country: "Ghana",
    description: "YPF Africa chapter at the University of Ghana, Legon.",
    headLevel: 5,
    leadLevel: 10,
  },
  {
    name: "University of Cape Coast",
    country: "Ghana",
    description: "YPF Africa chapter at the University of Cape Coast.",
    headLevel: 5,
    leadLevel: 10,
  },
  {
    name: "University of Education, Winneba",
    country: "Ghana",
    description: "YPF Africa chapter at the University of Education, Winneba.",
    headLevel: 5,
    leadLevel: 10,
  },
  {
    name: "Ashesi University",
    country: "Ghana",
    description: "YPF Africa chapter at Ashesi University.",
    headLevel: 5,
    leadLevel: 10,
  },
  {
    name: "University of Energy and Natural Resources",
    country: "Ghana",
    description:
      "YPF Africa chapter at the University of Energy and Natural Resources, Sunyani.",
    headLevel: 5,
    leadLevel: 10,
  },
  {
    name: "University of Mines and Technology",
    country: "Ghana",
    description:
      "YPF Africa chapter at the University of Mines and Technology, Tarkwa.",
    headLevel: 5,
    leadLevel: 10,
  },
  {
    name: "Kwame Nkrumah University of Science and Technology",
    country: "Ghana",
    description: "YPF Africa chapter at KNUST, Kumasi.",
    headLevel: 5,
    leadLevel: 10,
  },
];

async function seed(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
) {
  console.log("🏫  Seeding YPF Africa university chapters...\n");

  let chaptersCreated = 0;
  let chaptersUpdated = 0;
  let titlesCreated = 0;
  let titlesUpdated = 0;

  for (const c of CHAPTERS) {
    // Match by exact name — `core.chapters.name` isn't UNIQUE in the
    // schema, but operationally we treat (name, country) as the identity.
    const existing = await tx.query.Chapters.findFirst({
      where: and(
        eq(schema.Chapters.name, c.name),
        eq(schema.Chapters.country, c.country),
      ),
    });

    let chapterId: string;
    if (existing) {
      await tx
        .update(schema.Chapters)
        .set({ description: c.description })
        .where(eq(schema.Chapters.id, existing.id));
      chapterId = existing.id;
      chaptersUpdated++;
      console.log(`  ↻ ${c.name}`);
    } else {
      const [inserted] = await tx
        .insert(schema.Chapters)
        .values({
          name: c.name,
          country: c.country,
          description: c.description,
        })
        .returning();
      chapterId = inserted.id;
      chaptersCreated++;
      console.log(`  + ${c.name}`);
    }

    // Title aliases use the `chapter*` prefix so the role string emitted
    // by `usersService.getConstituentRoles` ("MEMBER.<alias>.<chapterId>")
    // matches what the authorizer helpers check
    // ("MEMBER.chapterhead.<id>", "MEMBER.chapterlead.<id>").
    // See `docs/title-aliases.md` for the grammar.
    const titles = [
      { name: "Chapter Head", alias: "chapterhead", level: c.headLevel },
      { name: "Chapter Lead", alias: "chapterlead", level: c.leadLevel },
    ];

    for (const t of titles) {
      const existingTitle = await tx.query.MemberTitles.findFirst({
        where: and(
          eq(schema.MemberTitles.alias, t.alias),
          eq(schema.MemberTitles.chapterId, chapterId),
        ),
      });

      if (existingTitle) {
        await tx
          .update(schema.MemberTitles)
          .set({ title: t.name, _level: t.level })
          .where(eq(schema.MemberTitles.id, existingTitle.id));
        titlesUpdated++;
      } else {
        await tx.insert(schema.MemberTitles).values({
          title: t.name,
          alias: t.alias,
          description: `${t.name} of ${c.name}`,
          _level: t.level,
          chapterId,
        });
        titlesCreated++;
      }
    }
  }

  console.log("");
  console.log(
    `✅ Chapters: ${chaptersCreated} created, ${chaptersUpdated} updated`,
  );
  console.log(
    `✅ Titles:   ${titlesCreated} created, ${titlesUpdated} updated  (${CHAPTERS.length} chapters × 2 titles each)`,
  );
}

dbClient
  .initialize()
  .then(() => dbClient.db.transaction(seed))
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
