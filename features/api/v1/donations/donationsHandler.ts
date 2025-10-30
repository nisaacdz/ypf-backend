import { ApiResponse, AppError, AuthenticatedUser } from "@/shared/types";
import { CreateDonationSchema } from "@/shared/validators/donations";
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
  user: AuthenticatedUser | null,
): Promise<ApiResponse<{ donation: DonationResponse; paymentUrl: string }>> {
  // Validate that donor info is provided if not authenticated and not anonymous
  if (!user && !body.anonymous && !body.donorInfo) {
    throw new AppError(
      "Donor information is required for non-anonymous guest donations",
      400,
    );
  }

  const result = await donationsService.createDonation(
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
 * Handler for verifying a donation
 */
export async function verifyDonation(
  id: string,
): Promise<ApiResponse<{ status: string }>> {
  const result = await donationsService.verifyDonation(id);

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
