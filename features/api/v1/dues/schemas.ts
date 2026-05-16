import { z } from "zod";

/**
 * Schema for initiating a dues payment via Paystack
 */
export const InitiateDuesPaymentSchema = z.object({
  duesId: z.string().uuid("Invalid dues ID"),
  amount: z.number().positive("Amount must be a positive number"),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter code")
    .default("GHS"),
});

/**
 * Schema for getting dues payments for a member
 */
export const GetMemberDuesPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * Schema for getting all available dues
 */
export const GetDuesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

/**
 * Schema for super-admin to set the monthly dues policy. Replaces the
 * currently active policy.
 */
export const SetDuesPolicySchema = z.object({
  amount: z.number().positive("Amount must be a positive number"),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter code")
    .default("GHS"),
});

/**
 * Schema for admin-recorded offline dues payment. `paymentMethod` matches the
 * subset of the backend's `PaymentMethodEnum` that can sensibly be entered
 * by hand (CASH/BANK_TRANSFER/MOBILE_MONEY) — credit-card flow always goes
 * through Paystack.
 */
export const RecordOfflineDuesPaymentSchema = z.object({
  memberId: z.string().uuid("Invalid member ID"),
  duesId: z.string().uuid("Invalid dues ID"),
  amount: z.number().positive("Amount must be a positive number"),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter code")
    .default("GHS"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY"]),
  note: z.string().max(500).optional(),
});
