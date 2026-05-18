import { v4 as uuidv4 } from "uuid";
import path from "path";
import sharp from "sharp";

import blobServiceClient, { containerNames } from "@/configs/fs";
import { imagekit } from "@/configs/fs/cdn";
import logger from "@/configs/logger";
import variables from "@/configs/env";

import fs from "fs/promises";
import { AllowedDocumentsMimeTypes } from "../middlewares/multipart";
import { BlobSASPermissions } from "@azure/storage-blob";

const localDocumentPrefix = "local-docs:";
const localDocumentsDir = path.join(process.cwd(), "storage", "docs");

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
  const documentType = AllowedDocumentsMimeTypes[file.mimetype];

  if (shouldUseLocalDocumentStorage()) {
    try {
      await fs.mkdir(localDocumentsDir, { recursive: true });
      const destination = path.join(localDocumentsDir, fileName);
      if (file.path) {
        await fs.copyFile(file.path, destination);
      } else if (file.buffer) {
        await fs.writeFile(destination, file.buffer);
      } else {
        throw new Error("File content missing (no path or buffer)");
      }

      return {
        externalId: `${localDocumentPrefix}${fileName}`,
        type: documentType,
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
      type: documentType,
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
  if (isLocalDocumentExternalId(externalId)) {
    try {
      await fs.unlink(resolveLocalDocumentPath(externalId));
      return true;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((error as any)?.code === "ENOENT") return true;
      logger.error(error, `Failed to delete local document: ${externalId}`);
      return false;
    }
  }

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

export async function generateSignedDocumentPreviewUrl(
  externalId: string,
  options: { expireSeconds: number },
) {
  if (isLocalDocumentExternalId(externalId)) {
    return generateLocalDocumentUrl(externalId);
  }

  const containerClient = blobServiceClient.getContainerClient(
    containerNames.docs,
  );
  const blobClient = containerClient.getBlobClient(externalId);

  const permissions = BlobSASPermissions.parse("r");
  const expiresOn = new Date(Date.now() + 1000 * options.expireSeconds);

  const url = await blobClient.generateSasUrl({
    permissions,
    expiresOn,
  });

  return url;
}

export async function generateSignedDocumentDownloadUrl(
  externalId: string,
  options: { expireSeconds: number },
) {
  if (isLocalDocumentExternalId(externalId)) {
    return `${generateLocalDocumentUrl(externalId)}?download=1`;
  }

  const containerClient = blobServiceClient.getContainerClient(
    containerNames.docs,
  );
  const blobClient = containerClient.getBlobClient(externalId);

  const permissions = BlobSASPermissions.parse("r");
  const expiresOn = new Date(Date.now() + 1000 * options.expireSeconds);

  const url = await blobClient.generateSasUrl({
    permissions,
    expiresOn,
    contentDisposition: "attachment",
  });

  return url;
}

export function isLocalDocumentExternalId(externalId: string): boolean {
  return externalId.startsWith(localDocumentPrefix);
}

export function resolveLocalDocumentPath(externalId: string): string {
  if (!isLocalDocumentExternalId(externalId)) {
    throw new Error("Not a local document external ID");
  }

  const fileName = externalId.slice(localDocumentPrefix.length);
  if (!fileName || fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("Invalid local document external ID");
  }

  return path.join(localDocumentsDir, fileName);
}

function shouldUseLocalDocumentStorage(): boolean {
  return (
    !variables.app.isProduction &&
    variables.services.azure.storageConnectionString.toLowerCase().includes("stub")
  );
}

function generateLocalDocumentUrl(externalId: string): string {
  const host = variables.app.host === "0.0.0.0" ? "localhost" : variables.app.host;
  return `http://${host}:${variables.app.port}/api/v1/files/documents/${encodeURIComponent(externalId)}`;
}
