import { ApiResponse, AppError, AuthenticatedUser } from "@/shared/types";
import { CreateDonationSchema } from "@/shared/validators/donations";
import z from "zod";
import * as donationsService from "@/shared/services/donationsService";
import pgPool from "@/configs/db";
import { and, eq, getTableColumns } from "drizzle-orm";
import schema from "@/db/schema";
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
 * Handler for verifying a donation
 */
export async function verifyDonation(
  id: string,
  user: AuthenticatedUser | null,
): Promise<ApiResponse<{ status: string }>> {
  const [donation] = await pgPool.db
    .select({
      ...getTableColumns(schema.Donations),
      transaction: schema.FinancialTransactions,
    })
    .from(schema.Donations)
    .innerJoin(
      schema.FinancialTransactions,
      eq(schema.Donations.transactionId, schema.FinancialTransactions.id),
    )
    .where(
      and(
        eq(schema.Donations.id, id),
        eq(schema.FinancialTransactions.externalProvider, "PAYSTACK"),
      ),
    )
    .limit(1);

  if (!donation) {
    throw new AppError("Donation not found", 404);
  }

  const result = await donationsService.verifyPaystackDonation(donation, user);

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
