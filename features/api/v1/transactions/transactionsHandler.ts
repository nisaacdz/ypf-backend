import { ApiResponse } from "@/shared/types";
import * as paymentsService from "@/shared/services/paymentsService";

/**
 * Handler for verifying a transaction by reference
 */
export async function verifyTransaction(
  reference: string,
): Promise<ApiResponse<{ status: string }>> {
  const result = await paymentsService.verifyPaystackTransaction(reference);

  // If transaction was just updated to completed, send success email
  if (result.wasUpdated && result.status === "COMPLETED") {
    await paymentsService.sendTransactionSuccessEmail(result.transactionId);
  }

  return {
    success: true,
    message: "Transaction verified successfully",
    data: {
      status: result.status,
    },
  };
}
