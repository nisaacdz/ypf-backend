import { and, desc, eq, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import logger from "@/configs/logger";
import { ApiError } from "@/shared/types";
import { ensureCurrentMonthDues } from "./duesService";

export type DuesDebtor = {
  memberId: string;
  constituentId: string;
  publicId: string;
  fullName: string;
  email: string | null;
  amountDue: string;
  amountPaid: string;
  balance: string;
  currency: string;
  duesId: string;
  periodStart: Date;
  periodEnd: Date;
  reminderSent: boolean;
  reminderId: string | null;
};

/**
 * Generates dues reminders for all constituents who have NOT fully paid the
 * current month's dues. Designed to run once daily (or on-demand via an admin
 * endpoint) during the last 7 days of the month.
 *
 * Idempotent: skips a (constituent, duesId) pair if a reminder already exists.
 */
export async function generateRemindersForCurrentMonth(
  options?: { force?: boolean },
): Promise<number> {
  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const dayOfMonth = now.getDate();

  // Only generate reminders in the last 7 days of the month (unless forced by admin)
  if (!options?.force && dayOfMonth < daysInMonth - 7) {
    return 0;
  }

  // Find the current month's global dues row
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [currentDues] = await dbClient.db
    .select()
    .from(schema.Dues)
    .where(
      and(
        sql`${schema.Dues.chapterId} IS NULL`,
        eq(schema.Dues.periodStart, monthStart),
      ),
    )
    .limit(1);

  if (!currentDues) {
    return 0;
  }

  const duesAmount = parseFloat(currentDues.amount);

  // Get all active members (everyone who has a Members row)
  const allMembers = await dbClient.db
    .select({
      memberId: schema.Members.id,
      constituentId: schema.Members.constituentId,
    })
    .from(schema.Members)
    .where(
      sql`${schema.Members.endedAt} IS NULL OR ${schema.Members.endedAt} > now()`,
    );

  if (allMembers.length === 0) return 0;

  // Get everyone who has already fully paid
  const paidMembers = await dbClient.db
    .select({
      memberId: schema.DuesPayments.memberId,
      totalPaid: sql<string>`COALESCE(SUM(${schema.FinancialTransactions.amount}), 0)`,
    })
    .from(schema.DuesPayments)
    .innerJoin(
      schema.FinancialTransactions,
      eq(schema.DuesPayments.transactionId, schema.FinancialTransactions.id),
    )
    .where(
      and(
        eq(schema.DuesPayments.duesId, currentDues.id),
        eq(schema.FinancialTransactions.status, "COMPLETED"),
      ),
    )
    .groupBy(schema.DuesPayments.memberId);

  const fullyPaidMemberIds = new Set(
    paidMembers
      .filter((p) => parseFloat(p.totalPaid) >= duesAmount)
      .map((p) => p.memberId),
  );

  // Members who haven't fully paid
  const unpaidMembers = allMembers.filter(
    (m) => !fullyPaidMemberIds.has(m.memberId),
  );

  if (unpaidMembers.length === 0) return 0;

  // Check which reminders already exist for this dues period
  const existingReminders = await dbClient.db
    .select({ constituentId: schema.DuesReminders.constituentId })
    .from(schema.DuesReminders)
    .where(eq(schema.DuesReminders.duesId, currentDues.id));

  const alreadyRemindedIds = new Set(
    existingReminders.map((r) => r.constituentId),
  );

  // Insert new reminders for those who haven't been reminded
  const newReminders = unpaidMembers
    .filter((m) => !alreadyRemindedIds.has(m.constituentId))
    .map((m) => ({
      constituentId: m.constituentId,
      duesId: currentDues.id,
    }));

  if (newReminders.length === 0) return 0;

  await dbClient.db.insert(schema.DuesReminders).values(newReminders);

  logger.info(
    { count: newReminders.length, duesId: currentDues.id },
    "Generated dues reminders for unpaid members",
  );

  return newReminders.length;
}

export async function getDuesDebtors(input?: {
  duesId?: string;
}): Promise<DuesDebtor[]> {
  const currentDues = await resolveDuesPeriod(input?.duesId);
  if (!currentDues) return [];

  const duesAmount = Number(currentDues.amount);
  const [allMembers, paymentRows, reminderRows] = await Promise.all([
    dbClient.db
      .select({
        memberId: schema.Members.id,
        constituentId: schema.Members.constituentId,
        publicId: schema.Constituents.publicId,
        firstName: schema.Constituents.firstName,
        lastName: schema.Constituents.lastName,
        email: schema.Constituents.email,
      })
      .from(schema.Members)
      .innerJoin(
        schema.Constituents,
        eq(schema.Members.constituentId, schema.Constituents.id),
      )
      .where(
        sql`${schema.Members.endedAt} IS NULL OR ${schema.Members.endedAt} > now()`,
      )
      .orderBy(schema.Constituents.firstName, schema.Constituents.lastName),
    dbClient.db
      .select({
        memberId: schema.DuesPayments.memberId,
        totalPaid: sql<string>`COALESCE(SUM(${schema.FinancialTransactions.amount}), 0)::text`,
      })
      .from(schema.DuesPayments)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.DuesPayments.transactionId, schema.FinancialTransactions.id),
      )
      .where(
        and(
          eq(schema.DuesPayments.duesId, currentDues.id),
          eq(schema.FinancialTransactions.status, "COMPLETED"),
        ),
      )
      .groupBy(schema.DuesPayments.memberId),
    dbClient.db
      .select({
        id: schema.DuesReminders.id,
        constituentId: schema.DuesReminders.constituentId,
        dismissed: schema.DuesReminders.dismissed,
      })
      .from(schema.DuesReminders)
      .where(eq(schema.DuesReminders.duesId, currentDues.id))
      .orderBy(desc(schema.DuesReminders.createdAt)),
  ]);

  const paidByMember = new Map(
    paymentRows.map((row) => [row.memberId, Number(row.totalPaid)]),
  );
  const reminderByConstituent = new Map<
    string,
    { id: string; dismissed: boolean }
  >();
  for (const reminder of reminderRows) {
    if (!reminderByConstituent.has(reminder.constituentId)) {
      reminderByConstituent.set(reminder.constituentId, reminder);
    }
  }

  return allMembers
    .map((member) => {
      const amountPaid = paidByMember.get(member.memberId) ?? 0;
      const balance = Math.max(0, duesAmount - amountPaid);
      const reminder = reminderByConstituent.get(member.constituentId);
      return {
        memberId: member.memberId,
        constituentId: member.constituentId,
        publicId: member.publicId,
        fullName: `${member.firstName} ${member.lastName}`.trim(),
        email: member.email,
        amountDue: duesAmount.toFixed(2),
        amountPaid: amountPaid.toFixed(2),
        balance: balance.toFixed(2),
        currency: currentDues.currency,
        duesId: currentDues.id,
        periodStart: currentDues.periodStart,
        periodEnd: currentDues.periodEnd,
        reminderSent: Boolean(reminder && !reminder.dismissed),
        reminderId: reminder?.id ?? null,
      };
    })
    .filter((row) => Number(row.balance) > 0);
}

export async function triggerReminderForMember(input: {
  memberId: string;
  duesId?: string;
}) {
  const debtors = await getDuesDebtors({ duesId: input.duesId });
  const debtor = debtors.find((row) => row.memberId === input.memberId);
  if (!debtor) {
    throw new ApiError("This member does not owe dues for the selected period", 400);
  }

  const existing = await dbClient.db.query.DuesReminders.findFirst({
    where: and(
      eq(schema.DuesReminders.constituentId, debtor.constituentId),
      eq(schema.DuesReminders.duesId, debtor.duesId),
    ),
    orderBy: desc(schema.DuesReminders.createdAt),
  });

  if (existing) {
    const [updated] = await dbClient.db
      .update(schema.DuesReminders)
      .set({ dismissed: false, createdAt: new Date() })
      .where(eq(schema.DuesReminders.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await dbClient.db
    .insert(schema.DuesReminders)
    .values({
      constituentId: debtor.constituentId,
      duesId: debtor.duesId,
    })
    .returning();

  logger.info(
    { memberId: debtor.memberId, constituentId: debtor.constituentId, duesId: debtor.duesId },
    "Triggered dues reminder for member",
  );

  return created;
}

/**
 * Returns active (non-dismissed) reminders for a specific constituent.
 */
export async function getRemindersForConstituent(constituentId: string) {
  const reminders = await dbClient.db
    .select({
      id: schema.DuesReminders.id,
      duesId: schema.DuesReminders.duesId,
      createdAt: schema.DuesReminders.createdAt,
      amount: schema.Dues.amount,
      currency: schema.Dues.currency,
      periodStart: schema.Dues.periodStart,
      periodEnd: schema.Dues.periodEnd,
    })
    .from(schema.DuesReminders)
    .innerJoin(schema.Dues, eq(schema.DuesReminders.duesId, schema.Dues.id))
    .where(
      and(
        eq(schema.DuesReminders.constituentId, constituentId),
        eq(schema.DuesReminders.dismissed, false),
      ),
    );

  return reminders;
}

/**
 * Dismiss a reminder (user clicked "dismiss" or completed payment).
 */
export async function dismissReminder(reminderId: string) {
  await dbClient.db
    .update(schema.DuesReminders)
    .set({ dismissed: true })
    .where(eq(schema.DuesReminders.id, reminderId));
}

/**
 * Auto-dismiss all reminders for a constituent + dues period (called after
 * payment completes via webhook).
 */
export async function dismissRemindersForPayment(
  constituentId: string,
  duesId: string,
) {
  await dbClient.db
    .update(schema.DuesReminders)
    .set({ dismissed: true })
    .where(
      and(
        eq(schema.DuesReminders.constituentId, constituentId),
        eq(schema.DuesReminders.duesId, duesId),
        eq(schema.DuesReminders.dismissed, false),
      ),
    );
}

async function resolveDuesPeriod(duesId?: string) {
  if (duesId) {
    const [dues] = await dbClient.db
      .select()
      .from(schema.Dues)
      .where(eq(schema.Dues.id, duesId))
      .limit(1);
    if (!dues) throw new ApiError("Dues period not found", 404);
    return dues;
  }

  await ensureCurrentMonthDues();
  const now = new Date();
  const monthStartDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
    .toISOString()
    .slice(0, 10);
  const nextMonthStartDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  )
    .toISOString()
    .slice(0, 10);

  const [currentDues] = await dbClient.db
    .select()
    .from(schema.Dues)
    .where(
      and(
        sql`${schema.Dues.chapterId} IS NULL`,
        sql`${schema.Dues.periodStart} >= ${monthStartDate}`,
        sql`${schema.Dues.periodStart} < ${nextMonthStartDate}`,
      ),
    )
    .limit(1);

  return currentDues ?? null;
}
