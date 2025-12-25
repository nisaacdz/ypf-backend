import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetCommitteesQuerySchema = z.object({
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
  ...PaginationQuery.shape,
});

export const GetConstituentCommitteesQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetCommitteeLeadershipQuerySchema = z.object({
  ...PaginationQuery.shape,
});
