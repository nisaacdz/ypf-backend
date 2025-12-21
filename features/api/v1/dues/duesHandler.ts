import { ApiResponse, AuthenticatedUser } from "@/shared/types";
import {
  InitiateDuesPaymentSchema,
  GetMemberDuesPaymentsQuerySchema,
  GetDuesQuerySchema,
} from "./schemas";
import {
  YPFDues,
  YPFDuesPayment,
  YPFDuesPaymentWithPeriod,
  YPFMemberDuesStatus,
  YPFDuesPaymentInitiation,
} from "./dtos";
import { Paginated } from "@/shared/dtos";
import z from "zod";
import * as duesService from "@/shared/services/duesService";

/**
 * Get all available dues
 */
export async function getAvailableDues(
  query: z.infer<typeof GetDuesQuerySchema>,
): Promise<ApiResponse<Paginated<YPFDues>>> {
  const result = await duesService.getAvailableDues(query);
  return { success: true, data: result };
}

/**
 * Get dues status for a specific dues and member
 */
export async function getMemberDuesStatus(
  memberId: string,
  duesId: string,
): Promise<ApiResponse<YPFMemberDuesStatus>> {
  const result = await duesService.getMemberDuesStatus(memberId, duesId);
  return { success: true, data: result };
}

/**
 * Get all dues payment history for a member
 */
export async function getMemberDuesPayments(
  memberId: string,
  query: z.infer<typeof GetMemberDuesPaymentsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFDuesPaymentWithPeriod>>> {
  const result = await duesService.getMemberDuesPayments(memberId, query);
  return { success: true, data: result };
}

/**
 * Initiate a dues payment via Paystack
 */
export async function initiateDuesPayment(
  body: z.infer<typeof InitiateDuesPaymentSchema>,
  user: AuthenticatedUser,
): Promise<ApiResponse<YPFDuesPaymentInitiation>> {
  const result = await duesService.initiateDuesPayment(body, user);
  return {
    success: true,
    message: "Payment initiated successfully",
    data: result,
  };
}
