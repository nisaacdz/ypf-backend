import pgPool from "@/configs/db";
import { imagekit } from "@/configs/fs/cdn";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";
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
    sizeInBytes: number;
    uploadedBy: string;
  };
};

export async function uploadEventMedium(
  eventId: string,
  data: AddMediumRecord,
): Promise<string> {
  try {
    const newMediumId = await pgPool.db.transaction(async (tx) => {
      const [newMedium] = await tx
        .insert(schema.Medium)
        .values(data.medium)
        .returning({ id: schema.Medium.id });
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
    throw new AppError(
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

    await pgPool.db
      .update(schema.Medium)
      .set({
        width: fileDetails.width,
        height: fileDetails.height,
      })
      .where(eq(schema.Medium.id, mediumId));

    logger.info(`Successfully backfilled metadata for medium ID: ${mediumId}`);
  } catch (err) {
    logger.error(
      err,
      `Failed to backfill video metadata for medium ID: ${mediumId}, external ID: ${externalId}`,
    );
    throw err;
  }
}
