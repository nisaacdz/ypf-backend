import z from "zod";
import { PaginationQuery } from "@/shared/validators";

export const GetChaptersQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetChapterLeadershipQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const GetConstituentChaptersQuerySchema = z.object({
  ...PaginationQuery.shape,
});

export const CreateChapterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  country: z.string().min(1, "Country is required"),
  description: z.string("Invalid description format.").optional(),
  foundingDate: z.coerce.date("Invalid date format.").optional(),
  parentId: z.uuid("Invalid parent chapter ID").optional(),
});

export const UpdateChapterSchema = z
  .object({
    name: z.string().min(1, "Name is required").optional(),
    country: z.string().min(1, "Country is required").optional(),
    description: z.string("Invalid description format.").optional(),
    foundingDate: z.coerce.date("Invalid date format.").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
  });

export const EnrollChapterSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
  startedAt: z.iso.datetime().optional(),
});

export const UnenrollChapterSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
});

/**
 * Allowed chapter-role alias values. Kept in sync with
 * `CHAPTER_ROLE_ALIASES` in `chaptersService.ts`.
 */
export const ChapterRoleAliasEnum = z.enum([
  "chapterlead",
  "chapterhead",
  "chapter_secretary",
  "chapter_finance",
  "chapter_programs",
  "chapter_welfare",
  "chapter_media",
  "chapter_records",
]);

export const ChapterRoleParamsSchema = z.object({
  id: z.uuid("Invalid chapter ID"),
  roleAlias: ChapterRoleAliasEnum,
});

export const AssignChapterRoleSchema = z.object({
  constituentId: z.uuid({ message: "Invalid constituent ID." }),
});
