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
  const result = await donationsService.startPaystackDonation(
    {
      ...body,
    },
    user,
  );

  return {
    success: true,
    message: "Donation created successfully",
    data: result,
  };
}

/**
 * Handler for checking donation status
 */
export async function checkDonation(
  id: string,
): Promise<
  ApiResponse<{ completed: boolean; status: string; updatedAt: Date }>
> {
  const result = await donationsService.checkDonationStatus(id);

  return {
    success: true,
    message: "Donation status retrieved successfully",
    data: result,
  };
}
