import z from "zod";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiResponse } from "@/shared/types";
import * as mediaUtils from "@/shared/utils/files";
import { eq, and, sql, desc, count } from "drizzle-orm";
import { GetPublicMediaQuerySchema } from "./schemas";

type PublicMediaParentKind = "PROJECT" | "EVENT" | "CHAPTER" | "COMMITTEE";

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
 * Plan §8.6 — public gallery union over Project/Event/Chapter/Committee media.
 *
 * Each branch produces the same shape via a tagged SELECT; the four are
 * UNION ALL-ed, ordered by uploaded_at desc, and paginated.
 */
async function fetchPublicMedia(
  query: z.infer<typeof GetPublicMediaQuerySchema>,
): Promise<{ items: PublicMediumItem[]; total: number }> {
  const { scope, type, chapterId, page, pageSize } = query;
  const offset = (page - 1) * pageSize;

  // Build per-source SELECTs as raw SQL fragments — Drizzle's UNION ALL helper
  // wants identically-shaped subqueries which is harder to express across four
  // different parent tables.
  const showProjects = scope === "all" || scope === "projects";
  const showEvents = scope === "all" || scope === "events";
  const showChapters = scope === "all" || scope === "chapters";
  const showCommittees = scope === "all" || scope === "committees";

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

  if (showChapters) {
    parts.push(sql`
      SELECT
        cm.id::text                              AS id,
        m.external_id                            AS external_id,
        cm.caption                               AS caption,
        m.type::text                             AS type,
        'CHAPTER'::text                          AS parent_kind,
        c.id::text                               AS parent_id,
        c.name                                   AS parent_title,
        NULL::text                               AS parent_category,
        m.uploaded_at                            AS uploaded_at
      FROM core.chapter_media cm
      INNER JOIN core.media m ON cm.medium_id = m.id
      INNER JOIN core.chapters c ON cm.chapter_id = c.id
      WHERE 1=1
      ${chapterId ? sql`AND c.id = ${chapterId}` : sql``}
    `);
  }

  if (showCommittees) {
    parts.push(sql`
      SELECT
        cmm.id::text                             AS id,
        m.external_id                            AS external_id,
        cmm.caption                              AS caption,
        m.type::text                             AS type,
        'COMMITTEE'::text                        AS parent_kind,
        com.id::text                             AS parent_id,
        com.name                                 AS parent_title,
        NULL::text                               AS parent_category,
        m.uploaded_at                            AS uploaded_at
      FROM core.committee_media cmm
      INNER JOIN core.media m ON cmm.medium_id = m.id
      INNER JOIN core.committees com ON cmm.committee_id = com.id
      WHERE 1=1
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

// keep the unused-import warnings quiet for symbols we may use later
void eq;
void and;
void desc;
void count;
