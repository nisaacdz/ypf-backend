import { ApiResponse, AuthenticatedUser } from "@/shared/types";
import {
  InitiateDuesPaymentSchema,
  GetMemberDuesPaymentsQuerySchema,
  GetDuesQuerySchema,
  RecordOfflineDuesPaymentSchema,
  SetDuesPolicySchema,
  TriggerDuesReminderSchema,
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
import * as duesReminderService from "@/shared/services/duesReminderService";

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

/**
 * Returns the active dues policy (super-admin-configured monthly amount).
 */
export async function getDuesPolicy(): Promise<ApiResponse<duesService.DuesPolicy | null>> {
  const policy = await duesService.getActiveDuesPolicy();
  return { success: true, data: policy };
}

/**
 * Replaces the active dues policy with new amount/currency. Super-admin only.
 */
export async function setDuesPolicy(
  body: z.infer<typeof SetDuesPolicySchema>,
  user: AuthenticatedUser,
): Promise<ApiResponse<duesService.DuesPolicy>> {
  const policy = await duesService.setDuesPolicy({
    amount: body.amount,
    currency: body.currency,
    createdBy: user.constituentId,
  });
  return {
    success: true,
    message: "Dues policy updated",
    data: policy,
  };
}

/**
 * Admin records an offline (cash/transfer/mobile money) dues payment for a
 * specific member. The payment is marked COMPLETED immediately — no Paystack.
 */
export async function recordOfflineDuesPayment(
  body: z.infer<typeof RecordOfflineDuesPaymentSchema>,
  user: AuthenticatedUser,
): Promise<ApiResponse<{ paymentId: string; transactionId: string }>> {
  const result = await duesService.recordOfflineDuesPayment({
    memberId: body.memberId,
    duesId: body.duesId,
    amount: body.amount,
    currency: body.currency,
    paymentMethod: body.paymentMethod,
    note: body.note,
    recordedBy: user.constituentId,
  });
  return {
    success: true,
    message: "Payment recorded",
    data: result,
  };
}

export async function getDuesDebtors(input: {
  duesId?: string;
}): Promise<ApiResponse<duesReminderService.DuesDebtor[]>> {
  const result = await duesReminderService.getDuesDebtors(input);
  return {
    success: true,
    message: "Dues debtors fetched",
    data: result,
  };
}

export async function triggerDuesReminder(
  memberId: string,
  body: z.infer<typeof TriggerDuesReminderSchema>,
): Promise<ApiResponse<{ reminderId: string }>> {
  const reminder = await duesReminderService.triggerReminderForMember({
    memberId,
    duesId: body.duesId,
  });
  return {
    success: true,
    message: "Dues reminder triggered",
    data: { reminderId: reminder.id },
  };
}

import { Response } from "express";
import { streamCsv } from "@/shared/utils/csv";

/**
 * CSV export of every active member who hasn't fully paid the current
 * dues period. Joins members + payments via the existing debtor query —
 * exactly what shows up on the "send reminders" admin screen.
 */
export async function exportDuesDebtorsCsv(res: Response): Promise<void> {
  const rows = await duesReminderService.getDuesDebtors();
  async function* iterator() {
    for (const d of rows) {
      yield {
        membershipId: d.publicId,
        fullName: d.fullName,
        email: d.email ?? "",
        amountDue: d.amountDue,
        amountPaid: d.amountPaid,
        balance: d.balance,
        currency: d.currency,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        reminderSent: d.reminderSent ? "yes" : "no",
      };
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  await streamCsv(res, {
    filename: `ypf-dues-debtors-${today}.csv`,
    columns: [
      { key: "membershipId", label: "Member ID" },
      { key: "fullName", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "balance", label: "Outstanding" },
      { key: "amountDue", label: "Total Due" },
      { key: "amountPaid", label: "Paid So Far" },
      { key: "currency", label: "Currency" },
      { key: "periodStart", label: "Period Start" },
      { key: "periodEnd", label: "Period End" },
      { key: "reminderSent", label: "Reminder Sent" },
    ],
    rows: iterator(),
  });
}
