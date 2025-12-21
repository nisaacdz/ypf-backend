import dbClient from "@/configs/db";
import { imagekit } from "@/configs/fs/cdn";
import schema from "@/db/schema";
import { ApiError } from "@/shared/types";
import { eq } from "drizzle-orm";
import logger from "@/configs/logger";
import { DocumentType } from "../utils";

export type DocumentRecord = {
  externalId: string;
  type: DocumentType;
  size: number;
  uploadedBy?: string;
};

export type AddDocumentRecord = {
  title: string;
  document: DocumentRecord;
};

export async function uploadDocument(data: DocumentRecord) {
  const [newDocument] = await dbClient.db
    .insert(schema.Documents)
    .values(data)
    .returning({ id: schema.Documents.id });
  return newDocument;
}

export async function uploadEventDocument(
  eventId: string,
  data: AddDocumentRecord,
): Promise<string> {
  const event = await dbClient.db.query.Events.findFirst({
    where: eq(schema.Events.id, eventId),
    columns: { id: true },
  });

  if (!event) {
    throw new ApiError("Event not found", 404);
  }

  try {
    const newDocumentId = await dbClient.db.transaction(async (tx) => {
      const [newDocument] = await tx
        .insert(schema.Documents)
        .values(data.document)
        .returning({ id: schema.Documents.id });
      if (!newDocument?.id) {
        throw new Error(
          "Failed to create document record, rolling back transaction.",
        );
      }

      await tx.insert(schema.EventDocuments).values({
        eventId: eventId,
        documentId: newDocument.id,
        title: data.title,
      });
      return newDocument.id;
    });

    return newDocumentId;
  } catch (err) {
    logger.error(err);
    throw new ApiError(
      "An error occurred while adding the event document record.",
      500,
    );
  }
}
