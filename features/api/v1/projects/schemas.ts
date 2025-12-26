import z from "zod";
import { ProjectStatusEnum, ProjectTypeEnum } from "@/db/schema/activities";
import { MediumTypeEnum } from "@/db/schema/core";
import { PaginationQuery } from "@/shared/validators";

export const GetProjectsQuerySchema = z.object({
  filterStatus: z
    .enum(ProjectStatusEnum.enumValues, {
      message: "Invalid project status.",
    })
    .optional(),
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
  ...PaginationQuery.shape,
});

export const GetProjectMediaQuerySchema = z.object({
  ...PaginationQuery.shape,
  mediaType: z
    .enum(MediumTypeEnum.enumValues, { message: "Invalid medium type." })
    .optional(),
});

export const UploadProjectFileSchema = z
  .object({
    size: z
      .number()
      .positive({ message: "File size must be a positive number." }),
    mimeType: z.enum(["image/png", "image/jpeg", "video/mp4", "video/avi"], {
      error: () => ({
        message: "Invalid file type. Only PNG, JPG, MP4, or AVI are allowed.",
      }),
    }),
  })
  .refine(
    (data) => {
      if (!data.mimeType.startsWith("image/")) {
        return true;
      }
      return data.size <= 50 * 1024 * 1024;
    },
    {
      message: "Image size cannot exceed 50MB.",
      path: ["size"],
    },
  )
  .refine(
    (data) => {
      if (!data.mimeType.startsWith("video/")) {
        return true;
      }
      return data.size <= 250 * 1024 * 1024;
    },
    {
      message: "Video size cannot exceed 250MB.",
      path: ["size"],
    },
  );

export const UploadProjectMediumOptionsSchema = z.object({
  caption: z
    .string()
    .max(255, { message: "Caption must not exceed 255 characters." })
    .optional(),
  isFeatured: z.coerce.boolean().optional().default(false),
});

export const CreateProjectSchema = z.object({
  title: z
    .string({ message: "Project title is required." })
    .min(3, { message: "Project title must be at least 3 characters." })
    .max(200, { message: "Project title must not exceed 200 characters." }),
  type: z.enum(ProjectTypeEnum.enumValues, {
    message: "Invalid project type.",
  }),
  category: z.string().optional(),
  abstract: z.string().optional(),
  description: z.string().optional(),
  scheduledStart: z.coerce.date({
    message: "Please enter a valid start date.",
  }),
  scheduledEnd: z.coerce.date({ message: "Please enter a valid end date." }),
  status: z
    .enum(ProjectStatusEnum.enumValues, {
      message: "Invalid project status.",
    })
    .default("UPCOMING"),
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
});

export const UpdateProjectSchema = z.object({
  title: z
    .string()
    .min(3, { message: "Project title must be at least 3 characters." })
    .max(200, { message: "Project title must not exceed 200 characters." })
    .optional(),
  type: z
    .enum(ProjectTypeEnum.enumValues, {
      message: "Invalid project type.",
    })
    .optional(),
  category: z.string().optional(),
  abstract: z.string().optional(),
  description: z.string().optional(),
  scheduledStart: z.coerce.date().optional(),
  scheduledEnd: z.coerce.date().optional(),
  status: z
    .enum(ProjectStatusEnum.enumValues, {
      message: "Invalid project status.",
    })
    .optional(),
});

export const UpdateProjectMediumSchema = z.object({
  caption: z
    .string()
    .max(255, { message: "Caption must not exceed 255 characters." })
    .optional(),
  isFeatured: z.coerce.boolean().optional(),
});
