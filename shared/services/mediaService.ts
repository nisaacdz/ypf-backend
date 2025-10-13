import pgPool from "@/configs/db";
import schema from "@/db/schema";
import { AppError } from "@/shared/types";

export type MediaUploadResult = {
  externalRef: string;
  type: "PICTURE" | "VIDEO";
  dimensions: {
    width: number;
    height: number;
  };
  sizeInBytes: number;
};

export type AddMediaRecord = {
  externalId: string;
  type: "PICTURE" | "VIDEO";
  width: number;
  height: number;
  sizeInBytes: number;
  uploadedBy: string;
};

// accept the file input of the right type (from request)
// could be image or video of types [png, jpg, jpeg, mp4, mov, avi]
// assume file type and size already validated (e.g., max 450MB for video, 50MB for image)
// upload the file (validate with sdk on storage server side for video/picture)
export async function uploadMediaToStorage(): Promise<MediaUploadResult> {
  // 
  return null as any;
}

export async function addMediaRecordToDB(data: AddMediaRecord) {
  try {
    await pgPool.db.insert(schema.Medium).values(data);
  } catch (err) {
    console.error(err);
    throw new AppError("An error occurred while uploading your media", 500);
  }
}
