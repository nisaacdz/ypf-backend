import { z } from "zod";

export const createCertificateSchema = z.object({
  recipientId: z.string().uuid(),
  type: z.enum([
    "EVENT_PARTICIPATION",
    "PROGRAM_COMPLETION",
    "HONORARY",
    "MEMBERSHIP",
    "VOLUNTEER_APPRECIATION"
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  issueDate: z.string().datetime().optional(), // Defaults to now
  expiryDate: z.string().datetime().optional(),
  fileUrl: z.string().url().optional(),
  eventId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateCertificateSchema = createCertificateSchema.partial();
