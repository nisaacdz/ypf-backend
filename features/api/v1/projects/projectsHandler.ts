import { ApiResponse } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import { GetProjectsQuerySchema } from "@/shared/validators/activities";
import z from "zod";
import { YPFProject } from "@/shared/dtos";

export function getProjects(
  query: z.infer<typeof GetProjectsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFProject>>> {
  console.log("Query:", query);
  return Promise.resolve({
    success: true,
    data: { items: [], page: 1, pageSize: 10, total: 0 },
  });
}
