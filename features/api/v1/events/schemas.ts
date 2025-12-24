import z from "zod";
import { EventStatusEnum, EventTypeEnum } from "@/db/schema/activities";
import { MediumTypeEnum } from "@/db/schema/core";
import { PaginationQuery } from "@/shared/validators";

export const UpdateEventSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Event name must be at least 3 characters." })
    .max(100, { message: "Event name must not exceed 100 characters." })
    .optional(),
  objective: z.string().optional(),
  location: z.string().optional(),
  scheduledStart: z.coerce
    .date({
      message: "Please enter a valid start date.",
    })
    .optional(),
  scheduledEnd: z.coerce
    .date({ message: "Please enter a valid end date." })
    .optional(),
  status: z
    .enum(EventStatusEnum.enumValues, {
      message: "Invalid event status.",
    })
    .optional(),
});

export const UpdateEventMediumSchema = z.object({
  caption: z
    .string()
    .max(255, { message: "Caption must not exceed 255 characters." })
    .optional(),
  isFeatured: z.coerce.boolean().optional(),
});

const u = z
  .object({
    projectId: z.uuid({ message: "Invalid project ID format." }),
  })
  .or(
    z.object({
      welfareCaseId: z.uuid({ message: "Invalid welfareCase ID format." }),
    }),
  );

export const CreateEventSchema = z
  .object({
    name: z
      .string({ message: "Event name is required." })
      .min(3, { message: "Event name must be at least 3 characters." })
      .max(100, { message: "Event name must not exceed 100 characters." }),
    objective: z.string().optional(),
    type: z.enum(EventTypeEnum.enumValues, {
      message: "Invalid event type.",
    }),
    location: z.string({ message: "Location is required." }),
    scheduledStart: z.coerce.date({
      message: "Please enter a valid start date.",
    }),
    scheduledEnd: z.coerce.date({ message: "Please enter a valid end date." }),
    status: z.enum(EventStatusEnum.enumValues, {
      message: "Invalid event status.",
    }),
    projectId: z.uuid({ message: "Invalid project ID format." }).optional(),
    welfareCaseId: z
      .uuid({ message: "Invalid welfareCase ID format." })
      .optional(),
  })
  .refine((data) => !(data.welfareCaseId && data.projectId), {
    message: "Must supply only one: projectId or welfareCaseId",
  });

export const UploadEventMediumOptionsSchema = z.object({
  caption: z
    .string()
    .max(255, { message: "Caption must not exceed 255 characters." })
    .optional(),
  isFeatured: z.coerce.boolean().optional().default(false),
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

export const GetEventsQuerySchema = z.object({
  ...PaginationQuery.shape,
  projectId: z.uuid({ message: "Invalid project ID format." }).optional(),
  filterStatus: z
    .enum(EventStatusEnum.enumValues, {
      message: "Invalid event status.",
    })
    .optional(),
  filterType: z
    .enum(EventTypeEnum.enumValues, {
      message: "Invalid event type.",
    })
    .optional(),
  search: z.string().optional(),
});

export const GetEventMediaQuerySchema = z.object({
  ...PaginationQuery.shape,
  mediaType: z
    .enum(MediumTypeEnum.enumValues, { message: "Invalid medium type." })
    .optional(),
});
