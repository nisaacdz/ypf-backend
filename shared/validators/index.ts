import z from "zod";
import { Profiles } from "../types";

export const PaginationQuery = z.object({
  page: z.coerce
    .number({ message: "Page must be a number." })
    .min(1, { message: "Page must be at least 1." })
    .default(1),
  pageSize: z.coerce
    .number({ message: "Page size must be a number." })
    .min(1, { message: "Page size must be at least 1." })
    .max(100, { message: "Page size cannot exceed 100." })
    .default(10),
  search: z.coerce.string().optional(),
});

export const AuthenticatedUserSchema = z.object({
  id: z.uuid({ message: "Invalid user ID format." }),
  constituentId: z.string({ message: "Constituent ID is required." }),
  email: z.email({ message: "Please enter a valid email address." }),
  fullName: z.string({ message: "Full name is required." }),
  roles: z.array(z.string(), { message: "Roles must be an array of strings." }), //eg 'ADMIN.REGULAR', 'MEMBER.president', 'MEMBER.chair.<committee_id>' etc
  profiles: z
    .array(z.enum(Profiles), {
      message: "Profiles must be an array.",
    })
    .max(Profiles.length, {
      message: `You can have at most ${Profiles.length} active profiles.`,
    }),
});
