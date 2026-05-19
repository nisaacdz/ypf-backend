import { ApiResponse, ApiError } from "@/shared/types";
import {
  CreateEventSchema,
  GetEventMediaQuerySchema,
  GetEventsQuerySchema,
  GuestEventRegistrationSchema,
  UpdateEventSchema,
  UpdateEventMediumSchema,
} from "./schemas";
import { Events, EventAttendees } from "@/db/schema/activities";
import { eq } from "drizzle-orm";
import z from "zod";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import * as mediaUtils from "@/shared/utils/files";
import * as mediaService from "@/shared/services/mediaService";
import * as eventsService from "@/shared/services/eventsService";
import { Paginated } from "@/shared/dtos";
import { YPFEventMedium, YPFEvent, YPFEventDetail } from "./dtos";

export async function getEvents(
  query: z.infer<typeof GetEventsQuerySchema>,
): Promise<ApiResponse<Paginated<YPFEvent>>> {
  const data = await eventsService.fetchEvents(query);

  return {
    success: true,
    message: "Events fetched successfully",
    data,
  };
}

export async function createEvent(
  newEvent: z.infer<typeof CreateEventSchema>,
): Promise<ApiResponse<string>> {
  const event = await eventsService.createEvent(newEvent);
  if (!event) {
    throw new ApiError("A server error occurred", 500);
  }
  return {
    success: true,
    message: "Event created successfully",
    data: event.id,
  };
}

export async function uploadEventMedium({
  constituentId,
  eventId,
  file,
  options,
}: {
  constituentId: string;
  eventId: string;
  file: Express.Multer.File;
  options: { caption?: string; isFeatured: boolean };
}): Promise<ApiResponse<string>> {
  const uploadMeta = await mediaUtils.storeMediumFile(file);

  try {
    const newMediumId = await mediaService.uploadEventMedium(eventId, {
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

export async function getEventMedia(
  eventId: string,
  query: z.infer<typeof GetEventMediaQuerySchema>,
): Promise<ApiResponse<Paginated<YPFEventMedium>>> {
  const { page, pageSize } = query;
  const { items, total } = await eventsService.fetchEventMedia(eventId, query);
  return {
    success: true,
    message: "Event media fetched successfully",
    data: {
      items,
      page,
      pageSize,
      total,
    },
  };
}

export async function getEventById(
  eventId: string,
): Promise<ApiResponse<YPFEventDetail>> {
  const event = await eventsService.fetchEventById(eventId);

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  return {
    success: true,
    message: "Event fetched successfully",
    data: event,
  };
}

export async function updateEvent(
  eventId: string,
  data: z.infer<typeof UpdateEventSchema>,
): Promise<ApiResponse<null>> {
  await eventsService.updateEvent(eventId, data);

  return {
    success: true,
    message: "Event updated successfully",
    data: null,
  };
}

export async function deleteEvent(
  eventId: string,
): Promise<ApiResponse<null>> {
  await eventsService.deleteEvent(eventId);

  return {
    success: true,
    message: "Event deleted successfully",
    data: null,
  };
}

export async function updateEventMedium(
  eventId: string,
  eventMediumId: string,
  data: z.infer<typeof UpdateEventMediumSchema>,
): Promise<ApiResponse<null>> {
  await eventsService.updateEventMedium(eventId, eventMediumId, data);

  return {
    success: true,
    message: "Event medium updated successfully",
    data: null,
  };
}

/**
 * Plan §8.2 / Audit C3 — public guest registration for an event. Mirrors
 * registerGuestForProject but with a lighter body (no rich profile). Inserts
 * into event_attendees with constituent_id NULL and guest_* fields populated.
 * Event must be UPCOMING or ONGOING.
 */
export async function registerGuestForEvent(
  eventId: string,
  body: z.infer<typeof GuestEventRegistrationSchema>,
): Promise<ApiResponse<{ id: string; eventId: string }>> {
  const event = await dbClient.db.query.Events.findFirst({
    where: eq(Events.id, eventId),
    columns: { id: true, status: true, name: true },
  });

  if (!event) {
    throw new ApiError("Event not found", 404);
  }
  if (event.status !== "UPCOMING" && event.status !== "ONGOING") {
    throw new ApiError("This event is no longer accepting registrations", 400);
  }

  const [attendee] = await dbClient.db
    .insert(schema.EventAttendees)
    .values({
      eventId,
      constituentId: null,
      guestName: `${body.firstName} ${body.lastName}`.trim(),
      guestEmail: body.email,
      guestPhone: body.phone,
      // status defaults to ACCEPTED for guest RSVPs.
    })
    .returning({ id: schema.EventAttendees.id });

  // TODO: queue confirmation + admin notification emails via pg-boss.

  return {
    success: true,
    message: "Registration received",
    data: { id: attendee.id, eventId },
  };
}
