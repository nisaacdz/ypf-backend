import { eq, and } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import variables from "@/configs/env";
import { ApiError, AuthenticatedUser } from "@/shared/types";
import logger from "@/configs/logger";
import { sendDonationAcknowledgementEmail } from "@/shared/utils/email";
import { v4 as uuidv4 } from "uuid";
import { paymentMethodMap, transactionStatusMap } from "../utils";
import { sql, desc, gte, lte } from "drizzle-orm";
import { Paginated } from "@/shared/dtos";
import { YPFDonation } from "@/features/api/v1/donations/dtos";
import { z } from "zod";
import { GetDonationsQuerySchema } from "@/features/api/v1/donations/schemas";

export async function getDonations(
  query: z.infer<typeof GetDonationsQuerySchema>
): Promise<Paginated<YPFDonation>> {
  const { page = 1, pageSize = 20, startDate, endDate, status } = query;
  const offset = (page - 1) * pageSize;

  const whereClauses = [];

  if (status) {
    whereClauses.push(eq(schema.FinancialTransactions.status, status));
  }
  if (startDate) {
    whereClauses.push(
      gte(schema.FinancialTransactions.updatedAt, new Date(startDate))
    );
  }
  if (endDate) {
    whereClauses.push(
      lte(schema.FinancialTransactions.updatedAt, new Date(endDate))
    );
  }

  const queryBuilder = dbClient.db
    .select({
      id: schema.Donations.id,
      amount: schema.FinancialTransactions.amount,
      currency: schema.FinancialTransactions.currency,
      status: schema.FinancialTransactions.status,
      date: schema.FinancialTransactions.updatedAt,
      guestName: schema.Donations.guestName,
      guestEmail: schema.Donations.guestEmail,
      constituentFirstName: schema.Constituents.firstName,
      constituentLastName: schema.Constituents.lastName,
      constituentEmail: schema.Constituents.email,
    })
    .from(schema.Donations)
    .innerJoin(
      schema.FinancialTransactions,
      eq(schema.Donations.transactionId, schema.FinancialTransactions.id)
    )
    .leftJoin(
      schema.Constituents,
      eq(schema.Donations.constituentId, schema.Constituents.id)
    )
    .where(and(...whereClauses))
    .orderBy(desc(schema.FinancialTransactions.updatedAt))
    .limit(pageSize)
    .offset(offset);

  const [donations, [{ total }]] = await Promise.all([
    queryBuilder,
    dbClient.db
      .select({ total: sql<number>`count(*)` })
      .from(schema.Donations)
      .innerJoin(
        schema.FinancialTransactions,
        eq(schema.Donations.transactionId, schema.FinancialTransactions.id)
      )
      .leftJoin(
        schema.Constituents,
        eq(schema.Donations.constituentId, schema.Constituents.id)
      )
      .where(and(...whereClauses)),
  ]);

  const items: YPFDonation[] = donations.map((d) => {
    let donorName: string | undefined;
    let donorEmail: string | undefined;

    if (d.constituentEmail) {
      donorName = `${d.constituentFirstName} ${d.constituentLastName}`;
      donorEmail = d.constituentEmail;
    } else if (d.guestEmail) {
      donorName = d.guestName || "Guest";
      donorEmail = d.guestEmail;
    }

    return {
      id: d.id,
      amount: d.amount,
      currency: d.currency,
      status: d.status,
      date: d.date,
      donor:
        donorName || donorEmail
          ? {
              name: donorName,
              email: donorEmail,
            }
          : undefined,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
  };
}

type CreateDonationInput = {
  amount: number;
  currency: string;
  anonymous?: boolean;
  donorInfo?: {
    name: string;
    email?: string;
    phone?: string;
  };
  projectId?: string;
  eventId?: string;
};

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    channel: string;
    paid_at: string;
  };
};

type Donation = {
  transaction: {
    id: string;
    amount: string;
    currency: string;
    createdAt: Date;
    paymentMethod:
      | "CREDIT_CARD"
      | "BANK_TRANSFER"
      | "MOBILE_MONEY"
      | "CASH"
      | null;
    status: "COMPLETED" | "PENDING" | "FAILED" | "REFUNDED";
    externalProvider: "PAYSTACK";
    externalRef: string | null;
  };
  id: string;
  transactionId: string;
  constituentId: string | null;
  projectId: string | null;
  eventId: string | null;
  guestName: string | null;
  guestEmail: string | null;
};

/**
 * Creates a new donation and generates a Paystack payment URL.
 * This uses a "save-then-call" pattern for scalability.
 */
export async function startPaystackDonation(
  {
    amount,
    currency,
    anonymous = false,
    donorInfo,
    projectId,
    eventId,
  }: CreateDonationInput,
  user: AuthenticatedUser | null
): Promise<{
  donation: YPFDonation;
  paymentUrl: string;
}> {
  const constituentId = !anonymous ? (user?.constituentId ?? null) : null;
  const guestName = !anonymous ? (donorInfo?.name ?? null) : null;
  const guestEmail = !anonymous ? (donorInfo?.email ?? null) : null;

  const paymentReference = uuidv4();

  let transactionId: string;
  let newDonation;
  let newTransaction;

  try {
    const { donation, transaction } = await dbClient.db.transaction(
      async (tx) => {
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

        const [newDonation] = await tx
          .insert(schema.Donations)
          .values({
            transactionId: newTransaction.id,
            constituentId,
            guestName,
            guestEmail,
            projectId: projectId || null,
            eventId: eventId || null,
          })
          .returning();

        return { donation: newDonation, transaction: newTransaction };
      }
    );

    newDonation = donation;
    newTransaction = transaction;
    transactionId = newTransaction.id;
  } catch (dbError) {
    logger.error(dbError, "Failed to create initial donation records:");
    throw new ApiError("Failed to save donation intent.", 500);
  }

  let paystackData: PaystackInitializeResponse;
  try {
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${variables.services.paystack.secretHash}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency,
          reference: paymentReference,
          callback_url: `${variables.app.host}/donations/callback`,
          email: guestEmail ?? user?.email,
        }),
      }
    );

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      logger.error("Paystack initialization failed:", errorData);
      throw new ApiError(
        `Failed to initialize payment: ${errorData.message || "Unknown error"}`,
        500
      );
    }
    paystackData =
      (await paystackResponse.json()) as PaystackInitializeResponse;
  } catch (apiError) {
    logger.warn(
      `Compensating transaction for [${transactionId}] due to API failure.`
    );
    try {
      await dbClient.db
        .update(schema.FinancialTransactions)
        .set({ status: "FAILED" })
        .where(eq(schema.FinancialTransactions.id, transactionId));
    } catch (compensationError) {
      logger.error(
        compensationError,
        `CRITICAL: Failed to compensate (mark as FAILED) transaction [${transactionId}].`
      );
    }
    throw apiError;
  }

  const donor = anonymous
    ? undefined
    : {
        name: guestName ?? user?.fullName,
        email: guestEmail ?? user?.email,
      };

  return {
    donation: {
      id: newDonation.id,
      amount: newTransaction.amount,
      currency: newTransaction.currency,
      status: newTransaction.status,
      date: newTransaction.createdAt,
      donor,
    },
    paymentUrl: paystackData.data.authorization_url,
  };
}

/**
 * Verifies a donation using Paystack's verification API
 */
export async function verifyPaystackDonation(
  donation: Donation,
  user: AuthenticatedUser | null
): Promise<{
  status: string;
}> {
  try {
    // Fetch donation with transaction

    if (!donation.transaction) {
      throw new ApiError("Transaction not found for this donation", 404);
    }

    if (!donation.transaction.externalRef) {
      throw new ApiError(
        "No external reference found for this transaction",
        400
      );
    }

    // Call Paystack verification API
    const paystackSecretKey = variables.services.paystack.secretHash;

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${donation.transaction.externalRef}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      }
    );

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      logger.error("Paystack verification failed:", errorData);
      throw new ApiError("Failed to verify payment", 500);
    }

    const verifyData: PaystackVerifyResponse = await verifyResponse.json();

    if (!verifyData.status) {
      throw new ApiError(verifyData.message || "Failed to verify payment", 500);
    }

    const newStatus = transactionStatusMap[verifyData.data.status] || "PENDING";

    const paymentMethod =
      paymentMethodMap[verifyData.data.channel] || "CREDIT_CARD";

    // Update transaction status only if still pending
    const updateResult = await dbClient.db
      .update(schema.FinancialTransactions)
      .set({
        status: newStatus,
        paymentMethod,
      })
      .where(
        and(
          eq(schema.FinancialTransactions.id, donation.transaction.id),
          eq(schema.FinancialTransactions.status, "PENDING")
        )
      )
      .returning({ id: schema.FinancialTransactions.id });

    // Check if update was successful
    if (updateResult.length === 0) {
      logger.warn(
        `Transaction ${donation.transaction.id} was not updated - may have been processed already`
      );
      // Return current status from database instead of from Paystack
      return {
        status: donation.transaction.status,
      };
    }

    logger.info(`Verified donation ${donation.id} with status: ${newStatus}`);

    // Send acknowledgement email for successful non-anonymous donations

    if (
      newStatus === "COMPLETED" &&
      (donation.constituentId === user?.constituentId ||
        (donation.guestEmail && donation.guestName))
    ) {
      const email = String(donation.guestEmail || user?.email);
      const name = String(donation.guestName || user?.fullName);
      await sendDonationAcknowledgementEmail({
        email,
        name,
        donation: {
          id: donation.id,
          amount: donation.transaction.amount,
          currency: donation.transaction.currency,
        },
      });
    }

    return {
      status: newStatus,
    };
  } catch (error) {
    logger.error({ error }, "Error verifying donation");
    throw error;
  }
}
