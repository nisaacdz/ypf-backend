import { UploadApiResponse, UploadApiOptions } from "cloudinary";
import streamifier from "streamifier";
import storage from "@/configs/fs";
import { AllowedMimeTypes } from "../middlewares/multipart";

export interface MediaMeta {
  externalId: string; // cloudinary public_id
  url: string; // delivered url (secure)
  type: "PICTURE" | "VIDEO";
  dimensions: {
    width: number;
    height: number;
  };
  sizeInBytes: number;
}

export async function storeMediumFile(
  file: Express.Multer.File,
  folder = "my_app_uploads",
): Promise<MediaMeta> {
  if (!file || !file.buffer) throw new Error("No file buffer provided");

  const uploadOptions: UploadApiOptions = {
    folder,
    resource_type: file.mimetype.startsWith("video/") ? "video" : "image",
    chunk_size: 6000000,
  };

  const result: UploadApiResponse = await new Promise((resolve, reject) => {
    const uploadStream = storage.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      },
    );
    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });

  return {
    externalId: result.public_id,
    url: result.secure_url,
    type: AllowedMimeTypes[file.mimetype],
    dimensions: {
      width: result.width,
      height: result.height,
    },
    sizeInBytes: result.bytes,
  };
}

export async function deleteMediumFile(
  publicId: string,
  resourceType: "image" | "video" = "image",
): Promise<boolean> {
  const result = await storage.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
  return result.result === "ok" || result.result === "not_found";
}

export function generateMediaUrl(
  publicId: string,
  options: { resolution?: number; crop?: "scale" | "fit" | "limit" } = {
    resolution: 1080,
    crop: "scale",
  },
) {
  const transformationOptions = {
    secure: true,
    transformation: [{ width: options.resolution, crop: options.crop }],
  };

  return storage.url(publicId, transformationOptions);
}
