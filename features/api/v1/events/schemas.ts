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
  description: z.string().optional(),
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

export const CreateEventSchema = z.object({
  name: z
    .string({ message: "Event name is required." })
    .min(3, { message: "Event name must be at least 3 characters." })
    .max(100, { message: "Event name must not exceed 100 characters." }),
  description: z.string().optional(),
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

// Plan §8.2 / Audit C3 — public guest registration for an event. Lighter than
// the project version (no rich guest profile) because event attendance is
// typically a quick RSVP rather than a multi-step volunteer application.
export const GuestEventRegistrationSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.email(),
  phone: z.string().min(1).max(50),
  consents: z
    .object({ termsAgreedAt: z.string().datetime() })
    .strict(),
});
