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
  // Plan §5 home-page featured query uses `status=ONGOING` as a flat alias.
  status: z
    .enum(ProjectStatusEnum.enumValues, {
      message: "Invalid project status.",
    })
    .optional(),
  filterType: z
    .enum(ProjectTypeEnum.enumValues, {
      message: "Invalid project type.",
    })
    .optional(),
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
  ...PaginationQuery.shape,
  // Override PaginationQuery's loose `search` with stricter trim + bounds for project listing.
  search: z.string().trim().min(1).max(200).optional(),
});

// Audit I6 — admin roster of who registered for a project. Combines guest
// enrollments (constituent_id NULL, guest_* fields) with member enrollments
// (constituent_id set, joined to Constituents) in a single paginated view.
export const GetProjectEnrollmentsQuerySchema = z.object({
  ...PaginationQuery.shape,
  role: z.enum(["guest", "member", "all"]).default("all"),
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
  location: z.string().max(200).optional(),
  objectives: z.array(z.string().min(1)).optional(),
  impact: z.string().optional(),
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
  location: z.string().max(200).optional(),
  objectives: z.array(z.string().min(1)).optional(),
  impact: z.string().optional(),
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

// Plan §8.1 — public guest project registration. Rich fields go into
// guest_profile JSONB; the dedicated columns (guest_name/email/phone) carry
// the basics for fast lookup + admin lists.
export const GuestProjectRegistrationSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.email(),
  phone: z.string().min(1).max(50),
  guestProfile: z.object({
    age: z.coerce.number().int().min(18, "Must be 18 or older"),
    gender: z
      .enum(["male", "female", "other", "prefer_not_to_say"])
      .optional(),
    location: z.string().min(1).max(200),
    occupation: z.string().max(200).optional(),
    motivation: z.string().min(20).max(2000),
    emergencyContact: z.object({
      name: z.string().min(1).max(120),
      phone: z.string().min(1).max(50),
    }),
    previousVolunteerExperience: z.string().max(2000).optional(),
    note: z.string().max(1000).optional(),
  }),
  consents: z
    .object({ termsAgreedAt: z.string().datetime() })
    .strict(),
});
