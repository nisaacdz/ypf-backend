/**
 * Seed the initial monthly dues policy.
 *
 * `finance.dues_policies` is read by `duesService` as "the latest row where
 * endedAt IS NULL" — that's the active policy. Without one, no dues bills
 * generate and the UMS Finance tab is empty.
 *
 * Idempotent: if there's already an active policy, the script reports it
 * and exits without changing anything. To change the amount later, do it
 * via the UMS Finance UI (which closes the old policy and opens a new one
 * in one transaction, preserving historical pricing).
 *
 * Run from your laptop against PRODUCTION:
 *
 *   DATABASE_URL='postgresql://…?sslmode=require' \
 *   DUES_AMOUNT='20' \
 *   DUES_CURRENCY='GHS' \
 *     npx tsx scripts/seed-dues-policy.ts
 *
 * Defaults: 20 GHS / month if env vars aren't supplied.
 */

import { isNull } from "drizzle-orm";

import dbClient from "@/configs/db";
import schema from "@/db/schema";

const amount = process.env.DUES_AMOUNT ?? "20";
const currency = (process.env.DUES_CURRENCY ?? "GHS").toUpperCase();

if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
  console.error(
    `❌ DUES_AMOUNT must be a positive decimal (e.g. 20 or 20.00). Got: ${amount}`,
  );
  process.exit(1);
}
if (!/^[A-Z]{3}$/.test(currency)) {
  console.error(
    `❌ DUES_CURRENCY must be a 3-letter ISO code (GHS, USD, NGN…). Got: ${currency}`,
  );
  process.exit(1);
}

async function run() {
  console.log(
    `💵 Seeding initial dues policy: ${amount} ${currency} / month…`,
  );

  await dbClient.db.transaction(async (tx) => {
    const existing = await tx.query.DuesPolicies.findFirst({
      where: isNull(schema.DuesPolicies.endedAt),
    });

    if (existing) {
      console.log(
        `  ↳ Active policy already exists: ${existing.amount} ${existing.currency} (effective from ${existing.effectiveFrom.toISOString()}).`,
      );
      console.log(
        "  ↳ Nothing changed. To update the amount, use the UMS Finance UI.",
      );
      return;
    }

    const [created] = await tx
      .insert(schema.DuesPolicies)
      .values({
        amount,
        currency,
      })
      .returning();

    console.log(
      `  ↳ Created policy ${created.id}: ${created.amount} ${created.currency}, effective ${created.effectiveFrom.toISOString()}.`,
    );
  });

  console.log("\n✅ Done.");
}

dbClient
  .initialize()
  .then(run)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
