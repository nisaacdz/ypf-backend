import dbClient from "@/configs/db";
import { imagekit } from "@/configs/fs/cdn";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";
import { eq } from "drizzle-orm";
import logger from "@/configs/logger";

export type AddMediumRecord = {
  caption?: string;
  isFeatured: boolean;
  medium: {
    externalId: string;
    type: "PICTURE" | "VIDEO";
    width: number;
    height: number;
    size: number;
    uploadedBy: string;
  };
};

export async function uploadEventMedium(
  eventId: string,
  data: AddMediumRecord,
): Promise<string> {
  const event = await dbClient.db.query.Events.findFirst({
    where: eq(schema.Events.id, eventId),
    columns: { id: true },
  });

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  try {
    const newMediumId = await dbClient.db.transaction(async (tx) => {
      const [newMedium] = await tx
        .insert(schema.Media)
        .values(data.medium)
        .returning({ id: schema.Media.id });
      if (!newMedium?.id) {
        throw new Error(
          "Failed to create medium record, rolling back transaction.",
        );
      }

      await tx.insert(schema.EventMedia).values({
        eventId: eventId,
        mediumId: newMedium.id,
        caption: data.caption,
        isFeatured: data.isFeatured,
      });
      return newMedium.id;
    });

    if (data.medium.type === "VIDEO") {
      backfillVideoMetadata(newMediumId, data.medium.externalId).catch(
        (err) => {
          logger.error(
            err,
            `Error backfilling video metadata for medium ID: ${newMediumId}`,
          );
        },
      );
    }

    return newMediumId;
  } catch (err) {
    logger.error(err);
    throw new ApiError(
      "An error occurred while adding the event medium record.",
      500,
    );
  }
}

export async function uploadProjectMedium(
  projectId: string,
  data: AddMediumRecord,
): Promise<string> {
  const project = await dbClient.db.query.Projects.findFirst({
    where: eq(schema.Projects.id, projectId),
    columns: { id: true },
  });

  if (!project) {
    throw new ApiError("Project not found", 404);
  }

  try {
    const newMediumId = await dbClient.db.transaction(async (tx) => {
      const [newMedium] = await tx
        .insert(schema.Media)
        .values(data.medium)
        .returning({ id: schema.Media.id });
      if (!newMedium?.id) {
        throw new Error(
          "Failed to create medium record, rolling back transaction.",
        );
      }

      await tx.insert(schema.ProjectMedia).values({
        projectId: projectId,
        mediumId: newMedium.id,
        caption: data.caption,
        isFeatured: data.isFeatured,
      });
      return newMedium.id;
    });

    if (data.medium.type === "VIDEO") {
      backfillVideoMetadata(newMediumId, data.medium.externalId).catch(
        (err) => {
          logger.error(
            err,
            `Error backfilling video metadata for medium ID: ${newMediumId}`,
          );
        },
      );
    }

    return newMediumId;
  } catch (err) {
    logger.error(err);
    throw new ApiError(
      "An error occurred while adding the event medium record.",
      500,
    );
  }
}

export async function backfillVideoMetadata(
  mediumId: string,
  externalId: string,
): Promise<void> {
  try {
    const fileDetails = await imagekit.getFileDetails(externalId);

    if (!fileDetails.width || !fileDetails.height) {
      throw new Error(`Incomplete metadata from ImageKit for ${externalId}`);
    }

    await dbClient.db
      .update(schema.Media)
      .set({
        width: fileDetails.width,
        height: fileDetails.height,
      })
      .where(eq(schema.Media.id, mediumId));

    logger.info(`Successfully backfilled metadata for medium ID: ${mediumId}`);
  } catch (err) {
    logger.error(
      err,
      `Failed to backfill video metadata for medium ID: ${mediumId}, external ID: ${externalId}`,
    );
    throw err;
  }
}
