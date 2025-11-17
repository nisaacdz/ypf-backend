import z from "zod";
import { PaginationQuery } from ".";

export const GetMembersQuerySchema = z.object({
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
  committeeId: z.uuid({ message: "Invalid committee ID format." }).optional(),
  ...PaginationQuery.shape,
});

export const GetChaptersQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetCommitteesQuerySchema = z.object({
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
  ...PaginationQuery.shape,
});

export const UpdateChapterSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  foundingDate: z.coerce.date().optional(),
});
