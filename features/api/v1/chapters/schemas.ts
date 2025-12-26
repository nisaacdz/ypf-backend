import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetChaptersQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetChapterLeadershipQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetConstituentChaptersQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const UpdateChapterSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
    description: z.string("Invalid description format.").optional(),
    foundingDate: z.coerce.date("Invalid date format.").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const EnrollChapterSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
  startedAt: z.string().datetime().optional(),
});

export const UnenrollChapterSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
});
