import { z } from "zod";

export const createWelfareCaseSchema = z.object({
  type: z.enum([
    "FINANCIAL_SUPPORT",
    "MEDICAL",
    "EDUCATIONAL",
    "EMERGENCY",
    "COUNSELING",
    "OTHER"
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  requestedAmount: z.string().optional(), // Decimal as string
  chapterId: z.string().uuid().optional(),
});

export const updateWelfareCaseSchema = z.object({
  status: z.enum([
    "PENDING",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
    "RESOLVED"
  ]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  approvedAmount: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  resolvedAt: z.string().datetime().optional(),
});

export const assignWelfareCaseSchema = z.object({
  assigneeId: z.string().uuid(),
});
