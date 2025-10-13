import z from "zod";
import {
  ProjectStatus as ProjectStatusEnum,
  EventStatus as EventStatusEnum,
  MediumType as MediaTypeEnum,
} from "@/db/schema/enums";
import { PaginationQuery } from ".";

export const GetProjectsQuerySchema = z.object({
  filterStatus: z.enum(ProjectStatusEnum.enumValues).optional(),
  ...PaginationQuery.shape,
});

export const GetEventMediaQuerySchema = z.object({
  ...PaginationQuery.shape,
  mediaType: z.enum(MediaTypeEnum.enumValues).optional(),
});

export const CreateEventSchema = z.object({
  name: z.string().min(3).max(100),
  objective: z.string().optional(),
  location: z.string(),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
  status: z.enum(EventStatusEnum.enumValues),
  projectId: z.uuid(),
});

export const UploadEventMediumOptionsSchema = z.object({
  caption: z.string().max(255).optional(),
  isFeatured: z.boolean().optional().default(false),
});

export const UploadEventFileSchema = z
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
