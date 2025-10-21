import { v4 as uuidv4 } from "uuid";
import path from "path";
import sharp from "sharp";

import blobServiceClient, { containerName } from "@/configs/fs";
import { imagekit } from "@/configs/fs/cdn";

export interface MediaMeta {
  externalId: string;
  type: "PICTURE" | "VIDEO";
  dimensions: {
    width: number;
    height: number;
  };
  sizeInBytes: number;
}

export async function storeMediumFile(
  file: Express.Multer.File,
): Promise<MediaMeta> {
  const isVideo = file.mimetype.startsWith("video/");
  const fileExtension =
    path.extname(file.originalname) || `.${file.mimetype.split("/")[1]}`;
  const fileName = `${uuidv4()}${fileExtension}`;
  const blobName = `${file.mimetype.split("/")[0]}/${fileName}`;

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  let dimensions: { width: number; height: number };

  if (isVideo) {
    // imagekit may not yet be aware of new uploads or may be too slow; likely the latter
    // const fileDetails = await imagekit.getFileDetails(blobName);
    // const { width, height } = fileDetails;
    dimensions = { width: 0, height: 0 };
  } else {
    const imageMeta = await sharp(file.buffer).metadata();
    dimensions = { width: imageMeta.width, height: imageMeta.height };
  }

  return {
    externalId: blobName,
    type: isVideo ? "VIDEO" : "PICTURE",
    dimensions: dimensions,
    sizeInBytes: file.size,
  };
}

export async function deleteMediumFile(externalId: string): Promise<boolean> {
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(externalId);
    await blockBlobClient.delete();
    return true;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (error && (error as any).statusCode === 404) {
      console.warn(
        `Blob not found during deletion, treating as success: ${externalId}`,
      );
      return true;
    }
    console.error(`Failed to delete blob: ${externalId}`, error);
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
