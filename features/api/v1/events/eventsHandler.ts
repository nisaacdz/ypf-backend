import { ApiResponse, AppError } from "@/shared/types";
import {
  CreateEventSchema,
  GetEventMediaQuerySchema,
} from "@/shared/validators/activities";
import { Events } from "@/db/schema/activities";
import z from "zod";
import pgPool from "@/configs/db";
import { storeMediumFile, deleteMediumFile } from "@/shared/utils/media";
import * as mediaService from "@/shared/services/mediaService";
import * as eventsService from "@/shared/services/eventsService";
import { YPFEventMedium, Paginated } from "@/shared/dtos";

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

export async function uploadEventMedia({
  userId,
  eventId,
  file,
  options,
}: {
  userId: string;
  eventId: string;
  file: Express.Multer.File;
  options: { caption?: string; isFeatured: boolean };
}): Promise<ApiResponse<string>> {
  const uploadMeta = await storeMediumFile(file);

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
        uploadedBy: userId,
      },
    });

    return {
      success: true,
      message: "Media uploaded successfully",
      data: newMediumId,
    };
  } catch (error) {
    await deleteMediumFile(uploadMeta.externalId);
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
