import z from "zod";
import { ApiResponse } from "@/shared/types";
import * as smsService from "@/shared/services/smsService";
import { SendBroadcastSchema, GetHistoryQuerySchema } from "./schemas";

export async function getBalance(): Promise<
  ApiResponse<{
    balance: number;
    currency: string;
    configured: boolean;
    sandbox: boolean;
    senderId: string;
  } | null>
> {
  const data = await smsService.fetchBalance();
  return {
    success: true,
    message: data?.configured
      ? "Arkesel balance fetched"
      : "Arkesel not configured",
    data,
  };
}

export async function sendBroadcast(
  body: z.infer<typeof SendBroadcastSchema>,
  user: { constituentId: string },
): Promise<
  ApiResponse<{
    batchId: string;
    sent: number;
    failed: number;
    skipped: number;
    recipients: number;
  }>
> {
  const data = await smsService.manualBroadcast({
    ...body,
    triggeredBy: user.constituentId,
  });
  return {
    success: true,
    message: `Broadcast queued — ${data.sent}/${data.recipients} sent`,
    data,
  };
}

export async function getHistory(
  query: z.infer<typeof GetHistoryQuerySchema>,
): Promise<
  ApiResponse<{
    items: smsService.SmsHistoryRow[];
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  const data = await smsService.fetchSmsHistory(query);
  return {
    success: true,
    message: "SMS history fetched",
    data,
  };
}

export async function getStats(): Promise<ApiResponse<smsService.SmsStats>> {
  const data = await smsService.fetchSmsStats();
  return {
    success: true,
    message: "SMS stats fetched",
    data,
  };
}
