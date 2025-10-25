import { eq, count, and, ilike, or } from "drizzle-orm";
import schema from "@/db/schema";
import pgPool from "@/configs/db";
import z from "zod";
import {
  GetEventMediaQuerySchema,
  GetEventsQuerySchema,
} from "../validators/activities";
import * as mediaUtils from "@/shared/utils/media";
import { Paginated, YPFEvent } from "@/shared/dtos";

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
      projectId: schema.Projects.id,
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
    project:
      event.projectId && event.projectTitle
        ? {
            id: event.projectId,
            title: event.projectTitle,
          }
        : undefined,
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
          id: schema.Medium.id,
          externalId: schema.Medium.externalId,
          type: schema.Medium.type,
          width: schema.Medium.width,
          height: schema.Medium.height,
          sizeInBytes: schema.Medium.sizeInBytes,
          uploadedAt: schema.Medium.uploadedAt,
        },
      })
      .from(schema.EventMedia)
      .innerJoin(
        schema.Medium,
        eq(schema.EventMedia.mediumId, schema.Medium.id),
      )
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
