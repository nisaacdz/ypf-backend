import { ApiResponse } from "@/shared/types";
import * as transactionsService from "@/shared/services/transactionsService";

export async function handlePaystackWebhook(
  payload: transactionsService.PaystackWebhookPayload,
): Promise<ApiResponse<null>> {
  const result = await transactionsService.handlePaystackWebhook(payload);

  if (result.wasUpdated && result.transactionId) {
    transactionsService.sendTransactionStatusChangeEmail(result.transactionId);
  }

  return {
    success: true,
    message: "Webhook processed",
    data: null,
  };
}
