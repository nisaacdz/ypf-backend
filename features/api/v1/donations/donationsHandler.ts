import { ApiError, ApiResponse, AuthenticatedUser } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import { CreateDonationSchema, GetDonationsQuerySchema } from "./schemas";
import z from "zod";
import * as donationsService from "@/shared/services/donationsService";
import * as transactionsService from "@/shared/services/transactionsService";
import { YPFDonation } from "./dtos";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/configs/logger";

/**
 * Handler for creating a new donation
 */
export async function initiatePaystackDonation(
  body: z.infer<typeof CreateDonationSchema>,
  user: AuthenticatedUser | null,
): Promise<ApiResponse<{ donation: YPFDonation; paymentUrl: string }>> {
  const result = await donationsService.startPaystackDonation(body, user);

  return {
    success: true,
    message: "Donation created successfully",
    data: result,
  };
}

export async function getDonations(
  query: z.infer<typeof GetDonationsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFDonation>>> {
  const data = await donationsService.getDonations(query);
  return { success: true, data };
}

/**
 * Plan §8.9 — public success-page polling. Returns minimal status/amount only,
 * no PII. 404s until the donation row exists.
 *
 * Webhook-loss fallback: when status is still PENDING, opportunistically call
 * Paystack's /transaction/verify endpoint and update the row if Paystack reports
 * a terminal state. This is what makes local development work without a public
 * tunnel (Paystack can't reach localhost), and acts as a safety net in
 * production for the rare case where a webhook is dropped.
 */
export async function getDonationByRef(
  ref: string,
): Promise<
  ApiResponse<{
    status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
    amount: string;
    currency: string;
  }>
> {
  const selectByRef = () =>
    dbClient.db
      .select({
        status: schema.FinancialTransactions.status,
        amount: schema.FinancialTransactions.amount,
        currency: schema.FinancialTransactions.currency,
      })
      .from(schema.FinancialTransactions)
      .innerJoin(
        schema.Donations,
        eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
      )
      .where(eq(schema.FinancialTransactions.externalRef, ref))
      .limit(1);

  let [row] = await selectByRef();

  if (!row) {
    throw new ApiError("Donation not found", 404);
  }

  if (row.status === "PENDING") {
    try {
      const result = await transactionsService.verifyTransaction(ref);
      if (result.wasUpdated) {
        [row] = await selectByRef();
      }
    } catch (err) {
      // Verify failed (network, Paystack 4xx, etc.). Keep returning the
      // current PENDING state so the client keeps polling — the webhook
      // path may still land it.
      logger.warn(
        { err, ref },
        "Paystack verify-on-poll failed; returning current status",
      );
    }
  }

  return {
    success: true,
    data: {
      status: row.status,
      amount: row.amount,
      currency: row.currency,
    },
  };
}
