import { ApiResponse } from "@/shared/types";
import { Paginated } from "@/shared/dtos";
import {
  GetProjectsQuerySchema,
  GetProjectMediaQuerySchema,
} from "@/shared/validators/activities";
import z from "zod";
import { YPFProject, YPFProjectMedium } from "@/shared/dtos";
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

export async function getProjectMedia(
  projectId: string,
  query: z.infer<typeof GetProjectMediaQuerySchema>,
): Promise<ApiResponse<Paginated<YPFProjectMedium>>> {
  const { page, pageSize } = query;
  const { items, total } = await projectsService.fetchProjectMedia(
    projectId,
    query,
  );
  return {
    success: true,
    message: "Project media fetched successfully",
    data: {
      items,
      page,
      pageSize,
      total,
    },
  };
}
