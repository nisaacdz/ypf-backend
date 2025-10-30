import { and, eq } from "drizzle-orm";
import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";
import logger from "@/configs/logger";

// ... (type definitions and maps remain the same)
type TransactionStatusValue =
  (typeof schema.TransactionStatus.enumValues)[number];
type PaymentMethodValue = (typeof schema.PaymentMethod.enumValues)[number];

const statusMap: Record<string, TransactionStatusValue> = {
  success: "COMPLETED",
  failed: "FAILED",
  reversed: "REFUNDED",
};

const paymentMethodMap: Record<string, PaymentMethodValue> = {
  card: "CREDIT_CARD",
  bank: "BANK_TRANSFER",
  bank_transfer: "BANK_TRANSFER",
  transfer: "BANK_TRANSFER",
  mobile_money: "MOBILE_MONEY",
  ussd: "BANK_TRANSFER",
};

export type PaystackWebhookPayload = {
  event: "charge.success" | "charge.failed";
  data: {
    status: string;
    reference: string;
    channel: string;
    // other fields are available
  };
};

export async function updatePaystackTransaction(
  payload: PaystackWebhookPayload,
): Promise<void> {
  const { data } = payload;

  if (!data?.reference || !data.status) {
    // Cannot proceed without a reference or status. This is a malformed payload.
    throw new AppError("Invalid webhook payload", 400);
  }

  const { reference, status, channel } = data;

  const newStatus = statusMap[status];
  const newPaymentMethod = paymentMethodMap[channel];

  if (!newStatus) {
    // This is a legitimate case to stop and log, as it's an unhandled status.
    logger.warn(
      `Received unknown Paystack status: '${status}' for reference: ${reference}`,
    );
    return;
  }

  const result = await pgPool.db
    .update(schema.FinancialTransactions)
    .set({
      status: newStatus,
      paymentMethod: newPaymentMethod,
    })
    .where(
      and(
        eq(schema.FinancialTransactions.externalProvider, "PAYSTACK"),
        eq(schema.FinancialTransactions.externalRef, reference),
        // Important: Only update transactions that are still PENDING.
        // This prevents reprocessing or overwriting a final state.
        eq(schema.FinancialTransactions.status, "PENDING"),
      ),
    )
    .returning({ updatedId: schema.FinancialTransactions.id });

  if (result.length > 0) {
    logger.info(
      `Successfully updated transaction ${result[0].updatedId} to ${newStatus}.`,
    );
  } else {
    // This can happen if the webhook is sent twice, or if the transaction wasn't found.
    // It's not an error, just a state to be aware of.
    logger.warn(
      `No pending transaction found for Paystack reference: ${reference}. It might have been already processed.`,
    );
  }
}
