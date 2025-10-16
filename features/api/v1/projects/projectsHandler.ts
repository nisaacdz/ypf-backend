import { ApiResponse } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import { GetProjectsQuerySchema } from "@/shared/validators/activities";
import z from "zod";
import { YPFProject } from "@/shared/dtos";
import * as projectsService from "@/shared/services/projectsService";

export async function getProjects(
  query: z.infer<typeof GetProjectsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFProject>>> {
  const data = await projectsService.fetchProjects(query);

  return {
    success: true,
    message: "Projects fetched successfully",
    data,
  };
}
