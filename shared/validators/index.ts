import z from "zod";

export * from "./auth";

export const PaginationQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  search: z.coerce.string().optional(),
});

