import z from "zod";
import { PaginationQuery } from ".";

export const GetMembersQuerySchema = z.object({
  chapterId: z.uuid().optional(),
  committeeId: z.uuid().optional(),
  ...PaginationQuery.shape,
});

export const GetChaptersQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetCommitteesQuerySchema = z.object({
  chapterId: z.uuid().optional(),
  ...PaginationQuery.shape,
});
