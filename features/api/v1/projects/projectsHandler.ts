import { ApiResponse } from "@/shared/types";
import { Paginated, YPFProjectDetail } from "@/shared/dtos";
import {
  GetProjectsQuerySchema,
  GetProjectMediaQuerySchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  UpdateProjectMediumSchema,
} from "@/shared/validators/activities";
import z from "zod";
import { YPFProject, YPFProjectMedium } from "@/shared/dtos";
import * as projectsService from "@/shared/services/projectsService";
import * as mediaUtils from "@/shared/utils/media";
import * as mediaService from "@/shared/services/mediaService";

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

export async function uploadProjectMedium({
  constituentId,
  projectId,
  file,
  options,
}: {
  constituentId: string;
  projectId: string;
  file: Express.Multer.File;
  options: { caption?: string; isFeatured: boolean };
}): Promise<ApiResponse<string>> {
  const uploadMeta = await mediaUtils.storeMediumFile(file);

  try {
    const newMediumId = await mediaService.uploadProjectMedium(projectId, {
      caption: options.caption,
      isFeatured: options.isFeatured,
      medium: {
        externalId: uploadMeta.externalId,
        type: uploadMeta.type,
        width: uploadMeta.dimensions.width,
        height: uploadMeta.dimensions.height,
        size: uploadMeta.size,
        uploadedBy: constituentId,
      },
    });

    return {
      success: true,
      message: "Media uploaded successfully",
      data: newMediumId,
    };
  } catch (error) {
    await mediaUtils.deleteMediumFile(uploadMeta.externalId);
    throw error;
  }
}

export async function getProject(
  projectId: string,
): Promise<ApiResponse<YPFProjectDetail>> {
  const data = await projectsService.fetchProjectById(projectId);

  return {
    success: true,
    message: "Project fetched successfully",
    data,
  };
}

export async function createProject(
  newProject: z.infer<typeof CreateProjectSchema>,
): Promise<ApiResponse<string>> {
  const projectId = await projectsService.createProject(newProject);

  return {
    success: true,
    message: "Project created successfully",
    data: projectId,
  };
}

export async function updateProject(
  projectId: string,
  updates: z.infer<typeof UpdateProjectSchema>,
): Promise<ApiResponse<null>> {
  await projectsService.updateProject(projectId, updates);

  return {
    success: true,
    message: "Project updated successfully",
    data: null,
  };
}

export async function updateProjectMedium(
  projectMediumId: string,
  updates: z.infer<typeof UpdateProjectMediumSchema>,
): Promise<ApiResponse<null>> {
  await projectsService.updateProjectMedium(projectMediumId, updates);

  return {
    success: true,
    message: "Project medium updated successfully",
    data: null,
  };
}
