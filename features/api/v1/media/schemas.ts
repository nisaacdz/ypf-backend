import z from "zod";

export const GetPublicMediaQuerySchema = z.object({
  // The public Gallery is project + event driven only. Chapter/committee
  // galleries continue to exist internally but never surface here.
  scope: z.enum(["projects", "events", "all"]).default("all"),
  // Parent-entity type filter (project type or event type). Loose string so
  // the same param works across both project + event media sources.
  // Accepted values match the DB enums:
  //   Project: WELFARE | COMMUNITY | ADVOCACY | OTHER
  //   Event:   MENTORSHIP | WORKSHOP | CHILDCARE | NETWORKING | STREETCARE
  type: z.string().trim().min(1).max(80).optional(),
  chapterId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  // Up to 200 so the UMS admin gallery can load a generous browse window in
  // one request. Public callers can stay at the default 24.
  pageSize: z.coerce.number().int().min(1).max(200).default(24),
});

// Gallery management — operate on the junction-row id `/media/public` returns.
export const GalleryMediumParamsSchema = z.object({
  kind: z.enum(["projects", "events"]),
  id: z.uuid({ message: "Invalid media id" }),
});

export const UpdateGalleryMediumSchema = z.object({
  caption: z.string().max(255).optional(),
  isFeatured: z.coerce.boolean().optional(),
});
