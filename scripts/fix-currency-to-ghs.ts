/**
 * Fixes the currency on all dues-related rows from USD to GHS.
 * Paystack test keys only support GHS (and NGN). USD causes
 * "Currency not supported by merchant" errors.
 *
 * Run: npx tsx scripts/fix-currency-to-ghs.ts
 */
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  await dbClient.initialize();

  // 1. Update DuesPolicies
  const policies = await dbClient.db
    .update(schema.DuesPolicies)
    .set({ currency: "GHS" })
    .where(sql`${schema.DuesPolicies.currency} = 'USD'`)
    .returning({ id: schema.DuesPolicies.id });
  console.log(`Updated ${policies.length} dues policies to GHS`);

  // 2. Update Dues rows
  const dues = await dbClient.db
    .update(schema.Dues)
    .set({ currency: "GHS" })
    .where(sql`${schema.Dues.currency} = 'USD'`)
    .returning({ id: schema.Dues.id });
  console.log(`Updated ${dues.length} dues rows to GHS`);

  // 3. Update FinancialTransactions
  const txns = await dbClient.db
    .update(schema.FinancialTransactions)
    .set({ currency: "GHS" })
    .where(sql`${schema.FinancialTransactions.currency} = 'USD'`)
    .returning({ id: schema.FinancialTransactions.id });
  console.log(`Updated ${txns.length} financial transactions to GHS`);

  console.log("Done — all currencies updated to GHS.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
