import { z } from "zod";

export const createProgramSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['mentorship', 'village_childcare', 'welfare', 'leadership', 'networking']),
  startDate: z.string(), // ISO date
  endDate: z.string().optional(),
  budget: z.number().optional(),
  maxParticipants: z.number().int().positive().optional(),
  committeeId: z.string().uuid().optional(),
  chapterId: z.string().uuid().optional(),
});

export const updateProgramSchema = createProgramSchema.partial().extend({
  status: z.enum(['active', 'completed', 'paused']).optional(),
});

export const enrollProgramSchema = z.object({
  memberId: z.string().uuid(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
