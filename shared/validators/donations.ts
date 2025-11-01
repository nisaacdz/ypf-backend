import { z } from "zod";

/**
 * Schema for creating a donation via Paystack
 */
export const CreateDonationSchema = z
  .object({
    amount: z.number().positive("Amount must be a positive number"),
    currency: z
      .string()
      .length(3, "Currency must be a 3-letter code")
      .default("GHS"),
    anonymous: z.boolean().optional().default(false),
    donorInfo: z
      .object({
        name: z.string().min(1, "Name is required"),
        email: z.email("Invalid email address").optional(),
        phone: z.string().min(1, "Phone number is required").optional(),
      })
      .optional(),
    projectId: z.uuid("Invalid project ID").optional(),
    eventId: z.uuid("Invalid event ID").optional(),
  })
  .refine(
    (data) => {
      // If donorInfo is provided and not anonymous, at least email or phone is required
      if (data.donorInfo && !data.anonymous) {
        return data.donorInfo.email || data.donorInfo.phone;
      }
      return true;
    },
    {
      message:
        "Either email or phone is required when providing donor information",
      path: ["donorInfo"],
    },
  );
