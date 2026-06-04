import z from "zod";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError, ApiResponse } from "@/shared/types";
import * as mediaUtils from "@/shared/utils/files";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { GetPublicMediaQuerySchema } from "./schemas";

type GalleryKind = "projects" | "events";

type PublicMediaParentKind = "PROJECT" | "EVENT";

export type PublicMediumItem = {
  id: string;
  url: string;
  caption: string | null;
  type: "PICTURE" | "VIDEO";
  parent: {
    kind: PublicMediaParentKind;
    id: string;
    title: string;
    category?: string;
  };
  uploadedAt: Date;
};

/**
 * Public gallery union over Project and Event media.
 *
 * Chapter and committee galleries are intentionally excluded: every image on
 * the public site is project- or event-anchored so the gallery can be sliced
 * by activity type (Advocacy / Mentorship / etc) rather than ownership.
 * Internal Chapter/Committee galleries still exist on their own endpoints.
 */
async function fetchPublicMedia(
  query: z.infer<typeof GetPublicMediaQuerySchema>,
): Promise<{ items: PublicMediumItem[]; total: number }> {
  const { scope, type, chapterId, page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  const showProjects = scope === "all" || scope === "projects";
  const showEvents = scope === "all" || scope === "events";

  const parts: ReturnType<typeof sql>[] = [];

  if (showProjects) {
    parts.push(sql`
      SELECT
        pm.id::text                              AS id,
        m.external_id                            AS external_id,
        pm.caption                               AS caption,
        m.type::text                             AS type,
        'PROJECT'::text                          AS parent_kind,
        p.id::text                               AS parent_id,
        p.title                                  AS parent_title,
        p.type::text                             AS parent_category,
        m.uploaded_at                            AS uploaded_at
      FROM activities.project_media pm
      INNER JOIN core.media m ON pm.medium_id = m.id
      INNER JOIN activities.projects p ON pm.project_id = p.id
      WHERE 1=1
      ${type ? sql`AND p.type::text = ${type}` : sql``}
      ${chapterId ? sql`AND p.chapter_id = ${chapterId}` : sql``}
    `);
  }

  if (showEvents) {
    parts.push(sql`
      SELECT
        em.id::text                              AS id,
        m.external_id                            AS external_id,
        em.caption                               AS caption,
        m.type::text                             AS type,
        'EVENT'::text                            AS parent_kind,
        e.id::text                               AS parent_id,
        e.name                                   AS parent_title,
        e.type::text                             AS parent_category,
        m.uploaded_at                            AS uploaded_at
      FROM activities.event_media em
      INNER JOIN core.media m ON em.medium_id = m.id
      INNER JOIN activities.events e ON em.event_id = e.id
      WHERE 1=1
      ${type ? sql`AND e.type::text = ${type}` : sql``}
      ${chapterId ? sql`AND e.chapter_id = ${chapterId}` : sql``}
    `);
  }

  if (parts.length === 0) {
    return { items: [], total: 0 };
  }

  // Join the parts with UNION ALL.
  let unioned = parts[0];
  for (let i = 1; i < parts.length; i++) {
    unioned = sql`${unioned} UNION ALL ${parts[i]}`;
  }

  const itemsQuery = sql`
    SELECT * FROM (${unioned}) AS u
    ORDER BY u.uploaded_at DESC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;

  const countQuery = sql`SELECT count(*)::int AS n FROM (${unioned}) AS u`;

  const [itemsResult, countResult] = await Promise.all([
    dbClient.db.execute(itemsQuery),
    dbClient.db.execute(countQuery),
  ]);

  type Row = {
    id: string;
    external_id: string;
    caption: string | null;
    type: string;
    parent_kind: PublicMediaParentKind;
    parent_id: string;
    parent_title: string;
    parent_category: string | null;
    uploaded_at: Date;
  };

  const rows = itemsResult as unknown as Row[];
  const totalRow = countResult as unknown as Array<{ n: number }>;

  const items: PublicMediumItem[] = rows.map((r) => ({
    id: r.id,
    url: mediaUtils.generateSignedMediaUrl(r.external_id, {
      resolution: 1080,
      expireSeconds: 60 * 60 * 24,
    }),
    caption: r.caption,
    type: (r.type as "PICTURE" | "VIDEO") ?? "PICTURE",
    parent: {
      kind: r.parent_kind,
      id: r.parent_id,
      title: r.parent_title,
      category: r.parent_category ?? undefined,
    },
    uploadedAt: r.uploaded_at,
  }));

  return { items, total: Number(totalRow[0]?.n ?? 0) };
}

export async function getPublicMedia(
  query: z.infer<typeof GetPublicMediaQuerySchema>,
): Promise<
  ApiResponse<{
    items: PublicMediumItem[];
    page: number;
    pageSize: number;
    total: number;
  }>
> {
  const { items, total } = await fetchPublicMedia(query);
  return {
    success: true,
    message: "Media fetched successfully",
    data: {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  };
}

/**
 * Gallery media management — operates directly on the junction-row id that
 * `/media/public` returns (project_media.id or event_media.id), so the UMS
 * gallery can update/delete an image without first resolving its parent.
 */
export async function updateGalleryMedium(
  kind: GalleryKind,
  junctionId: string,
  data: { caption?: string; isFeatured?: boolean },
): Promise<ApiResponse<null>> {
  if (kind === "projects") {
    // When marking featured, clear any other featured image on the same project.
    if (data.isFeatured) {
      const [row] = await dbClient.db
        .select({ projectId: schema.ProjectMedia.projectId })
        .from(schema.ProjectMedia)
        .where(eq(schema.ProjectMedia.id, junctionId));
      if (row?.projectId) {
        await dbClient.db
          .update(schema.ProjectMedia)
          .set({ isFeatured: false })
          .where(eq(schema.ProjectMedia.projectId, row.projectId));
      }
    }
    const [updated] = await dbClient.db
      .update(schema.ProjectMedia)
      .set(data)
      .where(eq(schema.ProjectMedia.id, junctionId))
      .returning({ id: schema.ProjectMedia.id });
    if (!updated) throw new ApiError("Gallery image not found", 404);
  } else {
    if (data.isFeatured) {
      const [row] = await dbClient.db
        .select({ eventId: schema.EventMedia.eventId })
        .from(schema.EventMedia)
        .where(eq(schema.EventMedia.id, junctionId));
      if (row?.eventId) {
        await dbClient.db
          .update(schema.EventMedia)
          .set({ isFeatured: false })
          .where(eq(schema.EventMedia.eventId, row.eventId));
      }
    }
    const [updated] = await dbClient.db
      .update(schema.EventMedia)
      .set(data)
      .where(eq(schema.EventMedia.id, junctionId))
      .returning({ id: schema.EventMedia.id });
    if (!updated) throw new ApiError("Gallery image not found", 404);
  }

  return { success: true, message: "Gallery image updated", data: null };
}

export async function deleteGalleryMedium(
  kind: GalleryKind,
  junctionId: string,
): Promise<ApiResponse<null>> {
  // Resolve the underlying Media row so we can drop both the DB row and the file.
  let mediumId: string | null = null;
  let externalId: string | null = null;

  if (kind === "projects") {
    const [row] = await dbClient.db
      .select({ mediumId: schema.ProjectMedia.mediumId, externalId: schema.Media.externalId })
      .from(schema.ProjectMedia)
      .innerJoin(schema.Media, eq(schema.ProjectMedia.mediumId, schema.Media.id))
      .where(eq(schema.ProjectMedia.id, junctionId));
    mediumId = row?.mediumId ?? null;
    externalId = row?.externalId ?? null;
  } else {
    const [row] = await dbClient.db
      .select({ mediumId: schema.EventMedia.mediumId, externalId: schema.Media.externalId })
      .from(schema.EventMedia)
      .innerJoin(schema.Media, eq(schema.EventMedia.mediumId, schema.Media.id))
      .where(eq(schema.EventMedia.id, junctionId));
    mediumId = row?.mediumId ?? null;
    externalId = row?.externalId ?? null;
  }

  if (!mediumId) throw new ApiError("Gallery image not found", 404);

  // Deleting the Media row cascades the junction row (FK onDelete: cascade).
  await dbClient.db.delete(schema.Media).where(eq(schema.Media.id, mediumId));

  // Best-effort file cleanup — don't fail the request if storage delete errors.
  if (externalId) {
    await mediaUtils.deleteMediumFile(externalId).catch(() => {});
  }

  return { success: true, message: "Gallery image deleted", data: null };
}

// keep the unused-import warnings quiet for symbols we may use later
void eq;
void and;
void desc;
void count;
