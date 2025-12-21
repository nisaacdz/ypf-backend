import { eq, and, desc, sql, isNull, or, gte, lte } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";
import { PartnershipType } from "../utils";
import { UpdatePartnershipSchema } from "@/features/api/v1/partnerships/schemas";
import { z } from "zod";

type PartnershipFilters = {
  page: number;
  pageSize: number;
  partnershipType?: string;
  projectId?: string;
  eventId?: string;
  organizationId?: string;
  isActive?: boolean;
};

type CreatePartnershipInput = {
  organizationId: string;
  partnershipType: PartnershipType;
  projectId?: string;
  eventId?: string;
  startedAt: Date;
  endedAt?: Date;
  value?: string;
  metadata?: string;
  contractDocumentId?: string;
};

/**
 * Get paginated list of partnerships with optional filters
 */
export async function getPartnerships(filters: PartnershipFilters) {
  const {
    page,
    pageSize,
    partnershipType,
    projectId,
    eventId,
    organizationId,
    isActive,
  } = filters;
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions = [];

  if (partnershipType) {
    conditions.push(
      eq(schema.Partnerships.partnershipType, partnershipType as any),
    );
  }

  if (projectId) {
    conditions.push(eq(schema.Partnerships.projectId, projectId));
  }

  if (eventId) {
    conditions.push(eq(schema.Partnerships.eventId, eventId));
  }

  if (organizationId) {
    conditions.push(eq(schema.Partnerships.organizationId, organizationId));
  }

  if (isActive !== undefined) {
    const now = new Date();
    if (isActive) {
      conditions.push(
        and(
          lte(schema.Partnerships.startedAt, now),
          or(
            isNull(schema.Partnerships.endedAt),
            gte(schema.Partnerships.endedAt, now),
          ),
        ),
      );
    } else {
      conditions.push(
        or(
          sql`${schema.Partnerships.startedAt} > ${now}`,
          sql`${schema.Partnerships.endedAt} < ${now}`,
        ),
      );
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [partnerships, countResult] = await Promise.all([
    dbClient.db.query.Partnerships.findMany({
      where: whereClause,
      with: {
        organization: true,
        project: true,
        event: true,
      },
      orderBy: [desc(schema.Partnerships.startedAt)],
      limit: pageSize,
      offset,
    }),
    dbClient.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.Partnerships)
      .where(whereClause),
  ]);

  const now = new Date();

  return {
    items: partnerships.map((p) => ({
      id: p.id,
      organization: {
        id: p.organization.id,
        name: p.organization.name,
        logoUrl: p.organization.logoUrl ?? undefined,
        website: p.organization.website ?? undefined,
      },
      partnershipType: p.partnershipType,
      startedAt: p.startedAt,
      endedAt: p.endedAt ?? undefined,
      value: p.value ?? undefined,
      isActive: p.startedAt <= now && (p.endedAt === null || p.endedAt >= now),
      project: p.project
        ? { id: p.project.id, name: p.project.title }
        : undefined,
      event: p.event ? { id: p.event.id, name: p.event.name } : undefined,
    })),
    page,
    pageSize,
    total: countResult[0]?.count ?? 0,
  };
}

/**
 * Get a single partnership by ID with full details
 */
export async function getPartnershipById(id: string) {
  const partnership = await dbClient.db.query.Partnerships.findFirst({
    where: eq(schema.Partnerships.id, id),
    with: {
      organization: true,
      project: true,
      event: true,
    },
  });

  if (!partnership) {
    throw new ApiError("Partnership not found", 404);
  }

  // Fetch contract document if exists
  let contractDocument = undefined;
  if (partnership.contractDocumentId) {
    const doc = await dbClient.db
      .select()
      .from(schema.Documents)
      .where(eq(schema.Documents.id, partnership.contractDocumentId))
      .limit(1);
    if (doc[0]) {
      contractDocument = { id: doc[0].id, type: doc[0].type };
    }
  }

  const now = new Date();

  return {
    id: partnership.id,
    organization: {
      id: partnership.organization.id,
      name: partnership.organization.name,
      logoUrl: partnership.organization.logoUrl ?? undefined,
      website: partnership.organization.website ?? undefined,
      description: partnership.organization.description ?? undefined,
      isActive: partnership.organization.isActive,
    },
    partnershipType: partnership.partnershipType,
    startedAt: partnership.startedAt,
    endedAt: partnership.endedAt ?? undefined,
    value: partnership.value ?? undefined,
    isActive:
      partnership.startedAt <= now &&
      (partnership.endedAt === null || partnership.endedAt >= now),
    project: partnership.project
      ? { id: partnership.project.id, name: partnership.project.title }
      : undefined,
    event: partnership.event
      ? { id: partnership.event.id, name: partnership.event.name }
      : undefined,
    metadata: partnership.metadata ?? undefined,
    contractDocument,
  };
}

/**
 * Create a new partnership
 */
export async function createPartnership(data: CreatePartnershipInput) {
  // Validate organization exists
  const org = await dbClient.db
    .select({ id: schema.Organizations.id })
    .from(schema.Organizations)
    .where(eq(schema.Organizations.id, data.organizationId))
    .limit(1);

  if (!org[0]) {
    throw new ApiError("Organization not found", 404);
  }

  // Validate project exists if provided
  if (data.projectId) {
    const project = await dbClient.db
      .select({ id: schema.Projects.id })
      .from(schema.Projects)
      .where(eq(schema.Projects.id, data.projectId))
      .limit(1);

    if (!project[0]) {
      throw new ApiError("Project not found", 404);
    }
  }

  // Validate event exists if provided
  if (data.eventId) {
    const event = await dbClient.db
      .select({ id: schema.Events.id })
      .from(schema.Events)
      .where(eq(schema.Events.id, data.eventId))
      .limit(1);

    if (!event[0]) {
      throw new ApiError("Event not found", 404);
    }
  }

  // Validate contract document exists if provided
  if (data.contractDocumentId) {
    const doc = await dbClient.db
      .select({ id: schema.Documents.id })
      .from(schema.Documents)
      .where(eq(schema.Documents.id, data.contractDocumentId))
      .limit(1);

    if (!doc[0]) {
      throw new ApiError("Contract document not found", 404);
    }
  }

  const [partnership] = await dbClient.db
    .insert(schema.Partnerships)
    .values({
      organizationId: data.organizationId,
      partnershipType: data.partnershipType,
      projectId: data.projectId ?? null,
      eventId: data.eventId ?? null,
      startedAt: data.startedAt,
      endedAt: data.endedAt ?? null,
      value: data.value ?? null,
      metadata: data.metadata ?? null,
      contractDocumentId: data.contractDocumentId ?? null,
    })
    .returning();

  return partnership;
}

/**
 * Update an existing partnership
 */
export async function updatePartnership(
  id: string,
  data: z.infer<typeof UpdatePartnershipSchema>,
) {
  // Verify partnership exists
  const existing = await dbClient.db
    .select({ id: schema.Partnerships.id })
    .from(schema.Partnerships)
    .where(eq(schema.Partnerships.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new ApiError("Partnership not found", 404);
  }

  // Validate project if being updated
  if (data.projectId) {
    const project = await dbClient.db
      .select({ id: schema.Projects.id })
      .from(schema.Projects)
      .where(eq(schema.Projects.id, data.projectId))
      .limit(1);

    if (!project[0]) {
      throw new ApiError("Project not found", 404);
    }
  }

  // Validate event if being updated
  if (data.eventId) {
    const event = await dbClient.db
      .select({ id: schema.Events.id })
      .from(schema.Events)
      .where(eq(schema.Events.id, data.eventId))
      .limit(1);

    if (!event[0]) {
      throw new ApiError("Event not found", 404);
    }
  }

  // Validate contract document if being updated
  if (data.contractDocumentId) {
    const doc = await dbClient.db
      .select({ id: schema.Documents.id })
      .from(schema.Documents)
      .where(eq(schema.Documents.id, data.contractDocumentId))
      .limit(1);

    if (!doc[0]) {
      throw new ApiError("Contract document not found", 404);
    }
  }

  const updateData: Record<string, any> = {};

  if (data.partnershipType !== undefined) {
    updateData.partnershipType = data.partnershipType;
  }
  if (data.projectId !== undefined) {
    updateData.projectId = data.projectId;
  }
  if (data.eventId !== undefined) {
    updateData.eventId = data.eventId;
  }
  if (data.startedAt !== undefined) {
    updateData.startedAt = data.startedAt;
  }
  if (data.endedAt !== undefined) {
    updateData.endedAt = data.endedAt;
  }
  if (data.value !== undefined) {
    updateData.value = data.value;
  }
  if (data.metadata !== undefined) {
    updateData.metadata = data.metadata;
  }
  if (data.contractDocumentId !== undefined) {
    updateData.contractDocumentId = data.contractDocumentId;
  }

  const [updated] = await dbClient.db
    .update(schema.Partnerships)
    .set(updateData)
    .where(eq(schema.Partnerships.id, id))
    .returning();

  return updated;
}

/**
 * Delete a partnership
 */
export async function deletePartnership(id: string) {
  const existing = await dbClient.db
    .select({ id: schema.Partnerships.id })
    .from(schema.Partnerships)
    .where(eq(schema.Partnerships.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new ApiError("Partnership not found", 404);
  }

  await dbClient.db
    .delete(schema.Partnerships)
    .where(eq(schema.Partnerships.id, id));

  return { deleted: true };
}

/**
 * Get partnerships for a specific project
 */
export async function getPartnershipsByProject(
  projectId: string,
  filters: { page: number; pageSize: number },
) {
  return getPartnerships({ ...filters, projectId });
}

/**
 * Get partnerships for a specific event
 */
export async function getPartnershipsByEvent(
  eventId: string,
  filters: { page: number; pageSize: number },
) {
  return getPartnerships({ ...filters, eventId });
}
