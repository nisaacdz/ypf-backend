import { Paginated, YPFProject, YPFProjectDetail } from "@/shared/dtos";
import pgPool from "@/configs/db";
import { Projects, ProjectMedia } from "@/db/schema/activities";
import { Media, Chapters } from "@/db/schema/core";
import * as mediaUtils from "@/shared/utils/media";
import { eq, and, ilike, count } from "drizzle-orm";
import z from "zod";
import {
  GetProjectsQuerySchema,
  GetProjectMediaQuerySchema,
  CreateProjectSchema,
  UpdateProjectSchema,
} from "@/shared/validators/activities";
import { AppError } from "@/shared/types";

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
      featuredPhotoExternalId: Media.externalId,
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
    .leftJoin(Media, eq(ProjectMedia.mediumId, Media.id))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  // Transform to YPFProject with proper media URLs
  const items: YPFProject[] = projects.map((project) => ({
    id: project.id,
    title: project.title,
    abstract: project.abstract || undefined,
    scheduledStart: project.scheduledStart,
    scheduledEnd: project.scheduledEnd,
    status: project.status,
    featuredPhotoUrl: project.featuredPhotoExternalId
      ? mediaUtils.generateSignedMediaUrl(project.featuredPhotoExternalId, {
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
  const { page, pageSize } = query;

  const [itemsItems, total] = await Promise.all([
    pgPool.db
      .select({
        id: ProjectMedia.id,
        caption: ProjectMedia.caption,
        isFeatured: ProjectMedia.isFeatured,
        medium: {
          id: Media.id,
          externalId: Media.externalId,
          type: Media.type,
          width: Media.width,
          height: Media.height,
          sizeInBytes: Media.sizeInBytes,
          uploadedAt: Media.uploadedAt,
        },
      })
      .from(ProjectMedia)
      .innerJoin(Media, eq(ProjectMedia.mediumId, Media.id))
      .where(eq(ProjectMedia.projectId, projectId))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    pgPool.db
      .select({ count: count() })
      .from(ProjectMedia)
      .where(eq(ProjectMedia.projectId, projectId))
      .then((res) => res[0].count),
  ]);

  const items = itemsItems.map((m) => ({
    ...m,
    caption: m.caption || undefined,
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

  return {
    items,
    page,
    pageSize,
    total,
  };
}

export async function fetchProjectById(
  projectId: string,
): Promise<YPFProjectDetail> {
  // Fetch project with chapter info
  const [project] = await pgPool.db
    .select({
      id: Projects.id,
      title: Projects.title,
      abstract: Projects.abstract,
      description: Projects.description,
      scheduledStart: Projects.scheduledStart,
      scheduledEnd: Projects.scheduledEnd,
      status: Projects.status,
      chapterId: Chapters.id,
      chapterName: Chapters.name,
    })
    .from(Projects)
    .leftJoin(Chapters, eq(Projects.chapterId, Chapters.id))
    .where(eq(Projects.id, projectId));

  if (!project) {
    throw new AppError("Project not found", 404);
  }

  // Fetch featured media
  const featuredMedia = await pgPool.db
    .select({
      caption: ProjectMedia.caption,
      medium: {
        id: Media.id,
        externalId: Media.externalId,
        type: Media.type,
        width: Media.width,
        height: Media.height,
        sizeInBytes: Media.sizeInBytes,
        uploadedAt: Media.uploadedAt,
      },
    })
    .from(ProjectMedia)
    .innerJoin(Media, eq(ProjectMedia.mediumId, Media.id))
    .where(
      and(
        eq(ProjectMedia.projectId, projectId),
        eq(ProjectMedia.isFeatured, true),
      ),
    );

  return {
    id: project.id,
    title: project.title,
    abstract: project.abstract || undefined,
    description: project.description || undefined,
    scheduledStart: project.scheduledStart,
    scheduledEnd: project.scheduledEnd,
    status: project.status,
    featuredMedia: featuredMedia.length
      ? featuredMedia.map((fm) => ({
          caption: fm.caption || undefined,
          medium: {
            id: fm.medium.id,
            type: fm.medium.type,
            sizeInBytes: fm.medium.sizeInBytes,
            uploadedAt: fm.medium.uploadedAt,
            url: mediaUtils.generateSignedMediaUrl(fm.medium.externalId, {
              resolution: 720,
              expireSeconds: 60 * 60 * 24,
            }),
            dimensions: {
              width: fm.medium.width,
              height: fm.medium.height,
            },
          },
        }))
      : undefined,
    chapter:
      project.chapterId && project.chapterName
        ? {
            id: project.chapterId,
            name: project.chapterName,
          }
        : undefined,
  };
}

export async function createProject(
  data: z.infer<typeof CreateProjectSchema>,
): Promise<string> {
  const [project] = await pgPool.db
    .insert(Projects)
    .values(data)
    .returning({ id: Projects.id });

  if (!project) {
    throw new AppError("Failed to create project", 500);
  }

  return project.id;
}

export async function updateProject(
  projectId: string,
  data: z.infer<typeof UpdateProjectSchema>,
): Promise<void> {
  // Check if project exists
  const [existingProject] = await pgPool.db
    .select({ id: Projects.id })
    .from(Projects)
    .where(eq(Projects.id, projectId));

  if (!existingProject) {
    throw new AppError("Project not found", 404);
  }

  // Update project
  await pgPool.db.update(Projects).set(data).where(eq(Projects.id, projectId));
}

export async function updateProjectMedia(
  projectMediaId: number,
  data: { caption?: string; isFeatured?: boolean },
): Promise<void> {
  // Check if project media exists
  const [existingMedia] = await pgPool.db
    .select({ id: ProjectMedia.id })
    .from(ProjectMedia)
    .where(eq(ProjectMedia.id, projectMediaId));

  if (!existingMedia) {
    throw new AppError("Project media not found", 404);
  }

  // Update project media
  await pgPool.db
    .update(ProjectMedia)
    .set(data)
    .where(eq(ProjectMedia.id, projectMediaId));
}
