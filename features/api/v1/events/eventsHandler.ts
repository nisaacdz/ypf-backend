import { ApiResponse, AppError } from "@/shared/types";
import {
  CreateEventSchema,
  GetEventMediaQuerySchema,
  GetEventsQuerySchema,
  UpdateEventSchema,
  UpdateEventMediaSchema,
} from "@/shared/validators/activities";
import { Events } from "@/db/schema/activities";
import z from "zod";
import pgPool from "@/configs/db";
import * as mediaUtils from "@/shared/utils/media";
import * as mediaService from "@/shared/services/mediaService";
import * as eventsService from "@/shared/services/eventsService";
import { YPFEventMedium, Paginated, YPFEvent, YPFEventDetail } from "@/shared/dtos";

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
  const [event] = await pgPool.db
    .insert(Events)
    .values(newEvent)
    .returning({ id: Events.id });
  if (!event) {
    throw new AppError("A server error occurred", 500);
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
        externalId: uploadMeta.externalId,
        type: uploadMeta.type,
        width: uploadMeta.dimensions.width,
        height: uploadMeta.dimensions.height,
        sizeInBytes: uploadMeta.sizeInBytes,
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
    throw new AppError("Event not found", 404);
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

export async function updateEventMedia(
  eventMediaId: number,
  data: z.infer<typeof UpdateEventMediaSchema>,
): Promise<ApiResponse<null>> {
  await eventsService.updateEventMedia(eventMediaId, data);

  return {
    success: true,
    message: "Event media updated successfully",
    data: null,
  };
}
