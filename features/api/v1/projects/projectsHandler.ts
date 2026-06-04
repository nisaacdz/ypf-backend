import { ApiError, ApiResponse } from "@/shared/types";
import {
  GetProjectsQuerySchema,
  GetProjectMediaQuerySchema,
  GetProjectEnrollmentsQuerySchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  UpdateProjectMediumSchema,
  GuestProjectRegistrationSchema,
} from "./schemas";
import z from "zod";
import { Paginated } from "@/shared/dtos";
import { YPFProject, YPFProjectDetail, YPFProjectMedium } from "./dtos";
import * as projectsService from "@/shared/services/projectsService";
import * as mediaUtils from "@/shared/utils/files";
import * as mediaService from "@/shared/services/mediaService";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { eq, count, sql } from "drizzle-orm";
import { Projects, ProjectMedia, ProjectEnrollments } from "@/db/schema/activities";

export async function getProjects(
  query: z.infer<typeof GetProjectsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFProject>>> {
  const data = await projectsService.fetchProjects(query);

  return {
    success: true,
    message: "Projects fetched successfully",
    data,
  };
}

export async function getProjectMedia(
  projectId: string,
  query: z.infer<typeof GetProjectMediaQuerySchema>,
): Promise<ApiResponse<Paginated<YPFProjectMedium>>> {
  const { page, pageSize } = query;
  const { items, total } = await projectsService.fetchProjectMedia(
    projectId,
    query,
  );
  return {
    success: true,
    message: "Project media fetched successfully",
    data: {
      items,
      page,
      pageSize,
      total,
    },
  };
}

export async function uploadProjectMedium({
  constituentId,
  projectId,
  file,
  options,
}: {
  constituentId: string;
  projectId: string;
  file: Express.Multer.File;
  options: { caption?: string; isFeatured: boolean };
}): Promise<ApiResponse<string>> {
  const uploadMeta = await mediaUtils.storeMediumFile(file);

  try {
    const newMediumId = await mediaService.uploadProjectMedium(projectId, {
      caption: options.caption,
      isFeatured: options.isFeatured,
      medium: {
        ...uploadMeta,
        uploadedBy: constituentId,
      },
    });

    return {
      success: true,
      message: "Media uploaded successfully",
      data: newMediumId,
    };
  } catch (error) {
    await mediaUtils.deleteMediumFile(uploadMeta.externalId);
    throw error;
  }
}

export async function getProject(
  projectId: string,
): Promise<ApiResponse<YPFProjectDetail>> {
  const data = await projectsService.fetchProjectById(projectId);

  return {
    success: true,
    message: "Project fetched successfully",
    data,
  };
}

export async function createProject(
  newProject: z.infer<typeof CreateProjectSchema>,
): Promise<ApiResponse<string>> {
  const projectId = await projectsService.createProject(newProject);

  return {
    success: true,
    message: "Project created successfully",
    data: projectId,
  };
}

export async function updateProject(
  projectId: string,
  updates: z.infer<typeof UpdateProjectSchema>,
): Promise<ApiResponse<null>> {
  await projectsService.updateProject(projectId, updates);

  return {
    success: true,
    message: "Project updated successfully",
    data: null,
  };
}

export async function deleteProject(
  projectId: string,
): Promise<ApiResponse<null>> {
  await projectsService.deleteProject(projectId);

  return {
    success: true,
    message: "Project deleted successfully",
    data: null,
  };
}

export async function updateProjectMedium(
  projectId: string,
  mediumId: string,
  updates: z.infer<typeof UpdateProjectMediumSchema>,
): Promise<ApiResponse<null>> {
  await projectsService.updateProjectMedium(projectId, mediumId, updates);

  return {
    success: true,
    message: "Project medium updated successfully",
    data: null,
  };
}

/**
 * Plan §8.1 — public guest project registration. Inserts into
 * project_enrollments with constituent_id NULL and the rich payload in
 * guest_profile JSONB. Project must be UPCOMING or ONGOING.
 */
export async function registerGuestForProject(
  projectId: string,
  body: z.infer<typeof GuestProjectRegistrationSchema>,
): Promise<ApiResponse<{ id: string; projectId: string }>> {
  const project = await dbClient.db.query.Projects.findFirst({
    where: eq(schema.Projects.id, projectId),
    columns: { id: true, status: true, title: true },
  });

  if (!project) {
    throw new ApiError("Project not found", 404);
  }
  if (project.status !== "UPCOMING" && project.status !== "ONGOING") {
    throw new ApiError("This project is no longer accepting registrations", 400);
  }

  const [enrollment] = await dbClient.db
    .insert(schema.ProjectEnrollments)
    .values({
      projectId,
      constituentId: null,
      guestName: `${body.firstName} ${body.lastName}`.trim(),
      guestEmail: body.email,
      guestPhone: body.phone,
      guestProfile: {
        ...body.guestProfile,
        consents: body.consents,
      },
    })
    .returning({ id: schema.ProjectEnrollments.id });

  // TODO: queue confirmation + admin notification emails via pg-boss. For now
  // the row persists and admin can see it in UMS — emails come in a follow-up.

  return {
    success: true,
    message: "Registration received",
    data: { id: enrollment.id, projectId },
  };
}

export async function getProjectEvents(
  projectId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<
  ApiResponse<Paginated<import("@/features/api/v1/events/dtos").YPFEvent>>
> {
  const data = await projectsService.fetchProjectEvents(projectId, query);

  return {
    success: true,
    message: "Project events fetched successfully",
    data,
  };
}

// Audit I6 — admin roster.
export async function getProjectEnrollments(
  projectId: string,
  query: z.infer<typeof GetProjectEnrollmentsQuerySchema>,
): Promise<ApiResponse<Paginated<projectsService.ProjectEnrollmentRow>>> {
  const data = await projectsService.fetchProjectEnrollments(projectId, query);
  return {
    success: true,
    message: "Project enrollments fetched successfully",
    data,
  };
}

type DedupeResult = {
  kept: { id: string; title: string };
  deleted: { id: string; media: number; enrollments: number }[];
};

export async function checkDuplicateProjects(): Promise<
  ApiResponse<{
    totalProjects: number;
    duplicateGroups: { key: string; count: number; ids: string[] }[];
  }>
> {
  // Use DB-native lower() so hidden unicode/whitespace differences are handled
  // the same way PostgreSQL handles them — no JS normalisation needed.
  const rawGroups = (await dbClient.db.execute(sql`
    SELECT
      lower(trim(title))          AS key,
      string_agg(id::text, ',')   AS ids,
      count(*)::int               AS cnt
    FROM activities.projects
    GROUP BY lower(trim(title))
    HAVING count(*) > 1
  `)) as unknown as Array<{ key: string; ids: string; cnt: number }>;

  const [[{ total }]] = await Promise.all([
    dbClient.db.select({ total: count() }).from(Projects),
  ]);

  const duplicateGroups = rawGroups.map((r) => ({
    key: r.key,
    count: r.cnt,
    ids: r.ids.split(","),
  }));

  return {
    success: true,
    message: `Found ${duplicateGroups.length} duplicate group(s) out of ${total} total projects.`,
    data: { totalProjects: Number(total), duplicateGroups },
  };
}

export async function deduplicateProjects(): Promise<
  ApiResponse<{ groups: DedupeResult[]; totalDeleted: number }>
> {
  // Group by lower(trim(title)) in the database — immune to JS normalisation quirks
  const rawGroups = (await dbClient.db.execute(sql`
    SELECT
      lower(trim(title))          AS key,
      string_agg(id::text, ',')   AS ids,
      count(*)::int               AS cnt
    FROM activities.projects
    GROUP BY lower(trim(title))
    HAVING count(*) > 1
  `)) as unknown as Array<{ key: string; ids: string; cnt: number }>;

  const results: DedupeResult[] = [];
  let totalDeleted = 0;

  for (const row of rawGroups) {
    const ids = row.ids.split(",");

    const stats = await Promise.all(
      ids.map(async (id) => {
        const [[mediaRow], [enrollRow], [proj]] = await Promise.all([
          dbClient.db
            .select({ n: count() })
            .from(ProjectMedia)
            .where(eq(ProjectMedia.projectId, id)),
          dbClient.db
            .select({ n: count() })
            .from(ProjectEnrollments)
            .where(eq(ProjectEnrollments.projectId, id)),
          dbClient.db
            .select({ title: Projects.title })
            .from(Projects)
            .where(eq(Projects.id, id)),
        ]);
        return {
          id,
          title: proj?.title ?? row.key,
          media: Number(mediaRow?.n ?? 0),
          enrollments: Number(enrollRow?.n ?? 0),
        };
      }),
    );

    // Keep the project with the most data; ties → first UUID alphabetically
    const sorted = [...stats].sort((a, b) => {
      if (b.media !== a.media) return b.media - a.media;
      if (b.enrollments !== a.enrollments) return b.enrollments - a.enrollments;
      return a.id.localeCompare(b.id);
    });

    const keep = sorted[0];
    const toDelete = sorted.slice(1);

    for (const d of toDelete) {
      await dbClient.db.delete(Projects).where(eq(Projects.id, d.id));
      totalDeleted++;
    }

    results.push({
      kept: { id: keep.id, title: keep.title },
      deleted: toDelete.map((d) => ({
        id: d.id,
        media: d.media,
        enrollments: d.enrollments,
      })),
    });
  }

  return {
    success: true,
    message:
      totalDeleted === 0
        ? "No duplicates found."
        : `Deduplication complete. ${totalDeleted} duplicate(s) removed across ${results.length} group(s).`,
    data: { groups: results, totalDeleted },
  };
}
