import { ApiResponse } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import { GetProjectsQuerySchema } from "@/shared/validators/activities";
import z from "zod";
import { Project } from "@/shared/dtos/core";

export function getProjects(
  query: z.infer<typeof GetProjectsQuerySchema>
): Promise<ApiResponse<Paginated<Project>>> {
  console.log("Query:", query);
  return Promise.resolve({
    success: true,
    data: { data: [], page: 1, pageSize: 10, total: 0 },
  });
}
