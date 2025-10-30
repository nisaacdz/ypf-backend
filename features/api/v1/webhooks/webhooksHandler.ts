import { ApiResponse } from "@/shared/types";
import * as paymentService from "@/shared/services/paymentsService";

export async function handlePaystackWebhook(
  payload: paymentService.PaystackWebhookPayload,
): Promise<ApiResponse<null>> {
  await paymentService.updatePaystackTransaction(payload);

  return {
    success: true,
    message: "Donation transaction updated",
    data: null,
  };
}
