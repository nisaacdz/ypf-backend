import { z } from "zod";

export const createDuesSchema = z.object({
  chapterId: z.string().uuid().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  periodStart: z.string(), // ISO date
  periodEnd: z.string(), // ISO date
});

export const updateDuesSchema = createDuesSchema.partial();

export const payDuesSchema = z.object({
  duesId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  paymentMethod: z.enum(['CREDIT_CARD', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CASH']),
  reference: z.string().optional(),
});

export type CreateDuesInput = z.infer<typeof createDuesSchema>;
export type UpdateDuesInput = z.infer<typeof updateDuesSchema>;
export type PayDuesInput = z.infer<typeof payDuesSchema>;
