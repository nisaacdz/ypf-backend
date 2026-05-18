import z from "zod";
import { MediumTypeEnum } from "@/db/schema/core";
import { PaginationQuery } from "@/shared/validators";

export const GetCommitteesQuerySchema = z.object({
  chapterId: z.uuid({ message: "Invalid chapter ID format." }).optional(),
  ...PaginationQuery.shape,
});

export const GetConstituentCommitteesQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetCommitteeLeadershipQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const EnrollCommitteeSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
  startedAt: z.iso.datetime().optional(),
  titleAlias: z
    .enum(["committeemember", "committeechair"])
    .default("committeemember"),
});

export const UnenrollCommitteeSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
});

// ──────────────────────────────────────────────────────────────────────────
// Committee media (Phase 1.3) — chair or any committee member may upload.
// ──────────────────────────────────────────────────────────────────────────

export const UploadCommitteeMediumOptionsSchema = z.object({
  caption: z.string().max(255).optional(),
  isFeatured: z.coerce.boolean().optional().default(false),
});

export const UploadCommitteeFileSchema = z
  .object({
    size: z.number().positive(),
    mimeType: z.enum(["image/png", "image/jpeg", "video/mp4", "video/avi"], {
      error: () => ({
        message: "Invalid file type. Only PNG, JPG, MP4, or AVI are allowed.",
      }),
    }),
  })
  .refine(
    (d) => !d.mimeType.startsWith("image/") || d.size <= 50 * 1024 * 1024,
    { message: "Image size cannot exceed 50MB.", path: ["size"] },
  )
  .refine(
    (d) => !d.mimeType.startsWith("video/") || d.size <= 250 * 1024 * 1024,
    { message: "Video size cannot exceed 250MB.", path: ["size"] },
  );

export const UpdateCommitteeMediumSchema = z.object({
  caption: z.string().max(255).optional(),
  isFeatured: z.coerce.boolean().optional(),
});

export const GetCommitteeMediaQuerySchema = z.object({
  ...PaginationQuery.shape,
  mediaType: z.enum(MediumTypeEnum.enumValues).optional(),
});
