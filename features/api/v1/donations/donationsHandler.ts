import { ApiResponse, AuthenticatedUser } from "@/shared/types";
import { CreateDonationSchema } from "@/shared/validators/donations";
import z from "zod";
import * as donationsService from "@/shared/services/donationsService";
import { DonationResponse } from "@/shared/dtos/donation";

/**
 * Handler for creating a new donation
 */
export async function initiatePaystackDonation(
  body: z.infer<typeof CreateDonationSchema>,
  user: AuthenticatedUser | null,
): Promise<ApiResponse<{ donation: DonationResponse; paymentUrl: string }>> {
  const result = await donationsService.startPaystackDonation(body, user);

  return {
    success: true,
    message: "Donation created successfully",
    data: result,
  };
}
