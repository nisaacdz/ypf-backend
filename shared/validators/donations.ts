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
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        email: z.string().email("Invalid email address").optional(),
        phone: z.string().min(1, "Phone number is required").optional(),
        salutation: z.string().optional(),
      })
      .optional(),
    projectId: z.string().uuid("Invalid project ID").optional(),
    eventId: z.string().uuid("Invalid event ID").optional(),
  })
  .refine(
    (data) => {
      // If not anonymous and not authenticated, donorInfo is required
      // This will be checked at the handler level with authenticatedConstituentId
      return data.anonymous || data.donorInfo;
    },
    {
      message: "Donor information is required for non-anonymous donations",
      path: ["donorInfo"],
    },
  )
  .refine(
    (data) => {
      // If donorInfo is provided, at least email or phone is required
      if (data.donorInfo && !data.anonymous) {
        return data.donorInfo.email || data.donorInfo.phone;
      }
      return true;
    },
    {
      message: "Either email or phone is required",
      path: ["donorInfo"],
    },
  );

/**
 * Schema for donation ID parameter
 */
export const DonationIdParamsSchema = z.object({
  id: z.string().uuid("Invalid donation ID"),
});
