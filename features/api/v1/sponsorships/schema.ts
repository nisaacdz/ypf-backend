import { z } from "zod";

export const createSponsorshipSchema = z.object({
  organizationId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional(),
  value: z.string().optional(), // Decimal as string
  metadata: z.string().optional(),
});

export const updateSponsorshipSchema = createSponsorshipSchema.partial();
