import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { and, eq } from "drizzle-orm";

type CommitteeSeed = {
  name: string;
  alias: string;
  description: string;
  chairLevel: number;
  memberLevel: number;
};

const COMMITTEES: CommitteeSeed[] = [
  {
    name: "YPF Executives",
    alias: "executives",
    description: "Top-level executive leadership of YPF Africa.",
    chairLevel: 0,
    memberLevel: 10,
  },
  {
    name: "Management Board",
    alias: "management_board",
    description:
      "Responsible for governance, approvals, and organizational direction.",
    chairLevel: 5,
    memberLevel: 15,
  },
  {
    name: "Advisory Board",
    alias: "advisory_board",
    description:
      "Senior advisors providing strategic guidance to the organization.",
    chairLevel: 10,
    memberLevel: 20,
  },
  {
    name: "Human Resource Management Committee",
    alias: "hr",
    description:
      "Member onboarding, applications, title assignments, and personnel records.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Legal Committee",
    alias: "legal",
    description: "Legal compliance, contracts, partnerships review, and policy.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Financial Committee",
    alias: "finance",
    description:
      "Finances, budgets, donations, dues, and expenditures.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Welfare Committee",
    alias: "welfare",
    description:
      "Member well-being and welfare-focused projects and beneficiaries.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Media and Content Committee",
    alias: "media",
    description:
      "Announcements, content calendar, and event/project media.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Graphics Team",
    alias: "graphics",
    description: "Brand assets, design requests, and visual identity.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Records Management Committee",
    alias: "records_mgmt",
    description:
      "Member directory, attendance, certificates, and archives.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Programs and Records Committee",
    alias: "programs_records",
    description:
      "Programs, event scheduling, attendance, and outcome reporting.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Sponsorship and Partnership Committee",
    alias: "sponsorship",
    description: "Partner and sponsor relationships and contracts.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Technical Committee",
    alias: "technical",
    description:
      "Infrastructure, integrations, releases, and internal tooling.",
    chairLevel: 20,
    memberLevel: 40,
  },
  {
    name: "Institutional Committee",
    alias: "institutional",
    description:
      "Oversees all chapters and inter-chapter coordination.",
    chairLevel: 20,
    memberLevel: 40,
  },
];

async function seed(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
) {
  console.log("🏛  Seeding YPF Africa governance structure...\n");

  let committeesCreated = 0;
  let committeesUpdated = 0;
  let titlesCreated = 0;
  let titlesUpdated = 0;

  for (const c of COMMITTEES) {
    const existing = await tx.query.Committees.findFirst({
      where: eq(schema.Committees.alias, c.alias),
    });

    let committeeId: string;
    if (existing) {
      await tx
        .update(schema.Committees)
        .set({ name: c.name, description: c.description })
        .where(eq(schema.Committees.id, existing.id));
      committeeId = existing.id;
      committeesUpdated++;
      console.log(`  ↻ ${c.name} (${c.alias})`);
    } else {
      const [inserted] = await tx
        .insert(schema.Committees)
        .values({
          name: c.name,
          alias: c.alias,
          description: c.description,
        })
        .returning();
      committeeId = inserted.id;
      committeesCreated++;
      console.log(`  + ${c.name} (${c.alias})`);
    }

    const titles = [
      { name: "Chair", alias: "chair", level: c.chairLevel },
      { name: "Member", alias: "member", level: c.memberLevel },
    ];

    for (const t of titles) {
      const existingTitle = await tx.query.MemberTitles.findFirst({
        where: and(
          eq(schema.MemberTitles.alias, t.alias),
          eq(schema.MemberTitles.committeeId, committeeId),
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
          committeeId,
        });
        titlesCreated++;
      }
    }
  }

  console.log("");
  console.log(
    `✅ Committees: ${committeesCreated} created, ${committeesUpdated} updated`,
  );
  console.log(
    `✅ Titles: ${titlesCreated} created, ${titlesUpdated} updated (${COMMITTEES.length} committees × 2 titles each)`,
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
