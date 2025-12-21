import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetMembersQuerySchema = z.object({
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
  committeeId: z.uuid({ message: "Invalid committee ID format." }).optional(),
  ...PaginationQuery.shape,
});
