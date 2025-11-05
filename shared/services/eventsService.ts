import { eq, count, and, ilike, or } from "drizzle-orm";
import schema from "@/db/schema";
import pgPool from "@/configs/db";
import z from "zod";
import {
  GetEventMediaQuerySchema,
  GetEventsQuerySchema,
  UpdateEventSchema,
} from "../validators/activities";
import * as mediaUtils from "@/shared/utils/media";
import { Paginated, YPFEvent, YPFEventDetail } from "@/shared/dtos";
import { AppError } from "@/shared/types";

export async function fetchEvents(
  query: z.infer<typeof GetEventsQuerySchema>,
): Promise<Paginated<YPFEvent>> {
  const { page, pageSize, search } = query;
  const offset = (page - 1) * pageSize;

  // Build where conditions
  const conditions = [];

  if (search) {
    // Search in event name or project title if event is part of a project
    conditions.push(
      or(
        ilike(schema.Events.name, `%${search}%`),
        ilike(schema.Projects.title, `%${search}%`),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch total count
  const [{ total }] = await pgPool.db
    .select({ total: count() })
    .from(schema.Events)
    .leftJoin(schema.Projects, eq(schema.Events.projectId, schema.Projects.id))
    .where(whereClause);

  // Fetch paginated events with project info
  const events = await pgPool.db
    .select({
      id: schema.Events.id,
      name: schema.Events.name,
      scheduledStart: schema.Events.scheduledStart,
      scheduledEnd: schema.Events.scheduledEnd,
      location: schema.Events.location,
      status: schema.Events.status,
      projectTitle: schema.Projects.title,
    })
    .from(schema.Events)
    .leftJoin(schema.Projects, eq(schema.Events.projectId, schema.Projects.id))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  // Transform to YPFEvent
  const items: YPFEvent[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    scheduledStart: event.scheduledStart,
    scheduledEnd: event.scheduledEnd,
    location: event.location || undefined,
    status: event.status,
    projectTitle: event.projectTitle || undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

export async function fetchEventMedia(
  eventId: string,
  query: z.infer<typeof GetEventMediaQuerySchema>,
) {
  const { page, pageSize } = query;

  const [itemsItems, total] = await Promise.all([
    pgPool.db
      .select({
        id: schema.EventMedia.id,
        caption: schema.EventMedia.caption,
        isFeatured: schema.EventMedia.isFeatured,
        medium: {
          id: schema.Media.id,
          externalId: schema.Media.externalId,
          type: schema.Media.type,
          width: schema.Media.width,
          height: schema.Media.height,
          sizeInBytes: schema.Media.sizeInBytes,
          uploadedAt: schema.Media.uploadedAt,
        },
      })
      .from(schema.EventMedia)
      .innerJoin(schema.Media, eq(schema.EventMedia.mediumId, schema.Media.id))
      .where(eq(schema.EventMedia.eventId, eventId))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    pgPool.db
      .select({ count: count() })
      .from(schema.EventMedia)
      .where(eq(schema.EventMedia.eventId, eventId))
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

  return { items, total };
}

export async function fetchEventById(
  eventId: string,
): Promise<YPFEventDetail | null> {
  const eventResult = await pgPool.db
    .select({
      id: schema.Events.id,
      name: schema.Events.name,
      scheduledStart: schema.Events.scheduledStart,
      scheduledEnd: schema.Events.scheduledEnd,
      location: schema.Events.location,
      objective: schema.Events.objective,
      status: schema.Events.status,
      project: {
        id: schema.Projects.id,
        title: schema.Projects.title,
      },
    })
    .from(schema.Events)
    .leftJoin(schema.Projects, eq(schema.Events.projectId, schema.Projects.id))
    .where(eq(schema.Events.id, eventId))
    .limit(1);

  if (eventResult.length === 0) {
    return null;
  }

  const event = eventResult[0];

  // Fetch featured media for the event
  const featuredMedia = await pgPool.db
    .select({
      caption: schema.EventMedia.caption,
      medium: {
        id: schema.Media.id,
        externalId: schema.Media.externalId,
        type: schema.Media.type,
        width: schema.Media.width,
        height: schema.Media.height,
        sizeInBytes: schema.Media.sizeInBytes,
        uploadedAt: schema.Media.uploadedAt,
      },
    })
    .from(schema.EventMedia)
    .innerJoin(schema.Media, eq(schema.EventMedia.mediumId, schema.Media.id))
    .where(
      and(
        eq(schema.EventMedia.eventId, eventId),
        eq(schema.EventMedia.isFeatured, true),
      ),
    );

  return {
    id: event.id,
    name: event.name,
    scheduledStart: event.scheduledStart,
    scheduledEnd: event.scheduledEnd,
    location: event.location || undefined,
    objective: event.objective || undefined,
    status: event.status,
    project: event.project?.id
      ? {
          id: event.project.id,
          title: event.project.title!,
        }
      : undefined,
    featuredMedia:
      featuredMedia.length > 0
        ? featuredMedia.map((m) => ({
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
          }))
        : undefined,
  };
}

export async function updateEvent(
  eventId: string,
  data: z.infer<typeof UpdateEventSchema>,
): Promise<void> {
  // Check if event exists
  const existingEvent = await pgPool.db
    .select({ id: schema.Events.id })
    .from(schema.Events)
    .where(eq(schema.Events.id, eventId))
    .limit(1);

  if (existingEvent.length === 0) {
    throw new AppError("Event not found", 404);
  }

  // Filter out undefined values
  const updateData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No valid fields to update", 400);
  }

  await pgPool.db
    .update(schema.Events)
    .set(updateData)
    .where(eq(schema.Events.id, eventId));
}

export async function updateEventMedia(
  eventMediaId: number,
  data: { caption?: string; isFeatured?: boolean },
): Promise<void> {
  // Check if event media exists
  const existingMedia = await pgPool.db
    .select({ id: schema.EventMedia.id })
    .from(schema.EventMedia)
    .where(eq(schema.EventMedia.id, eventMediaId))
    .limit(1);

  if (existingMedia.length === 0) {
    throw new AppError("Event media not found", 404);
  }

  // Filter out undefined values
  const updateData = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );

  if (Object.keys(updateData).length === 0) {
    throw new AppError("No valid fields to update", 400);
  }

  await pgPool.db
    .update(schema.EventMedia)
    .set(updateData)
    .where(eq(schema.EventMedia.id, eventMediaId));
}
