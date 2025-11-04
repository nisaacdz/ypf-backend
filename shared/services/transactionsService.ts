import { and, eq, not } from "drizzle-orm";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";
import logger from "@/configs/logger";
import { transactionStatusMap, paymentMethodMap } from "../utils";
import variables from "@/configs/env";
import { sendDonationAcknowledgementEmail } from "@/shared/utils/email";

export type PaystackWebhookPayload = {
  event: "charge.success" | "charge.failed";
  data: {
    status: string;
    reference: string;
    channel: string;
    amount: string;
    currency: string;
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

export async function handlePaystackWebhook(
  payload: PaystackWebhookPayload,
): Promise<{
  transactionId?: string;
  wasUpdated: boolean;
}> {
  const { data } = payload;

  const { reference, status, channel, amount, currency } = data;

  const newStatus = transactionStatusMap[status];
  const newPaymentMethod = paymentMethodMap[channel]; // remember to change paymentMethod to thru on entity and allow values OFFLINE, ONLINE, the rest can be fetched from paystack or the provider

  const result = await pgPool.db
    .update(schema.FinancialTransactions)
    .set({
      status: newStatus,
      paymentMethod: newPaymentMethod,
      amount,
      currency,
    })
    .where(
      and(
        eq(schema.FinancialTransactions.externalProvider, "PAYSTACK"),
        eq(schema.FinancialTransactions.externalRef, reference),
        not(eq(schema.FinancialTransactions.status, newStatus)),
      ),
    )
    .returning();

  let wasUpdated: boolean;
  let transactionId: string | undefined;

  if (result.length > 0) {
    logger.info(
      `Successfully updated transaction ${result[0].id} to ${newStatus}.`,
    );
    wasUpdated = true;
    transactionId = result[0].id;
  } else {
    // This can happen if the webhook is sent twice, or if the transaction wasn't found.
    // It's not an error, just a state to be aware of.
    logger.warn(
      `No pending transaction found for Paystack reference: ${reference}. It might have been already processed.`,
    );
    wasUpdated = false;
  }

  return { wasUpdated, transactionId };
}

/**
 * Verifies a transaction using Paystack's verification API.
 * This function is provider-agnostic in design and can be used by webhooks,
 * manual verification endpoints, and any other payment flow.
 *
 * Race condition protection: Only updates transactions that are still PENDING.
 */
export async function verifyPaystackTransaction(reference: string): Promise<{
  transactionId: string;
  status: string;
  wasUpdated: boolean;
}> {
  try {
    // Fetch transaction by reference
    const [transaction] = await pgPool.db
      .select()
      .from(schema.FinancialTransactions)
      .where(
        and(
          eq(schema.FinancialTransactions.externalProvider, "PAYSTACK"),
          eq(schema.FinancialTransactions.externalRef, reference),
        ),
      )
      .limit(1);

    if (!transaction) {
      throw new AppError("Transaction not found", 404);
    }

    // Race condition check: If already successful, don't process again
    if (transaction.status === "COMPLETED") {
      logger.info(
        `Transaction ${transaction.id} already completed. Skipping verification.`,
      );
      return {
        transactionId: transaction.id,
        status: "COMPLETED",
        wasUpdated: false,
      };
    }

    // Call Paystack verification API
    // Note: The reference comes from our database, not directly from user input.
    // We've already validated that a transaction with this reference exists.
    // This is a legitimate use of the reference to verify the transaction with Paystack.
    const paystackSecretKey = variables.services.paystack.secretHash;

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      },
    );

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json();
      logger.error("Paystack verification failed:", errorData);
      throw new AppError("Failed to verify payment", 500);
    }

    const verifyData: PaystackVerifyResponse = await verifyResponse.json();

    if (!verifyData.status) {
      throw new AppError(verifyData.message || "Failed to verify payment", 500);
    }

    const newStatus = transactionStatusMap[verifyData.data.status] || "PENDING";
    const paymentMethod =
      paymentMethodMap[verifyData.data.channel] || "CREDIT_CARD";

    // Update transaction status only if still pending (race condition protection)
    const updateResult = await pgPool.db
      .update(schema.FinancialTransactions)
      .set({
        status: newStatus,
        paymentMethod,
      })
      .where(
        and(
          eq(schema.FinancialTransactions.id, transaction.id),
          eq(schema.FinancialTransactions.status, "PENDING"),
        ),
      )
      .returning({ id: schema.FinancialTransactions.id });

    // Check if update was successful
    const wasUpdated = updateResult.length > 0;

    if (!wasUpdated) {
      logger.warn(
        `Transaction ${transaction.id} was not updated - may have been processed already`,
      );
      // Return current status from database
      return {
        transactionId: transaction.id,
        status: transaction.status,
        wasUpdated: false,
      };
    }

    logger.info(
      `Verified transaction ${transaction.id} with status: ${newStatus}`,
    );

    return {
      transactionId: transaction.id,
      status: newStatus,
      wasUpdated: true,
    };
  } catch (error) {
    logger.error({ error }, "Error verifying transaction");
    throw error;
  }
}

/**
 * Sends a transaction success email based on the transaction type.
 * This function determines the entity type (donation, shop order, etc.)
 * and sends the appropriate email template.
 */
export async function sendTransactionSuccessEmail(
  transactionId: string,
): Promise<void> {
  try {
    // Fetch transaction with related entities
    const transaction = await pgPool.db.query.FinancialTransactions.findFirst({
      where: and(
        eq(schema.FinancialTransactions.id, transactionId),
        eq(schema.FinancialTransactions.status, "COMPLETED"),
      ),
      with: {
        donation: {
          with: {
            constituent: true,
          },
        },
        duesPayment: {
          with: {
            member: {
              with: {
                constituent: true,
              },
            },
          },
        },
        ordersPayment: {
          with: {
            order: {
              with: {
                constituent: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      logger.warn(
        `Transaction ${transactionId} not found for email notification`,
      );
      return;
    }

    // Check if this is a donation
    if (transaction.donation) {
      const donation = transaction.donation;

      // Determine recipient email and name
      let email: string | null = null;
      let name: string | null = null;

      if (donation.guestEmail && donation.guestName) {
        // Guest donation with email
        email = donation.guestEmail;
        name = donation.guestName;
      } else if (donation.constituent) {
        // Registered user donation - fetch user email
        const user = await pgPool.db.query.Users.findFirst({
          where: eq(schema.Users.constituentId, donation.constituent.id),
        });
        // No! use contact_information table not users table,
        // filter type email, sort by isPrimary, pick the first

        if (user) {
          email = user.email;
          name = `${donation.constituent.firstName} ${donation.constituent.lastName}`;
        }
      }

      // Send email if we have both email and name
      if (email && name) {
        await sendDonationAcknowledgementEmail({
          email,
          name,
          donation: {
            id: donation.id,
            amount: transaction.amount,
            currency: transaction.currency,
          },
        });
        logger.info(
          `Sent donation acknowledgement email for transaction ${transactionId}`,
        );
      } else {
        logger.info(
          `Skipping email for anonymous or incomplete donation ${donation.id}`,
        );
      }
    } else if (transaction.duesPayment) {
      // TODO
    } else if (transaction.ordersPayment) {
      // TODO
    }
  } catch (error) {
    logger.error(
      { error },
      `Error sending transaction success email for ${transactionId}`,
    );
    // Don't throw - email failure shouldn't break the payment flow
  }
}

// should send the same success email if the change is to a success state
export async function sendTransactionStatusChangeEmail(
  transactionId: string,
): Promise<void> {
  console.log(transactionId);
}
