import { eq, and, desc, sql } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import variables from "@/configs/env";
import { ApiError, AuthenticatedUser } from "@/shared/types";
import logger from "@/configs/logger";
import { v4 as uuidv4 } from "uuid";

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
        sql`${schema.Members.endedAt} IS NULL OR ${schema.Members.endedAt} > now()`,
      ),
    )
    .orderBy(desc(schema.Members.startedAt))
    .limit(1);

  return member ?? null;
}

/**
 * Initiate a dues payment via Paystack
 */
export async function initiateDuesPayment(
  input: { duesId: string; amount: number; currency: string },
  user: AuthenticatedUser,
) {
  const { duesId, amount, currency } = input;

  const member = await getActiveMember(user.constituentId);
  if (!member) {
    throw new ApiError("You must be an active member to pay dues", 403);
  }

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
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${variables.services.paystack.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency,
          reference: paymentReference,
          callback_url: `${variables.app.host}/dues/callback`,
          email: user.email,
          metadata: {
            type: "dues_payment",
            duesId,
            memberId: member.id,
            period: `${dues.periodStart} - ${dues.periodEnd}`,
          },
        }),
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
    logger.warn(
      `Compensating transaction for dues payment [${duesPaymentId}] due to API failure.`,
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
    throw apiError;
  }

  return {
    paymentId: duesPaymentId,
    paymentUrl,
  };
}
