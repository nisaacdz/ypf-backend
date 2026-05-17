import z from "zod";

export const GetPublicMediaQuerySchema = z.object({
  scope: z
    .enum(["projects", "events", "chapters", "committees", "all"])
    .default("all"),
  // Parent-entity type filter (project type or event type). Loose string so
  // the same param works across the four media sources.
  type: z.string().trim().min(1).max(80).optional(),
  chapterId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
