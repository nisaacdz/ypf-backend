import { eq, and, or, gt, isNull, desc, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import variables from "@/configs/env";
import { ApiError, AuthenticatedUser } from "@/shared/types";
import logger from "@/configs/logger";
import { v4 as uuidv4 } from "uuid";
import { paystackSplitFields } from "./paymentProviders";

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

/**
 * Get all available dues (global, chapterId = null)
 */
export async function getAvailableDues(query: {
  page: number;
  pageSize: number;
}) {
  const { page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  // Idempotent: make sure the current month has a Dues row before reading.
  // Cheap (one indexed SELECT) when the row already exists. We swallow errors
  // so an unset policy never blocks the existing catalogue read.
  try {
    await ensureCurrentMonthDues();
  } catch (err) {
    logger.warn(err, "ensureCurrentMonthDues failed during GET /dues");
  }

  // Fire-and-forget: generate reminders for unpaid users in the last 7 days
  // of the month. Idempotent and non-blocking.
  import("./duesReminderService")
    .then((svc) => svc.generateRemindersForCurrentMonth())
    .catch(() => {});

  const [dues, countResult] = await Promise.all([
    dbClient.db
      .select()
      .from(schema.Dues)
      .where(sql`${schema.Dues.chapterId} IS NULL`)
      .orderBy(desc(schema.Dues.periodEnd))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.Dues)
      .where(sql`${schema.Dues.chapterId} IS NULL`),
  ]);

  return {
    items: dues.map((d) => ({
      id: d.id,
      amount: d.amount,
      currency: d.currency,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
    })),
    page,
    pageSize,
    total: countResult[0]?.count ?? 0,
  };
}

/**
 * Get dues payment status for a specific member
 */
export async function getMemberDuesStatus(memberId: string, duesId: string) {
  const [dues] = await dbClient.db
    .select()
    .from(schema.Dues)
    .where(eq(schema.Dues.id, duesId))
    .limit(1);

  if (!dues) {
    throw new ApiError("Dues not found", 404);
  }

  const payments = await dbClient.db
    .select({
      id: schema.DuesPayments.id,
      transactionId: schema.DuesPayments.transactionId,
      amount: schema.FinancialTransactions.amount,
      currency: schema.FinancialTransactions.currency,
      status: schema.FinancialTransactions.status,
      createdAt: schema.FinancialTransactions.createdAt,
    })
    .from(schema.DuesPayments)
    .innerJoin(
      schema.FinancialTransactions,
      eq(schema.DuesPayments.transactionId, schema.FinancialTransactions.id),
    )
    .where(
      and(
        eq(schema.DuesPayments.memberId, memberId),
        eq(schema.DuesPayments.duesId, duesId),
      ),
    )
    .orderBy(desc(schema.FinancialTransactions.createdAt));

  const completedPayments = payments.filter((p) => p.status === "COMPLETED");
  const totalPaid = completedPayments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0,
  );

  const duesAmount = parseFloat(dues.amount);
  const remainingBalance = Math.max(0, duesAmount - totalPaid);
  const isFullyPaid = remainingBalance === 0;

  return {
    dues: {
      id: dues.id,
      amount: dues.amount,
      currency: dues.currency,
      periodStart: dues.periodStart,
      periodEnd: dues.periodEnd,
    },
    totalPaid: totalPaid.toFixed(2),
    remainingBalance: remainingBalance.toFixed(2),
    isFullyPaid,
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
    })),
  };
}

/**
 * Get all dues payment history for a member
 */
export async function getMemberDuesPayments(
  memberId: string,
  query: { page: number; pageSize: number },
) {
  const { page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  const [payments, countResult] = await Promise.all([
    dbClient.db
      .select({
        id: schema.DuesPayments.id,
        duesId: schema.DuesPayments.duesId,
        amount: schema.FinancialTransactions.amount,
        currency: schema.FinancialTransactions.currency,
        status: schema.FinancialTransactions.status,
        createdAt: schema.FinancialTransactions.createdAt,
        periodStart: schema.Dues.periodStart,
        periodEnd: schema.Dues.periodEnd,
      })
      .from(schema.DuesPayments)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.DuesPayments.transactionId, schema.FinancialTransactions.id),
      )
      .innerJoin(schema.Dues, eq(schema.DuesPayments.duesId, schema.Dues.id))
      .where(eq(schema.DuesPayments.memberId, memberId))
      .orderBy(desc(schema.FinancialTransactions.createdAt))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.DuesPayments)
      .where(eq(schema.DuesPayments.memberId, memberId)),
  ]);

  return {
    items: payments.map((p) => ({
      id: p.id,
      duesId: p.duesId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      createdAt: p.createdAt,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
    })),
    page,
    pageSize,
    total: countResult[0]?.count ?? 0,
  };
}

/**
 * Get active member record for a constituent
 */
export async function getActiveMember(constituentId: string) {
  const [member] = await dbClient.db
    .select()
    .from(schema.Members)
    .where(
      and(
        eq(schema.Members.constituentId, constituentId),
        or(
          isNull(schema.Members.endedAt),
          gt(schema.Members.endedAt, sql`now()`),
        ),
      ),
    )
    .orderBy(desc(schema.Members.startedAt))
    .limit(1);

  return member ?? null;
}

/**
 * Returns an active member record, creating one if none exists.
 * Dues payment is open to everyone — paying dues enrolls you as a member.
 */
export async function getOrCreateActiveMember(constituentId: string) {
  const existing = await getActiveMember(constituentId);
  if (existing) return existing;

  const [created] = await dbClient.db
    .insert(schema.Members)
    .values({ constituentId, startedAt: new Date() })
    .returning();

  logger.info(
    { constituentId, memberId: created.id },
    "Auto-created Members row for dues payment",
  );
  return created;
}

/**
 * Initiate a dues payment via Paystack
 */
export async function initiateDuesPayment(
  input: { duesId: string; amount: number; currency: string },
  user: AuthenticatedUser,
) {
  const { duesId, amount, currency } = input;

  const member = await getOrCreateActiveMember(user.constituentId);

  const [dues] = await dbClient.db
    .select()
    .from(schema.Dues)
    .where(eq(schema.Dues.id, duesId))
    .limit(1);

  if (!dues) {
    throw new ApiError("Dues not found", 404);
  }

  // Get total already paid (completed transactions only)
  const paidResult = await dbClient.db
    .select({
      totalPaid: sql<string>`COALESCE(SUM(${schema.FinancialTransactions.amount}), 0)`,
    })
    .from(schema.DuesPayments)
    .innerJoin(
      schema.FinancialTransactions,
      eq(schema.DuesPayments.transactionId, schema.FinancialTransactions.id),
    )
    .where(
      and(
        eq(schema.DuesPayments.memberId, member.id),
        eq(schema.DuesPayments.duesId, duesId),
        eq(schema.FinancialTransactions.status, "COMPLETED"),
      ),
    );

  const totalPaid = parseFloat(paidResult[0]?.totalPaid ?? "0");
  const duesAmount = parseFloat(dues.amount);
  const remainingBalance = duesAmount - totalPaid;

  if (remainingBalance <= 0) {
    throw new ApiError("This dues has already been fully paid", 400);
  }

  if (amount > remainingBalance) {
    throw new ApiError(
      `Payment amount exceeds remaining balance of ${remainingBalance.toFixed(2)} ${dues.currency}`,
      400,
    );
  }

  const paymentReference = uuidv4();
  let duesPaymentId: string;
  let transactionId: string;

  try {
    const result = await dbClient.db.transaction(async (tx) => {
      const [newTransaction] = await tx
        .insert(schema.FinancialTransactions)
        .values({
          amount: amount.toFixed(2),
          currency,
          status: "PENDING",
          externalProvider: "PAYSTACK",
          externalRef: paymentReference,
        })
        .returning();

      const [newDuesPayment] = await tx
        .insert(schema.DuesPayments)
        .values({
          transactionId: newTransaction.id,
          duesId,
          memberId: member.id,
        })
        .returning();

      return {
        duesPaymentId: newDuesPayment.id,
        transactionId: newTransaction.id,
      };
    });

    duesPaymentId = result.duesPaymentId;
    transactionId = result.transactionId;
  } catch (dbError) {
    logger.error(dbError, "Failed to create dues payment records");
    throw new ApiError("Failed to initiate dues payment", 500);
  }

  let paymentUrl: string;
  try {
    const paystackBody = {
      amount: Math.round(amount * 100),
      currency,
      reference: paymentReference,
      ...paystackSplitFields(),
      callback_url:
        (variables.app.dashboardUrl?.replace(/\/$/, "") ??
          `http://${variables.app.host}:${variables.app.port}`) +
        "/dashboard/me/dues/callback",
      email: user.email,
      metadata: {
        type: "dues_payment",
        duesId,
        memberId: member.id,
        period: `${dues.periodStart} - ${dues.periodEnd}`,
      },
    };

    logger.info(
      { paystackBody: { ...paystackBody, email: user.email } },
      "Calling Paystack /transaction/initialize",
    );

    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${variables.services.paystack.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paystackBody),
      },
    );

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      logger.error("Paystack initialization failed:", errorData);
      throw new ApiError(
        `Failed to initialize payment: ${errorData.message || "Unknown error"}`,
        500,
      );
    }

    const paystackData =
      (await paystackResponse.json()) as PaystackInitializeResponse;
    paymentUrl = paystackData.data.authorization_url;
  } catch (apiError) {
    logger.error(
      { err: apiError, duesPaymentId, transactionId, currency },
      `Paystack API call failed for dues payment`,
    );
    try {
      await dbClient.db
        .update(schema.FinancialTransactions)
        .set({ status: "FAILED" })
        .where(eq(schema.FinancialTransactions.id, transactionId));
    } catch (compensationError) {
      logger.error(
        compensationError,
        `CRITICAL: Failed to compensate (mark as FAILED) transaction [${transactionId}].`,
      );
    }
    if (apiError instanceof ApiError) throw apiError;
    throw new ApiError(
      "Payment provider unavailable — please check your internet connection and try again",
      502,
    );
  }

  return {
    paymentId: duesPaymentId,
    paymentUrl,
  };
}

// ---------------------------------------------------------------------------
// Dues policy (super-admin-configured monthly amount) + month auto-ensure
// ---------------------------------------------------------------------------

export type DuesPolicy = {
  id: string;
  amount: string;
  currency: string;
  effectiveFrom: Date;
  endedAt: Date | null;
  createdBy: string | null;
};

/**
 * Returns the currently active dues policy (singleton — only one row has
 * `endedAt IS NULL`). Null if no policy has ever been set.
 */
export async function getActiveDuesPolicy(): Promise<DuesPolicy | null> {
  const [policy] = await dbClient.db
    .select()
    .from(schema.DuesPolicies)
    .where(sql`${schema.DuesPolicies.endedAt} IS NULL`)
    .orderBy(desc(schema.DuesPolicies.effectiveFrom))
    .limit(1);
  return policy ?? null;
}

/**
 * Replaces the active dues policy in a transaction: ends the previous active
 * row (sets `endedAt = now`) and inserts a new one. Subsequent dues rows
 * created via `ensureCurrentMonthDues()` will use the new amount/currency.
 */
export async function setDuesPolicy(input: {
  amount: number;
  currency: string;
  createdBy?: string;
}): Promise<DuesPolicy> {
  const { amount, currency, createdBy } = input;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError("Amount must be a positive number", 400);
  }
  const normalisedCurrency = currency.toUpperCase();
  if (normalisedCurrency.length !== 3) {
    throw new ApiError("Currency must be a 3-letter ISO code", 400);
  }

  return await dbClient.db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(schema.DuesPolicies)
      .set({ endedAt: now })
      .where(sql`${schema.DuesPolicies.endedAt} IS NULL`);

    const [created] = await tx
      .insert(schema.DuesPolicies)
      .values({
        amount: amount.toFixed(2),
        currency: normalisedCurrency,
        createdBy: createdBy ?? null,
      })
      .returning();
    return created;
  });
}

/**
 * Returns first/last day of the calendar month containing `date`. The dues
 * period for each month is identified by these timestamps.
 */
function currentMonthBounds(date = new Date()): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0, // day 0 of next month = last day of this month
  );
  return { start, end };
}

/**
 * Idempotent: makes sure a global `Dues` row exists for the current calendar
 * month using the active policy's amount + currency. No-op if no active
 * policy is set. Called from `GET /dues` so the catalogue stays in sync
 * without needing an external scheduler.
 */
export async function ensureCurrentMonthDues(): Promise<{ id: string } | null> {
  const policy = await getActiveDuesPolicy();
  if (!policy) return null;

  const { start, end } = currentMonthBounds();

  // Use the start-of-month timestamp as the natural unique key for "this
  // month's dues" (chapterId IS NULL = global). If a row already exists, we
  // do nothing — the periodStart match also protects against duplicates if
  // this function fires concurrently.
  const [existing] = await dbClient.db
    .select({ id: schema.Dues.id })
    .from(schema.Dues)
    .where(
      and(
        sql`${schema.Dues.chapterId} IS NULL`,
        eq(schema.Dues.periodStart, start),
      ),
    )
    .limit(1);

  if (existing) return existing;

  try {
    const [created] = await dbClient.db
      .insert(schema.Dues)
      .values({
        amount: policy.amount,
        currency: policy.currency,
        periodStart: start,
        periodEnd: end,
      })
      .returning({ id: schema.Dues.id });
    return created;
  } catch (err) {
    // If a concurrent call beat us to it, just fetch and return.
    logger.warn(err, "ensureCurrentMonthDues insert failed — refetching");
    const [retry] = await dbClient.db
      .select({ id: schema.Dues.id })
      .from(schema.Dues)
      .where(
        and(
          sql`${schema.Dues.chapterId} IS NULL`,
          eq(schema.Dues.periodStart, start),
        ),
      )
      .limit(1);
    if (!retry) throw err;
    return retry;
  }
}

// ---------------------------------------------------------------------------
// Admin-recorded offline dues payment
// ---------------------------------------------------------------------------

export type OfflinePaymentMethod = "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY";

/**
 * Admin path to record a dues payment that happened outside Paystack — cash
 * handed in at a meeting, a bank transfer the treasurer manually verified,
 * etc. Creates a COMPLETED `FinancialTransactions` row with
 * `externalProvider = MANUAL` and links it via `DuesPayments`. No Paystack
 * call is made.
 */
export async function recordOfflineDuesPayment(input: {
  memberId: string;
  duesId: string;
  amount: number;
  currency: string;
  paymentMethod: OfflinePaymentMethod;
  note?: string;
  recordedBy: string;
}): Promise<{ paymentId: string; transactionId: string }> {
  const { memberId, duesId, amount, currency, paymentMethod, note, recordedBy } = input;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError("Amount must be a positive number", 400);
  }

  // Verify the member + dues both exist before writing anything.
  const [member] = await dbClient.db
    .select({ id: schema.Members.id })
    .from(schema.Members)
    .where(eq(schema.Members.id, memberId))
    .limit(1);
  if (!member) {
    throw new ApiError("Member not found", 404);
  }

  const [dues] = await dbClient.db
    .select({
      id: schema.Dues.id,
      currency: schema.Dues.currency,
      amount: schema.Dues.amount,
    })
    .from(schema.Dues)
    .where(eq(schema.Dues.id, duesId))
    .limit(1);
  if (!dues) {
    throw new ApiError("Dues period not found", 404);
  }

  const normalisedCurrency = currency.toUpperCase();
  if (normalisedCurrency !== dues.currency) {
    throw new ApiError(
      `Payment currency (${normalisedCurrency}) must match the dues currency (${dues.currency}).`,
      400,
    );
  }

  // Sum existing completed payments and reject if this push would overpay.
  const paidResult = await dbClient.db
    .select({
      totalPaid: sql<string>`COALESCE(SUM(${schema.FinancialTransactions.amount}), 0)`,
    })
    .from(schema.DuesPayments)
    .innerJoin(
      schema.FinancialTransactions,
      eq(schema.DuesPayments.transactionId, schema.FinancialTransactions.id),
    )
    .where(
      and(
        eq(schema.DuesPayments.memberId, memberId),
        eq(schema.DuesPayments.duesId, duesId),
        eq(schema.FinancialTransactions.status, "COMPLETED"),
      ),
    );

  const totalPaid = parseFloat(paidResult[0]?.totalPaid ?? "0");
  const remaining = parseFloat(dues.amount) - totalPaid;
  if (remaining <= 0) {
    throw new ApiError("This dues has already been fully paid", 400);
  }
  if (amount > remaining + 0.001) {
    throw new ApiError(
      `Payment exceeds remaining balance of ${remaining.toFixed(2)} ${dues.currency}`,
      400,
    );
  }

  const externalRef = `manual_${uuidv4()}`;
  const notePrefix = note ? ` — ${note}` : "";

  return await dbClient.db.transaction(async (tx) => {
    const [transaction] = await tx
      .insert(schema.FinancialTransactions)
      .values({
        amount: amount.toFixed(2),
        currency: normalisedCurrency,
        status: "COMPLETED",
        paymentMethod,
        externalProvider: "MANUAL",
        externalRef: `${externalRef}${notePrefix}`.slice(0, 1024),
      })
      .returning({ id: schema.FinancialTransactions.id });

    const [payment] = await tx
      .insert(schema.DuesPayments)
      .values({
        transactionId: transaction.id,
        duesId,
        memberId,
      })
      .returning({ id: schema.DuesPayments.id });

    logger.info(
      { paymentId: payment.id, recordedBy, memberId, duesId, amount, paymentMethod },
      "Offline dues payment recorded",
    );

    return { paymentId: payment.id, transactionId: transaction.id };
  });
}
