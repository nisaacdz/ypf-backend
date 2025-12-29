import { eq, count, and, ilike, or } from "drizzle-orm";
import schema from "@/db/schema";
import dbClient from "@/configs/db";
import z from "zod";
import {
  CreateEventSchema,
  GetEventMediaQuerySchema,
  GetEventsQuerySchema,
  UpdateEventSchema,
} from "@/features/api/v1/events/schemas";
import * as mediaUtils from "@/shared/utils/files";
import { Paginated } from "@/shared/dtos";
import { YPFEvent, YPFEventDetail } from "@/features/api/v1/events/dtos";
import { ApiError } from "@/shared/types";

export async function fetchEvents(
  query: z.infer<typeof GetEventsQuerySchema>,
): Promise<Paginated<YPFEvent>> {
  const { page, pageSize, search, projectId, filterStatus, filterType } = query;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(schema.Events.name, `%${search}%`),
        ilike(schema.Projects.title, `%${search}%`),
      ),
    );
  }

  if (projectId) {
    conditions.push(eq(schema.Events.projectId, projectId));
  }

  if (filterStatus) {
    conditions.push(eq(schema.Events.status, filterStatus));
  }

  if (filterType) {
    conditions.push(eq(schema.Events.type, filterType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [events, total] = await Promise.all([
    dbClient.db
      .select({
        id: schema.Events.id,
        name: schema.Events.name,
        scheduledStart: schema.Events.scheduledStart,
        scheduledEnd: schema.Events.scheduledEnd,
        location: schema.Events.location,
        type: schema.Events.type,
        status: schema.Events.status,
        projectTitle: schema.Projects.title,
        chapterName: schema.Chapters.name,
        featuredMediumExternalId: schema.Media.externalId,
      })
      .from(schema.Events)
      .leftJoin(
        schema.Projects,
        eq(schema.Events.projectId, schema.Projects.id),
      )
      .leftJoin(
        schema.Chapters,
        eq(schema.Projects.chapterId, schema.Chapters.id),
      )
      .leftJoin(
        schema.EventMedia,
        and(
          eq(schema.Events.id, schema.EventMedia.eventId),
          eq(schema.EventMedia.isFeatured, true),
        ),
      )
      .leftJoin(schema.Media, eq(schema.EventMedia.mediumId, schema.Media.id))
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .groupBy(
        schema.Events.id,
        schema.Events.name,
        schema.Events.scheduledStart,
        schema.Events.scheduledEnd,
        schema.Events.location,
        schema.Events.type,
        schema.Events.status,
        schema.Projects.title,
        schema.Projects.id,
        schema.Chapters.name,
        schema.Chapters.id,
        schema.Media.externalId,
      ),

    dbClient.db
      .select({ total: count() })
      .from(schema.Events)
      .leftJoin(
        schema.Projects,
        eq(schema.Events.projectId, schema.Projects.id),
      )
      .where(whereClause)
      .then((res) => res[0].total),
  ]);

  const items: YPFEvent[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    scheduledStart: event.scheduledStart,
    scheduledEnd: event.scheduledEnd,
    location: event.location || undefined,
    type: event.type,
    status: event.status,
    projectTitle: event.projectTitle || undefined,
    chapterName: event.chapterName || undefined,
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

export async function fetchEventMedia(
  eventId: string,
  query: z.infer<typeof GetEventMediaQuerySchema>,
) {
  const { page, pageSize } = query;

  const [eventMedia, total] = await Promise.all([
    dbClient.db
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
          size: schema.Media.size,
          uploadedAt: schema.Media.uploadedAt,
        },
      })
      .from(schema.EventMedia)
      .innerJoin(schema.Media, eq(schema.EventMedia.mediumId, schema.Media.id))
      .where(eq(schema.EventMedia.eventId, eventId))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbClient.db
      .select({ count: count() })
      .from(schema.EventMedia)
      .where(eq(schema.EventMedia.eventId, eventId))
      .then((res) => res[0].count),
  ]);

  const items = eventMedia.map((m) => ({
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

  return { items, total };
}

export async function fetchEventById(
  eventId: string,
): Promise<YPFEventDetail | null> {
  const [ypfEvent] = await dbClient.db
    .select({
      id: schema.Events.id,
      name: schema.Events.name,
      scheduledStart: schema.Events.scheduledStart,
      scheduledEnd: schema.Events.scheduledEnd,
      location: schema.Events.location,
      objective: schema.Events.objective,
      status: schema.Events.status,
      type: schema.Events.type,
      chapter: {
        id: schema.Chapters.id,
        name: schema.Chapters.name,
      },
      project: {
        id: schema.Projects.id,
        title: schema.Projects.title,
        scheduledStart: schema.Projects.scheduledStart,
      },
    })
    .from(schema.Events)
    .leftJoin(schema.Projects, eq(schema.Events.projectId, schema.Projects.id))
    .leftJoin(
      schema.Chapters,
      eq(schema.Projects.chapterId, schema.Chapters.id),
    )
    .where(eq(schema.Events.id, eventId))
    .limit(1);

  if (!ypfEvent) {
    return null;
  }

  // Fetch featured media for the event
  const featuredMedia = await dbClient.db
    .select({
      caption: schema.EventMedia.caption,
      medium: {
        id: schema.Media.id,
        externalId: schema.Media.externalId,
        type: schema.Media.type,
        width: schema.Media.width,
        height: schema.Media.height,
        size: schema.Media.size,
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
    id: ypfEvent.id,
    name: ypfEvent.name,
    scheduledStart: ypfEvent.scheduledStart,
    scheduledEnd: ypfEvent.scheduledEnd,
    location: ypfEvent.location || undefined,
    objective: ypfEvent.objective || undefined,
    type: ypfEvent.type,
    status: ypfEvent.status,
    project: ypfEvent.project
      ? {
          id: ypfEvent.project.id,
          title: ypfEvent.project.title,
          date: ypfEvent.project.scheduledStart,
        }
      : undefined,
    chapter:
      ypfEvent.chapter?.id && ypfEvent.chapter.name
        ? {
            id: ypfEvent.chapter.id,
            name: ypfEvent.chapter.name,
          }
        : undefined,
    featuredMedia:
      featuredMedia.length > 0
        ? featuredMedia.map((m) => ({
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
          }))
        : undefined,
  };
}

export async function updateEvent(
  eventId: string,
  data: z.infer<typeof UpdateEventSchema>,
): Promise<void> {
  const [updatedEvent] = await dbClient.db
    .update(schema.Events)
    .set(data)
    .where(eq(schema.Events.id, eventId))
    .returning({ id: schema.Events.id });

  if (!updatedEvent) {
    throw new ApiError("Event not found", 404);
  }
}

export async function updateEventMedium(
  eventMediumId: string,
  data: { caption?: string; isFeatured?: boolean },
): Promise<void> {
  const [updatedData] = await dbClient.db
    .update(schema.EventMedia)
    .set(data)
    .where(eq(schema.EventMedia.id, eventMediumId))
    .returning({ id: schema.EventMedia.id });

  if (!updatedData) {
    throw new ApiError("Project medium not found", 404);
  }
}

export async function createEvent(
  newEvent: z.infer<typeof CreateEventSchema>,
): Promise<{ id: string } | null> {
  const [createdEvent] = await dbClient.db
    .insert(schema.Events)
    .values(newEvent)
    .returning({ id: schema.Events.id });

  return createdEvent ?? null;
}
