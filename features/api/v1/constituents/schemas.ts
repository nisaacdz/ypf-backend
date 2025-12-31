import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetConstituentsQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const OnboardConstituentSchema = z.object({
  id: z.uuid({ message: "Invalid constituent ID format." }),
});

export const UpdateConstituentSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  campus: z.string().optional(),
  status: z.enum(["active", "inactive", "pending"]).optional(),
});
