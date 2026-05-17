import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { eq, and, isNull, or, gt, sql } from "drizzle-orm";

/**
 * Backfill script: ensures every User whose Constituent has the MEMBER profile
 * expectation (i.e. committee chairs, plain members from seed-test-users) has
 * an active row in the Members table.
 *
 * Safe to run multiple times — skips constituents that already have an active
 * membership period.
 */

const MEMBER_EMAILS = [
  "finance@ypfafrica.org",
  "hr@ypfafrica.org",
  "member@ypfafrica.org",
];

async function fix(
  tx: Parameters<Parameters<typeof dbClient.db.transaction>[0]>[0],
) {
  console.log("🔧 Fixing missing Members rows for test users...\n");
  const now = new Date();

  for (const email of MEMBER_EMAILS) {
    const user = await tx.query.Users.findFirst({
      where: eq(schema.Users.email, email),
    });

    if (!user) {
      console.log(`  ✗ ${email} — user not found, skipping`);
      continue;
    }

    const existingMember = await tx
      .select({ id: schema.Members.id })
      .from(schema.Members)
      .where(
        and(
          eq(schema.Members.constituentId, user.constituentId),
          or(
            isNull(schema.Members.endedAt),
            gt(schema.Members.endedAt, sql`now()`),
          ),
        ),
      )
      .limit(1);

    if (existingMember.length > 0) {
      console.log(`  ✓ ${email} — already has active Members row (${existingMember[0].id})`);
      continue;
    }

    const [created] = await tx
      .insert(schema.Members)
      .values({ constituentId: user.constituentId, startedAt: now })
      .returning();

    console.log(`  + ${email} — created Members row (${created.id})`);
  }

  console.log("\nDone. These users can now pay dues.");
}

dbClient
  .initialize()
  .then(() => dbClient.db.transaction(fix))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Fix failed:", err);
    process.exit(1);
  });
