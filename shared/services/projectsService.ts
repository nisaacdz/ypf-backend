import { Paginated } from "@/shared/dtos";
import { YPFProject } from "@/shared/dtos";
import pgPool from "@/configs/db";
import { Projects, ProjectMedia } from "@/db/schema/activities";
import { Medium, Chapters } from "@/db/schema/core";
import { generateMediaUrl } from "@/shared/utils/media";
import { eq, and, ilike, count } from "drizzle-orm";
import z from "zod";
import { GetProjectsQuerySchema } from "@/shared/validators/activities";

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
      ? generateMediaUrl(project.featuredPhotoUrl)
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
