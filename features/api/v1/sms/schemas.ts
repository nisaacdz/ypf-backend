import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const SendBroadcastSchema = z.object({
  message: z
    .string()
    .min(1, "Message body is required")
    .max(1500, "Message is too long"),
  audience: z.enum(["all", "members", "chapter", "committee", "custom"]),
  chapterIds: z.array(z.uuid()).optional(),
  committeeIds: z.array(z.uuid()).optional(),
  customPhones: z.array(z.string().min(3)).optional(),
});

export const GetHistoryQuerySchema = z.object({
  ...PaginationQuery.shape,
  event: z.string().optional(),
  status: z.enum(["SENT", "FAILED", "SKIPPED"]).optional(),
  batchId: z.uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
