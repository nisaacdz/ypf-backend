import dbClient from "@/configs/db";
import { imagekit } from "@/configs/fs/cdn";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";
import { eq } from "drizzle-orm";
import logger from "@/configs/logger";
import { MediumType } from "../utils";

export type MediumRecord = {
  externalId: string;
  type: MediumType;
  width: number;
  height: number;
  size: number;
  uploadedBy?: string;
};

export type AddMediumRecord = {
  caption?: string;
  isFeatured: boolean;
  medium: MediumRecord;
};

export async function uploadMedium(data: MediumRecord) {
  const [newMedium] = await dbClient.db
    .insert(schema.Media)
    .values(data)
    .returning({ id: schema.Media.id });
  return newMedium;
}

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

export async function uploadProductMedium(
  productId: string,
  data: AddMediumRecord,
): Promise<string> {
  const product = await dbClient.db.query.Products.findFirst({
    where: eq(schema.Products.id, productId),
    columns: { id: true },
  });

  if (!product) {
    throw new ApiError("Product not found", 404);
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

      // Only one row per product may carry isFeatured=true. If this upload is
      // being flagged featured, clear the flag on any existing featured row.
      if (data.isFeatured) {
        await tx
          .update(schema.ProductMedia)
          .set({ isFeatured: false })
          .where(eq(schema.ProductMedia.productId, productId));
      }

      await tx.insert(schema.ProductMedia).values({
        productId: productId,
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
      "An error occurred while adding the product medium record.",
      500,
    );
  }
}

export async function uploadChapterMedium(
  chapterId: string,
  data: AddMediumRecord,
): Promise<string> {
  const chapter = await dbClient.db.query.Chapters.findFirst({
    where: eq(schema.Chapters.id, chapterId),
    columns: { id: true },
  });

  if (!chapter) {
    throw new ApiError("Chapter not found", 404);
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

      if (data.isFeatured) {
        await tx
          .update(schema.ChapterMedia)
          .set({ isFeatured: false })
          .where(eq(schema.ChapterMedia.chapterId, chapterId));
      }

      await tx.insert(schema.ChapterMedia).values({
        chapterId: chapterId,
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
      "An error occurred while adding the chapter medium record.",
      500,
    );
  }
}

export async function uploadCommitteeMedium(
  committeeId: string,
  data: AddMediumRecord,
): Promise<string> {
  const committee = await dbClient.db.query.Committees.findFirst({
    where: eq(schema.Committees.id, committeeId),
    columns: { id: true },
  });

  if (!committee) {
    throw new ApiError("Committee not found", 404);
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

      if (data.isFeatured) {
        await tx
          .update(schema.CommitteeMedia)
          .set({ isFeatured: false })
          .where(eq(schema.CommitteeMedia.committeeId, committeeId));
      }

      await tx.insert(schema.CommitteeMedia).values({
        committeeId: committeeId,
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
      "An error occurred while adding the committee medium record.",
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
