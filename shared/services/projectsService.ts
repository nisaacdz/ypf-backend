import { Paginated } from "@/shared/dtos";
import { YPFProject, YPFProjectDetail } from "@/features/api/v1/projects/dtos";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { Projects, ProjectMedia } from "@/db/schema/activities";
import { Media, Chapters } from "@/db/schema/core";
import * as mediaUtils from "@/shared/utils/files";
import { eq, and, ilike, count, desc } from "drizzle-orm";
import z from "zod";
import {
  GetProjectsQuerySchema,
  GetProjectMediaQuerySchema,
  CreateProjectSchema,
  UpdateProjectSchema,
} from "@/features/api/v1/projects/schemas";
import { ApiError } from "@/shared/types";
import { YPFEvent } from "@/features/api/v1/events/dtos";

export async function fetchProjects(
  query: z.infer<typeof GetProjectsQuerySchema>,
): Promise<Paginated<YPFProject>> {
  const { page, pageSize, search, filterStatus, chapterId } = query;
  const offset = (page - 1) * pageSize;

  // Build where conditions
  const conditions = [];

  if (search) {
    conditions.push(ilike(Projects.title, `%${search}%`));
  }

  if (filterStatus) {
    conditions.push(eq(Projects.status, filterStatus));
  }

  if (chapterId) {
    conditions.push(eq(Projects.chapterId, chapterId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [projects, total] = await Promise.all([
    dbClient.db
      .select({
        id: Projects.id,
        publicId: Projects.publicId,
        title: Projects.title,
        abstract: Projects.abstract,
        type: Projects.type,
        category: Projects.category,
        scheduledStart: Projects.scheduledStart,
        scheduledEnd: Projects.scheduledEnd,
        status: Projects.status,
        featuredMediumExternalId: Media.externalId,
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
      .offset(offset)
      .groupBy(
        Projects.id,
        Projects.publicId,
        Projects.title,
        Projects.abstract,
        Projects.type,
        Projects.category,
        Projects.scheduledStart,
        Projects.scheduledEnd,
        Projects.status,
        Media.externalId,
        Chapters.name,
        Chapters.id,
      ),
    dbClient.db
      .select({ total: count() })
      .from(Projects)
      .where(whereClause)
      .then((res) => res[0].total),
  ]);

  const items: YPFProject[] = projects.map((project) => ({
    id: project.id,
    publicId: project.publicId,
    title: project.title,
    type: project.type,
    category: project.category || undefined,
    scheduledStart: project.scheduledStart,
    scheduledEnd: project.scheduledEnd,
    status: project.status,
    featuredMediumUrl: project.featuredMediumExternalId
      ? mediaUtils.generateSignedMediaUrl(project.featuredMediumExternalId, {
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
    dbClient.db
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
          size: Media.size,
          uploadedAt: Media.uploadedAt,
        },
      })
      .from(ProjectMedia)
      .innerJoin(Media, eq(ProjectMedia.mediumId, Media.id))
      .where(eq(ProjectMedia.projectId, projectId))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbClient.db
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
      size: m.medium.size,
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
  const [ypfProject] = await dbClient.db
    .select({
      id: Projects.id,
      publicId: Projects.publicId,
      title: Projects.title,
      type: Projects.type,
      category: Projects.category,
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

  if (!ypfProject) {
    throw new ApiError("Project not found", 404);
  }

  const featuredMedia = await dbClient.db
    .select({
      caption: ProjectMedia.caption,
      medium: {
        id: Media.id,
        externalId: Media.externalId,
        type: Media.type,
        width: Media.width,
        height: Media.height,
        size: Media.size,
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
    id: ypfProject.id,
    publicId: ypfProject.publicId,
    title: ypfProject.title,
    type: ypfProject.type,
    category: ypfProject.category || undefined,
    abstract: ypfProject.abstract || undefined,
    description: ypfProject.description || undefined,
    scheduledStart: ypfProject.scheduledStart,
    scheduledEnd: ypfProject.scheduledEnd,
    status: ypfProject.status,
    featuredMedia: featuredMedia.length
      ? featuredMedia.map((fm) => ({
          caption: fm.caption || undefined,
          medium: {
            id: fm.medium.id,
            type: fm.medium.type,
            size: fm.medium.size,
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
      ypfProject.chapterId && ypfProject.chapterName
        ? {
            id: ypfProject.chapterId,
            name: ypfProject.chapterName,
          }
        : undefined,
  };
}

function generatePublicId(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createProject(
  data: z.infer<typeof CreateProjectSchema>,
): Promise<string> {
  const publicId = generatePublicId(data.title);

  const [project] = await dbClient.db
    .insert(Projects)
    .values({
      ...data,
      publicId,
    })
    .returning({ id: Projects.id });

  if (!project) {
    throw new ApiError("Failed to create project", 500);
  }

  return project.id;
}

export async function updateProject(
  projectId: string,
  data: z.infer<typeof UpdateProjectSchema>,
): Promise<void> {
  const [updatedProject] = await dbClient.db
    .update(Projects)
    .set(data)
    .where(eq(Projects.id, projectId))
    .returning({ id: Projects.id });

  if (!updatedProject) {
    throw new ApiError("Project not found", 404);
  }
}

export async function updateProjectMedium(
  projectMediumId: string,
  data: { caption?: string; isFeatured?: boolean },
): Promise<void> {
  const [updatedData] = await dbClient.db
    .update(ProjectMedia)
    .set(data)
    .where(eq(ProjectMedia.id, projectMediumId))
    .returning({ id: ProjectMedia.id });

  if (!updatedData) {
    throw new ApiError("Project medium not found", 404);
  }
}

export async function fetchProjectEvents(
  projectId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<Paginated<YPFEvent>> {
  const { page = 1, pageSize = 10 } = query;
  const offset = (page - 1) * pageSize;

  const [events, [{ total }]] = await Promise.all([
    dbClient.db
      .select({
        id: schema.Events.id,
        name: schema.Events.name,
        scheduledStart: schema.Events.scheduledStart,
        scheduledEnd: schema.Events.scheduledEnd,
        location: schema.Events.location,
        type: schema.Events.type,
        status: schema.Events.status,
        featuredMediumExternalId: schema.Media.externalId,
      })
      .from(schema.Events)
      .leftJoin(
        schema.EventMedia,
        and(
          eq(schema.Events.id, schema.EventMedia.eventId),
          eq(schema.EventMedia.isFeatured, true),
        ),
      )
      .leftJoin(schema.Media, eq(schema.EventMedia.mediumId, schema.Media.id))
      .where(eq(schema.Events.projectId, projectId))
      .orderBy(desc(schema.Events.scheduledStart))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ total: count() })
      .from(schema.Events)
      .where(eq(schema.Events.projectId, projectId)),
  ]);

  const items: YPFEvent[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    scheduledStart: event.scheduledStart,
    scheduledEnd: event.scheduledEnd,
    location: event.location || undefined,
    type: event.type,
    status: event.status,
    featuredMediumUrl: event.featuredMediumExternalId
      ? mediaUtils.generateSignedMediaUrl(event.featuredMediumExternalId, {
          resolution: 720,
          expireSeconds: 60 * 60 * 24,
        })
      : undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}
