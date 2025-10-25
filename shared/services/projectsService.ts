import { Paginated } from "@/shared/dtos";
import { YPFProject } from "@/shared/dtos";
import pgPool from "@/configs/db";
import { Projects, ProjectMedia, Events, EventMedia } from "@/db/schema/activities";
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

  // Build queries with conditions
  const finalProjectMediaQuery = pgPool.db
    .select({
      id: ProjectMedia.id,
      caption: ProjectMedia.caption,
      isFeatured: ProjectMedia.isFeatured,
      medium: {
        id: Medium.id,
        externalId: Medium.externalId,
        type: Medium.type,
        width: Medium.width,
        height: Medium.height,
        sizeInBytes: Medium.sizeInBytes,
        uploadedAt: Medium.uploadedAt,
      },
    })
    .from(ProjectMedia)
    .innerJoin(Medium, eq(ProjectMedia.mediumId, Medium.id))
    .where(
      mediaType
        ? and(eq(ProjectMedia.projectId, projectId), eq(Medium.type, mediaType))
        : eq(ProjectMedia.projectId, projectId),
    );

  const finalEventMediaQuery = pgPool.db
    .select({
      id: EventMedia.id,
      caption: EventMedia.caption,
      isFeatured: sql<boolean>`false`,
      medium: {
        id: Medium.id,
        externalId: Medium.externalId,
        type: Medium.type,
        width: Medium.width,
        height: Medium.height,
        sizeInBytes: Medium.sizeInBytes,
        uploadedAt: Medium.uploadedAt,
      },
    })
    .from(EventMedia)
    .innerJoin(Events, eq(EventMedia.eventId, Events.id))
    .innerJoin(Medium, eq(EventMedia.mediumId, Medium.id))
    .where(
      mediaType
        ? and(eq(Events.projectId, projectId), eq(Medium.type, mediaType))
        : eq(Events.projectId, projectId),
    );

  // Fetch both in parallel
  const [projectMediaItems, eventMediaItems] = await Promise.all([
    finalProjectMediaQuery,
    finalEventMediaQuery,
  ]);

  // Combine results
  const allMedia = [
    ...projectMediaItems.map((m) => ({
      id: `p-${m.id}`,
      caption: m.caption,
      isFeatured: m.isFeatured,
      medium: m.medium,
    })),
    ...eventMediaItems.map((m) => ({
      id: `e-${m.id}`,
      caption: m.caption,
      isFeatured: m.isFeatured,
      medium: m.medium,
    })),
  ];

  const total = allMedia.length;

  // Apply pagination
  const paginatedMedia = allMedia.slice(offset, offset + pageSize);

  const items = paginatedMedia.map((m) => ({
    id: m.id,
    caption: m.caption || undefined,
    isFeatured: m.isFeatured,
    medium: {
      id: m.medium.id,
      type: m.medium.type,
      sizeInBytes: m.medium.sizeInBytes,
      uploadedAt: m.medium.uploadedAt,
      url: mediaUtils.generateSignedMediaUrl(m.medium.externalId, {
        resolution: 480,
        expireSeconds: 60 * 60 * 24,
      }),
      dimensions: {
        width: m.medium.width,
        height: m.medium.height,
      },
    },
  }));

  return { items, total };
}
