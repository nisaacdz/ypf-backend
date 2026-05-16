import { z } from "zod";
import { TargetingFilter } from "@/shared/types/targeting";

export const TargetingFilterSchema = z.object({
  chapterIds: z.array(z.string().uuid()).optional(),
  committeeIds: z.array(z.string().uuid()).optional(),
  roles: z.array(z.string()).optional(),
  constituentTypes: z
    .array(z.enum(["MEMBER", "VOLUNTEER", "ADMIN"]))
    .optional(),
  status: z.enum(["ACTIVE", "PAST", "ALL"]).default("ACTIVE"),
});

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  targetCriteria: TargetingFilterSchema,
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
  sendAt: z.iso.datetime().optional(),
});

export type CreateAnnouncementDto = z.infer<typeof CreateAnnouncementSchema>;

export const UpdateAnnouncementSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  targetCriteria: TargetingFilterSchema.optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
});

export type UpdateAnnouncementDto = z.infer<typeof UpdateAnnouncementSchema>;
