import { ApiResponse } from "@/shared/types";
import {
  CreateDonationSchema,
  DonationIdParamsSchema,
} from "@/shared/validators/donations";
import z from "zod";
import * as donationsService from "@/shared/services/donationsService";

interface DonationResponse {
  id: string;
  amount: string;
  currency: string;
  donor?: {
    firstName: string;
    lastName: string;
    salutation?: string | null;
  };
}

/**
 * Handler for creating a new donation
 */
export async function createDonation(
  body: z.infer<typeof CreateDonationSchema>,
  authenticatedConstituentId?: string,
): Promise<ApiResponse<{ donation: DonationResponse; paymentUrl: string }>> {
  const result = await donationsService.createDonation({
    ...body,
    authenticatedConstituentId,
  });

  return {
    success: true,
    message: "Donation created successfully",
    data: result,
  };
}

/**
 * Handler for verifying a donation
 */
export async function verifyDonation(
  params: z.infer<typeof DonationIdParamsSchema>,
): Promise<ApiResponse<{ status: string }>> {
  const result = await donationsService.verifyDonation(params.id);

  return {
    success: true,
    message: "Donation verified successfully",
    data: result,
  };
}

/**
 * Handler for checking donation status
 */
export async function checkDonation(
  params: z.infer<typeof DonationIdParamsSchema>,
): Promise<
  ApiResponse<{ completed: boolean; status: string; updatedAt: Date }>
> {
  const result = await donationsService.checkDonationStatus(params.id);

  return {
    success: true,
    message: "Donation status retrieved successfully",
    data: result,
  };
}
