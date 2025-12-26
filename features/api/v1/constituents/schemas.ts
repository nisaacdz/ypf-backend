import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetConstituentsQuerySchema = z.object({
  ...PaginationQuery.shape,
});
