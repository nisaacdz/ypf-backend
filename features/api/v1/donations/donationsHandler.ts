import { ApiResponse, AuthenticatedUser } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import { CreateDonationSchema, GetDonationsQuerySchema } from "./schemas";
import z from "zod";
import * as donationsService from "@/shared/services/donationsService";
import { YPFDonation } from "./dtos";

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
