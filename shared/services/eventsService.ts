import { eq, count, and, ilike, or, desc, isNull, isNotNull, sql } from "drizzle-orm";
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
  const { page, pageSize, search, projectId, chapterId, filterStatus, filterType } = query;
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

  // Match events tied to this chapter either directly (Events.chapterId) or
  // indirectly through their parent project (Projects.chapterId). Either link
  // can be the canonical association depending on how the event was created.
  if (chapterId) {
    conditions.push(
      or(
        eq(schema.Events.chapterId, chapterId),
        eq(schema.Projects.chapterId, chapterId),
      ),
    );
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
        description: schema.Events.description,
        scheduledStart: schema.Events.scheduledStart,
        scheduledEnd: schema.Events.scheduledEnd,
        location: schema.Events.location,
        objective: schema.Events.objective,
        type: schema.Events.type,
        status: schema.Events.status,
        maxCapacity: schema.Events.maxCapacity,
        projectTitle: schema.Projects.title,
        chapterName: schema.Chapters.name,
        // min() so multiple isFeatured rows never produce duplicate event rows
        featuredMediumExternalId: sql<string | null>`min(${schema.Media.externalId})`,
        attendeeCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${schema.EventAttendees}
          WHERE ${schema.EventAttendees.eventId} = ${schema.Events.id}
        )`,
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
        schema.Events.description,
        schema.Events.scheduledStart,
        schema.Events.scheduledEnd,
        schema.Events.location,
        schema.Events.objective,
        schema.Events.type,
        schema.Events.status,
        schema.Projects.title,
        schema.Projects.id,
        schema.Chapters.name,
        schema.Chapters.id,
        schema.Events.maxCapacity,
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
    description: event.description || undefined,
    scheduledStart: event.scheduledStart,
    scheduledEnd: event.scheduledEnd,
    location: event.location || undefined,
    objective: event.objective || undefined,
    type: event.type,
    status: event.status,
    projectTitle: event.projectTitle || undefined,
    chapterName: event.chapterName || undefined,
    attendeeCount: Number(event.attendeeCount ?? 0),
    maxCapacity: event.maxCapacity ?? undefined,
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

export async function fetchEventDocuments(
  eventId: string,
  query: z.infer<typeof GetEventMediaQuerySchema>,
) {
  const { page, pageSize } = query;

  const [eventDocuments, total] = await Promise.all([
    dbClient.db
      .select({
        id: schema.EventDocuments.id,
        title: schema.EventDocuments.title,
        document: {
          id: schema.Documents.id,
          externalId: schema.Documents.externalId,
          type: schema.Documents.type,
          size: schema.Documents.size,
          uploadedAt: schema.Documents.uploadedAt,
        },
      })
      .from(schema.EventDocuments)
      .innerJoin(
        schema.Documents,
        eq(schema.EventDocuments.documentId, schema.Documents.id),
      )
      .where(eq(schema.EventDocuments.eventId, eventId))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbClient.db
      .select({ count: count() })
      .from(schema.EventDocuments)
      .where(eq(schema.EventDocuments.eventId, eventId))
      .then((res) => res[0].count),
  ]);

  const items = await Promise.all(
    eventDocuments.map(async (d) => ({
      ...d,
      document: {
        url: await mediaUtils.generateSignedDocumentPreviewUrl(
          d.document.externalId,
          {
            expireSeconds: 60 * 60 * 24,
          },
        ),
        type: d.document.type,
        size: d.document.size,
        uploadedAt: d.document.uploadedAt,
      },
    })),
  );

  return { items, total };
}

export async function fetchEventById(
  eventId: string,
): Promise<YPFEventDetail | null> {
  const [ypfEvent] = await dbClient.db
    .select({
      id: schema.Events.id,
      name: schema.Events.name,
      description: schema.Events.description,
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

  const featuredDocuments = await dbClient.db
    .select({
      title: schema.EventDocuments.title,
      document: {
        id: schema.Documents.id,
        externalId: schema.Documents.externalId,
        type: schema.Documents.type,
        size: schema.Documents.size,
        uploadedAt: schema.Documents.uploadedAt,
      },
    })
    .from(schema.EventDocuments)
    .innerJoin(
      schema.Documents,
      eq(schema.EventDocuments.documentId, schema.Documents.id),
    )
    .where(eq(schema.EventDocuments.eventId, eventId));

  return {
    id: ypfEvent.id,
    name: ypfEvent.name,
    description: ypfEvent.description || undefined,
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
    featuredDocuments:
      featuredDocuments.length > 0
        ? await Promise.all(
            featuredDocuments.map(async (d) => ({
              title: d.title,
              document: {
                url: await mediaUtils.generateSignedDocumentPreviewUrl(
                  d.document.externalId,
                  {
                    expireSeconds: 60 * 60 * 24,
                  },
                ),
                type: d.document.type,
                size: d.document.size,
                uploadedAt: d.document.uploadedAt,
              },
            })),
          )
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

export async function deleteEvent(eventId: string): Promise<void> {
  const [deletedEvent] = await dbClient.db
    .delete(schema.Events)
    .where(eq(schema.Events.id, eventId))
    .returning({ id: schema.Events.id });

  if (!deletedEvent) {
    throw new ApiError("Event not found", 404);
  }
}

export async function updateEventMedium(
  eventId: string,
  eventMediumId: string,
  data: { caption?: string; isFeatured?: boolean },
): Promise<void> {
  const [updatedData] = await dbClient.db
    .update(schema.EventMedia)
    .set(data)
    .where(
      and(
        eq(schema.EventMedia.eventId, eventId),
        eq(schema.EventMedia.id, eventMediumId),
      ),
    )
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

// ─── Event attendees roster (Audit I6) ──────────────────────────────────────

export type EventAttendeeRow = {
  id: string;
  role: "guest" | "member";
  status: "INVITED" | "ACCEPTED" | "DECLINED" | "ATTENDED";
  name: string | null;
  email: string | null;
  phone: string | null;
  registeredAt: Date;
};

/**
 * Paginated list of who's RSVP'd to an event. Unifies guest attendees
 * (constituent_id NULL, guest_* fields) with member attendees (joined to
 * Constituents).
 */
export async function fetchEventAttendees(
  eventId: string,
  query: {
    page?: number;
    pageSize?: number;
    role?: "guest" | "member" | "all";
  },
): Promise<Paginated<EventAttendeeRow>> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const role = query.role ?? "all";

  const conds = [eq(schema.EventAttendees.eventId, eventId)];
  if (role === "guest") {
    conds.push(isNull(schema.EventAttendees.constituentId));
  } else if (role === "member") {
    conds.push(isNotNull(schema.EventAttendees.constituentId));
  }
  const whereClause = and(...conds);

  const [rows, totalRow] = await Promise.all([
    dbClient.db
      .select({
        id: schema.EventAttendees.id,
        constituentId: schema.EventAttendees.constituentId,
        status: schema.EventAttendees.status,
        guestName: schema.EventAttendees.guestName,
        guestEmail: schema.EventAttendees.guestEmail,
        guestPhone: schema.EventAttendees.guestPhone,
        registeredAt: schema.EventAttendees.registeredAt,
        memberFirstName: schema.Constituents.firstName,
        memberLastName: schema.Constituents.lastName,
        memberEmail: schema.Constituents.email,
        memberPhone: schema.Constituents.phone,
      })
      .from(schema.EventAttendees)
      .leftJoin(
        schema.Constituents,
        eq(schema.EventAttendees.constituentId, schema.Constituents.id),
      )
      .where(whereClause)
      .orderBy(desc(schema.EventAttendees.registeredAt))
      .limit(pageSize)
      .offset(offset),
    dbClient.db
      .select({ n: count() })
      .from(schema.EventAttendees)
      .where(whereClause)
      .then((res) => res[0].n),
  ]);

  const items: EventAttendeeRow[] = rows.map((r) => {
    const isGuest = r.constituentId === null;
    return {
      id: r.id,
      role: isGuest ? "guest" : "member",
      status: r.status,
      name: isGuest
        ? r.guestName
        : [r.memberFirstName, r.memberLastName].filter(Boolean).join(" ") ||
          null,
      email: isGuest ? r.guestEmail : r.memberEmail,
      phone: isGuest ? r.guestPhone : r.memberPhone,
      registeredAt: r.registeredAt,
    };
  });

  return {
    items,
    page,
    pageSize,
    total: Number(totalRow ?? 0),
  };
}
