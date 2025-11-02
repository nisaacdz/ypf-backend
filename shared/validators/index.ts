import z from "zod";

export * from "./auth";
export * from "./donations";

export const PaginationQuery = z.object({
  page: z.coerce
    .number({ message: "Page must be a number." })
    .min(1, { message: "Page must be at least 1." })
    .default(1),
  pageSize: z.coerce
    .number({ message: "Page size must be a number." })
    .min(1, { message: "Page size must be at least 1." })
    .max(100, { message: "Page size cannot exceed 100." })
    .default(10),
  search: z.coerce.string().optional(),
});
