import z from "zod";
import { PaginationQuery } from ".";

export const GetMembersQuerySchema = z.object({
  chapterId: z.uuid().optional(),
  committeeId: z.uuid().optional(),
  ...PaginationQuery.shape,
});
