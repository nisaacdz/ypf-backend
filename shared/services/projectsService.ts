import { Paginated } from "@/shared/dtos";
import { YPFProject } from "@/shared/dtos";
import pgPool from "@/configs/db";
import { Projects, ProjectMedia } from "@/db/schema/activities";
import { Medium, Chapters } from "@/db/schema/core";
import * as mediaUtils from "@/shared/utils/media";
import { eq, and, ilike, count, sql } from "drizzle-orm";
import z from "zod";
import { GetProjectsQuerySchema, GetProjectMediaQuerySchema } from "@/shared/validators/activities";

export async function fetchProjects(
  query: z.infer<typeof GetProjectsQuerySchema>,
): Promise<Paginated<YPFProject>> {
  const { page, pageSize, search, filterStatus } = query;
  const offset = (page - 1) * pageSize;

  // Build where conditions
  const conditions = [];

  if (search) {
    conditions.push(ilike(Projects.title, `%${search}%`));
  }

  if (filterStatus) {
    conditions.push(eq(Projects.status, filterStatus));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch total count
  const [{ total }] = await pgPool.db
    .select({ total: count() })
    .from(Projects)
    .where(whereClause);

  // Fetch paginated projects with featured media and chapter info
  const projects = await pgPool.db
    .select({
      id: Projects.id,
      title: Projects.title,
      abstract: Projects.abstract,
      scheduledStart: Projects.scheduledStart,
      scheduledEnd: Projects.scheduledEnd,
      status: Projects.status,
      featuredPhotoUrl: Medium.externalId,
      chapterName: Chapters.name,
    })
    .from(Projects)
    .leftJoin(Chapters, eq(Projects.chapterId, Chapters.id))
    .leftJoin(
      ProjectMedia,
      and(
        eq(Projects.id, ProjectMedia.projectId),
        eq(ProjectMedia.isFeatured, true),
      ),
    )
    .leftJoin(Medium, eq(ProjectMedia.mediumId, Medium.id))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  // Transform to YPFProject with proper media URLs
  const items: YPFProject[] = projects.map((project) => ({
    id: project.id,
    title: project.title,
    abstract: project.abstract || undefined,
    scheduledStart: project.scheduledStart.toISOString(),
    scheduledEnd: project.scheduledEnd.toISOString(),
    status: project.status,
    featuredPhotoUrl: project.featuredPhotoUrl
      ? mediaUtils.generateSignedMediaUrl(project.featuredPhotoUrl, {
          resolution: 720,
          expireSeconds: 60 * 60 * 24,
        })
      : undefined,
    chapterName: project.chapterName || undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

export async function fetchProjectMedia(
  projectId: string,
  query: z.infer<typeof GetProjectMediaQuerySchema>,
) {
  const { page, pageSize, mediaType } = query;
  const offset = (page - 1) * pageSize;

  // Use raw SQL for UNION query with proper database-level pagination
  const mediaTypeCondition = mediaType ? sql`AND m.type = ${mediaType}` : sql``;
  
  // Count total records
  const totalQuery = sql`
    SELECT COUNT(*) as total FROM (
      SELECT pm.id
      FROM activities.project_media pm
      INNER JOIN core.media m ON pm.medium_id = m.id
      WHERE pm.project_id = ${projectId} ${mediaTypeCondition}
      
      UNION ALL
      
      SELECT em.id
      FROM activities.event_media em
      INNER JOIN activities.events e ON em.event_id = e.id
      INNER JOIN core.media m ON em.medium_id = m.id
      WHERE e.project_id = ${projectId} ${mediaTypeCondition}
    ) AS combined
  `;

  const [{ total }] = await pgPool.db.execute<{ total: number }>(totalQuery);

  // Fetch paginated records
  const itemsQuery = sql`
    SELECT 
      combined.id,
      combined.caption,
      combined.is_featured,
      combined.medium_id,
      combined.external_id,
      combined.type,
      combined.width,
      combined.height,
      combined.size_in_bytes,
      combined.uploaded_at
    FROM (
      SELECT 
        CAST(pm.id AS TEXT) as id,
        pm.caption,
        pm.is_featured,
        m.id as medium_id,
        m.external_id,
        m.type,
        m.width,
        m.height,
        m.size_in_bytes as size_in_bytes,
        m.uploaded_at
      FROM activities.project_media pm
      INNER JOIN core.media m ON pm.medium_id = m.id
      WHERE pm.project_id = ${projectId} ${mediaTypeCondition}
      
      UNION ALL
      
      SELECT 
        CAST(em.id AS TEXT) as id,
        em.caption,
        false as is_featured,
        m.id as medium_id,
        m.external_id,
        m.type,
        m.width,
        m.height,
        m.size_in_bytes as size_in_bytes,
        m.uploaded_at
      FROM activities.event_media em
      INNER JOIN activities.events e ON em.event_id = e.id
      INNER JOIN core.media m ON em.medium_id = m.id
      WHERE e.project_id = ${projectId} ${mediaTypeCondition}
    ) AS combined
    ORDER BY combined.uploaded_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const itemsItems = await pgPool.db.execute<{
    id: string;
    caption: string | null;
    is_featured: boolean;
    medium_id: string;
    external_id: string;
    type: string;
    width: number;
    height: number;
    size_in_bytes: number;
    uploaded_at: Date;
  }>(itemsQuery);

  const items = itemsItems.map((m) => ({
    id: m.id,
    caption: m.caption || undefined,
    isFeatured: m.is_featured,
    medium: {
      id: m.medium_id,
      type: m.type as "PICTURE" | "VIDEO",
      sizeInBytes: m.size_in_bytes,
      uploadedAt: m.uploaded_at,
      url: mediaUtils.generateSignedMediaUrl(m.external_id, {
        resolution: 480,
        expireSeconds: 60 * 60 * 24,
      }),
      dimensions: {
        width: m.width,
        height: m.height,
      },
    },
  }));

  return { items, total };
}
