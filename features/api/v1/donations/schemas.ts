import { z } from "zod";
import { DONATION_PURPOSES } from "@/shared/utils/donationPurposes";

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
    note: z.string().max(500).optional(),
    projectId: z.uuid("Invalid project ID").optional(),
    eventId: z.uuid("Invalid event ID").optional(),
    // A cause, when the gift isn't for a specific project
    purpose: z.enum(DONATION_PURPOSES, { message: "Invalid donation purpose" }).optional(),
  })
  .refine((data) => !(data.projectId && data.purpose), {
    message: "Choose either a project or a cause, not both",
    path: ["purpose"],
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

import { PaginationQuery } from "@/shared/validators";

export const GetDonationsQuerySchema = z.object({
  ...PaginationQuery.shape,
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]).optional(),
  // What the gift was for: a project, a cause, or "GENERAL" (neither)
  projectId: z.uuid().optional(),
  purpose: z.enum([...DONATION_PURPOSES, "GENERAL"]).optional(),
});
