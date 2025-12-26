import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetConstituentsQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const OnboardConstituentSchema = z.object({
  id: z.uuid({ message: "Invalid constituent ID format." }),
});
