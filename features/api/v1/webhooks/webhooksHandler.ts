import { ApiResponse } from "@/shared/types";
import * as paymentService from "@/shared/services/paymentsService";
import logger from "@/configs/logger";

export async function handlePaystackWebhook(
  payload: paymentService.PaystackWebhookPayload,
): Promise<ApiResponse<null>> {
  const { data } = payload;

  if (!data?.reference) {
    logger.warn("Webhook received without reference");
    return {
      success: true,
      message: "Webhook processed (no reference)",
      data: null,
    };
  }

  // Only process success events
  if (payload.event === "charge.success") {
    try {
      // Use the generalized verification function
      const result = await paymentService.verifyPaystackTransaction(
        data.reference,
      );

      // If transaction was updated, send success email
      if (result.wasUpdated && result.status === "COMPLETED") {
        await paymentService.sendTransactionSuccessEmail(result.transactionId);
      }

      logger.info(
        `Webhook processed transaction ${result.transactionId} with status ${result.status}`,
      );
    } catch (error) {
      logger.error({ error }, "Error processing webhook");
      // Don't throw - we want to acknowledge receipt to Paystack
    }
  }

  return {
    success: true,
    message: "Webhook processed",
    data: null,
  };
}
