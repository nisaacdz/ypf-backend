import { v4 as uuidv4 } from "uuid";
import path from "path";
import sharp from "sharp";
import { BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol, StorageSharedKeyCredential } from "@azure/storage-blob";

import blobServiceClient, { containerNames } from "@/configs/fs";
import { imagekit } from "@/configs/fs/cdn";
import logger from "@/configs/logger";
import variables from "@/configs/env";

import fs from "fs/promises";
import { AllowedDocumentsMimeTypes } from "../middlewares/multipart";

export type MediaMeta = {
  externalId: string;
  type: "PICTURE" | "VIDEO";
  width: number;
  height: number;
  size: number;
};

export type DocumentsMeta = {
  externalId: string;
  type: "PDF" | "DOC" | "SPREADSHEET" | "PRESENTATION" | "IMAGE" | "OTHER";
  size: number;
};

export async function storeMediumFile(
  file: Express.Multer.File,
): Promise<MediaMeta> {
  const isVideo = file.mimetype.startsWith("video/");
  const fileExtension =
    path.extname(file.originalname) || `.${file.mimetype.split("/")[1]}`;
  const fileName = `${uuidv4()}${fileExtension}`;
  const blobName = `${file.mimetype.split("/")[0]}/${fileName}`;

  const containerClient = blobServiceClient.getContainerClient(
    containerNames.media,
  );
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  try {
    if (file.path) {
      await blockBlobClient.uploadFile(file.path, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });
    } else if (file.buffer) {
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });
    } else {
      throw new Error("File content missing (no path or buffer)");
    }

    let dimensions: { width: number; height: number };

    if (isVideo) {
      // imagekit may not yet be aware of new uploads or may be too slow; likely the latter
      // const fileDetails = await imagekit.getFileDetails(blobName);
      // const { width, height } = fileDetails;
      dimensions = { width: 0, height: 0 };
    } else {
      const input = file.path || file.buffer;
      const imageMeta = await sharp(input).metadata();
      dimensions = { width: imageMeta.width!, height: imageMeta.height! };
    }

    return {
      externalId: blobName,
      type: isVideo ? "VIDEO" : "PICTURE",
      ...dimensions,
      size: file.size,
    };
  } finally {
    if (file.path) {
      try {
        await fs.unlink(file.path);
      } catch (err) {
        logger.error(err, `Failed to delete temp file: ${file.path}`);
      }
    }
  }
}

// Assumption, this file must be an allowed document (size and mimetype)
export async function storeDocumentFile(
  file: Express.Multer.File,
): Promise<DocumentsMeta> {
  const fileExtension =
    path.extname(file.originalname) || `.${file.mimetype.split("/")[1]}`;
  const fileName = `${uuidv4()}${fileExtension}`;
  const blobName = `${file.mimetype.split("/")[0]}/${fileName}`;

  const containerClient = blobServiceClient.getContainerClient(
    containerNames.docs,
  );
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  try {
    if (file.path) {
      await blockBlobClient.uploadFile(file.path, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });
    } else if (file.buffer) {
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });
    } else {
      throw new Error("File content missing (no path or buffer)");
    }

    return {
      externalId: blobName,
      type: AllowedDocumentsMimeTypes[file.mimetype],
      size: file.size,
    };
  } finally {
    if (file.path) {
      try {
        await fs.unlink(file.path);
      } catch (err) {
        logger.error(err, `Failed to delete temp file: ${file.path}`);
      }
    }
  }
}

export async function deleteMediumFile(externalId: string): Promise<boolean> {
  try {
    const containerClient = blobServiceClient.getContainerClient(
      containerNames.media,
    );
    const blockBlobClient = containerClient.getBlockBlobClient(externalId);
    await blockBlobClient.delete();
    return true;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (error && (error as any).statusCode === 404) {
      logger.warn(
        `Blob not found during deletion, treating as success: ${externalId}`,
      );
      return true;
    }
    logger.error(error, `Failed to delete blob: ${externalId}`);
    return false;
  }
}

export async function deleteDocumentFile(externalId: string): Promise<boolean> {
  try {
    const containerClient = blobServiceClient.getContainerClient(
      containerNames.docs,
    );
    const blockBlobClient = containerClient.getBlockBlobClient(externalId);
    await blockBlobClient.delete();
    return true;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (error && (error as any).statusCode === 404) {
      logger.warn(
        `Blob not found during deletion, treating as success: ${externalId}`,
      );
      return true;
    }
    logger.error(error, `Failed to delete blob: ${externalId}`);
    return false;
  }
}

/**
 * Generates a URL for a video thumbnail using ImageKit's on-the-fly processing.
 * @param externalId The path to the video file in storage.
 * @param second The time in the video to capture the thumbnail from (e.g., 5 for 5s mark).
 */
export function generateVideoThumbnailUrl(
  externalId: string,
  second: number = 5,
): string {
  return imagekit.url({
    path: externalId,
    transformation: [
      {
        height: "400",
        aspectRatio: "16-9",
        crop: "pad_resize",
        background: "000000",
        t: second.toString(),
      },
    ],
  });
}

export function generatePublicMediaUrl(
  externalId: string,
  options: { resolution?: number } = {},
): string {
  const transformations = [];
  if (options.resolution) {
    transformations.push({ width: options.resolution.toString() });
  }

  return imagekit.url({
    path: externalId,
    transformation: transformations,
  });
}

export function generatePublicDocumentUrl(externalId: string): string {
  return imagekit.url({
    path: externalId,
  });
}

export function generateSignedMediaUrl(
  externalId: string,
  options: { resolution?: number; expireSeconds: number },
): string {
  const transformations = [];
  if (options.resolution) {
    transformations.push({ width: options.resolution.toString() });
  }

  return imagekit.url({
    path: externalId,
    expireSeconds: options.expireSeconds,
    transformation: transformations,
    signed: true,
  });
}

export function generateBlobSASUrl(
  containerName: string,
  blobName: string,
  expireMinutes: number = 60,
): string {
  // Extract account name and key from connection string
  const connectionString = variables.services.azure.connectionString;
  const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
  const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);

  if (!accountNameMatch || !accountKeyMatch) {
    throw new Error("Invalid Azure Storage connection string");
  }

  const accountName = accountNameMatch[1];
  const accountKey = accountKeyMatch[1];

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlockBlobClient(blobName);

  const expiresOn = new Date();
  expiresOn.setMinutes(expiresOn.getMinutes() + expireMinutes);

  const sasOptions = {
    containerName,
    blobName,
    expiresOn,
    permissions: BlobSASPermissions.parse("r"), // read permission only
    protocol: SASProtocol.Https,
  };

  const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();

  return `${blobClient.url}?${sasToken}`;
}

export function generateMediaBlobUrl(externalId: string, expireMinutes: number = 60): string {
  if (!externalId || typeof externalId !== 'string') {
    throw new Error('Invalid externalId provided for media blob URL generation');
  }
  return generateBlobSASUrl(containerNames.media, externalId, expireMinutes);
}

export function generateDocumentBlobUrl(externalId: string, expireMinutes: number = 60): string {
  if (!externalId || typeof externalId !== 'string') {
    throw new Error('Invalid externalId provided for document blob URL generation');
  }
  return generateBlobSASUrl(containerNames.docs, externalId, expireMinutes);
}
