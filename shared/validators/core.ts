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
