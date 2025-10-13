import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";

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

    return newMediumId;
  } catch (err) {
    console.error(err);
    throw new AppError(
      "An error occurred while adding the event medium record.",
      500,
    );
  }
}
