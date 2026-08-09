import z from "zod";
import { PostSectionEnum, PostStatusEnum } from "@/db/schema/content";
import { PaginationQuery } from "@/shared/validators";

/**
 * Slugs are the public URL key, so keep them boring: lowercase, digits, and
 * single hyphens. Generated from the title on create; only editable while the
 * post is still a draft.
 */
export const SlugSchema = z
  .string()
  .trim()
  .min(3, { message: "Slug must be at least 3 characters." })
  .max(160, { message: "Slug must not exceed 160 characters." })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      "Slug may only contain lowercase letters, numbers, and single hyphens.",
  });

/**
 * Looser variant for URL lookups. `posts.slug` is citext, so a link shared as
 * `/stories/Her-First-Term` resolves to the same row — validating the param
 * with the strict (lowercase-only) schema would 404 it before the query ever
 * ran, which is exactly what citext exists to prevent.
 */
export const SlugParamSchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, { message: "Invalid Request" });

export const GetPostsQuerySchema = z.object({
  section: z
    .enum(PostSectionEnum.enumValues, { message: "Invalid post section." })
    .optional(),
  tag: z.string().trim().min(1).max(80).optional(),
  year: z.coerce
    .number()
    .int()
    .min(2000, { message: "Year must be 2000 or later." })
    .max(2100)
    .optional(),
  ...PaginationQuery.shape,
  search: z.string().trim().min(1).max(200).optional(),
});

/** Admin listing — same filters plus visibility into drafts. */
export const GetAdminPostsQuerySchema = z.object({
  ...GetPostsQuerySchema.shape,
  status: z
    .enum(PostStatusEnum.enumValues, { message: "Invalid post status." })
    .optional(),
});

export const GetFeaturedPostQuerySchema = z.object({
  section: z.enum(PostSectionEnum.enumValues, {
    message: "Invalid post section.",
  }),
});

export const CreatePostSchema = z.object({
  section: z.enum(PostSectionEnum.enumValues, {
    message: "Invalid post section.",
  }),
  /** Derived from the title when omitted. */
  slug: SlugSchema.optional(),
  title: z
    .string({ message: "Title is required." })
    .min(3, { message: "Title must be at least 3 characters." })
    .max(200, { message: "Title must not exceed 200 characters." }),
  dek: z.string().max(400).optional(),
  excerpt: z.string().max(600).optional(),
  body: z.string().max(200_000).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  reportYear: z.coerce.number().int().min(2000).max(2100).optional(),
  authorId: z.uuid({ message: "Invalid author ID format." }).optional(),
  isFeatured: z.coerce.boolean().optional(),
  consentOnFile: z.coerce.boolean().optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(400).optional(),
  status: z
    .enum(PostStatusEnum.enumValues, { message: "Invalid post status." })
    .default("DRAFT"),
});

export const UpdatePostSchema = z.object({
  section: z
    .enum(PostSectionEnum.enumValues, { message: "Invalid post section." })
    .optional(),
  slug: SlugSchema.optional(),
  title: z
    .string()
    .min(3, { message: "Title must be at least 3 characters." })
    .max(200, { message: "Title must not exceed 200 characters." })
    .optional(),
  dek: z.string().max(400).optional(),
  excerpt: z.string().max(600).optional(),
  body: z.string().max(200_000).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  reportYear: z.coerce.number().int().min(2000).max(2100).optional(),
  authorId: z.uuid({ message: "Invalid author ID format." }).optional(),
  isFeatured: z.coerce.boolean().optional(),
  consentOnFile: z.coerce.boolean().optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(400).optional(),
  status: z
    .enum(PostStatusEnum.enumValues, { message: "Invalid post status." })
    .optional(),
});

/**
 * Cover images only — PDFs go through the document endpoint. Kept in step with
 * `AllowedMediaMimeTypes` in the multipart middleware, which filters first.
 */
export const UploadPostCoverSchema = z
  .object({
    size: z.number().positive({ message: "File size must be positive." }),
    mimeType: z.enum(["image/png", "image/jpeg"], {
      error: () => ({
        message: "Invalid file type. Only PNG or JPG are allowed.",
      }),
    }),
  })
  .refine((data) => data.size <= 15 * 1024 * 1024, {
    message: "Cover image cannot exceed 15MB.",
    path: ["size"],
  });

export const UploadPostDocumentSchema = z
  .object({
    size: z.number().positive({ message: "File size must be positive." }),
    mimeType: z.enum(["application/pdf"], {
      error: () => ({ message: "Annual reports must be a PDF." }),
    }),
  })
  .refine((data) => data.size <= 50 * 1024 * 1024, {
    message: "Report PDF cannot exceed 50MB.",
    path: ["size"],
  });
