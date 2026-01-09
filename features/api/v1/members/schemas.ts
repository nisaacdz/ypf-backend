import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetMembersQuerySchema = z.object({
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
  committeeId: z.uuid({ message: "Invalid committee ID format." }).optional(),
  country: z.string().optional(),
  hasTitle: z.coerce.boolean().optional(),
  ...PaginationQuery.shape,
});

export const GetRolesQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetLeadershipQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const EnrollMemberSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
  startedAt: z.iso.datetime().optional(),
});

export const UnenrollMemberSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
});

export const EnrollRoleSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
  startedAt: z.iso.datetime().optional(),
});

export const UnenrollRoleSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
});
