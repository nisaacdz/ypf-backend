import { ApiResponse, ApiError } from "@/shared/types";
import {
  CreateEventSchema,
  GetEventMediaQuerySchema,
  GetEventsQuerySchema,
  UpdateEventSchema,
  UpdateEventMediumSchema,
} from "@/shared/validators";
import { Events } from "@/db/schema/activities";
import z from "zod";
import dbClient from "@/configs/db";
import * as mediaUtils from "@/shared/utils/files";
import * as mediaService from "@/shared/services/mediaService";
import * as eventsService from "@/shared/services/eventsService";
import {
  Paginated,
  YPFEventMedium,
  YPFEvent,
  YPFEventDetail,
} from "@/shared/dtos";

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
  const [event] = await dbClient.db
    .insert(Events)
    .values(newEvent)
    .returning({ id: Events.id });
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

export async function updateEventMedium(
  eventMediumId: string,
  data: z.infer<typeof UpdateEventMediumSchema>,
): Promise<ApiResponse<null>> {
  await eventsService.updateEventMedium(eventMediumId, data);

  return {
    success: true,
    message: "Event medium updated successfully",
    data: null,
  };
}
