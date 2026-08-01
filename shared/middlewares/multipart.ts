import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { DocumentTypeEnum, MediumTypeEnum } from "@/db/schema/core";
import { ApiError } from "@/shared/types";

const tempDir = path.join(process.cwd(), "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const fileExtension =
      path.extname(file.originalname) || `.${file.mimetype.split("/")[1]}`;
    cb(null, `${uuidv4()}${fileExtension}`);
  },
});

/**
 * A rejected upload is the applicant's mistake, not a server fault. Throwing a
 * bare Error here meant multer handed the error handler something it couldn't
 * classify, and the public registration form showed "An unexpected error
 * occurred" (500) for something as ordinary as a HEIC photo. ApiError carries
 * the status and a message the user can act on.
 */
export class UnsupportedFileTypeError extends ApiError {
  constructor(fieldName: string, mimetype: string, allowed: string[]) {
    super(
      `Unsupported file type for "${fieldName}"${
        mimetype ? ` (${mimetype})` : ""
      }. Allowed formats: ${allowed.join(", ")}.`,
      400,
    );
  }
}

export const AllowedMediaMimeTypes = {
  "image/png": "PICTURE",
  "image/jpeg": "PICTURE",
  "video/mp4": "VIDEO",
  "video/mov": "VIDEO",
  "video/avi": "VIDEO",
} as Record<string, "PICTURE" | "VIDEO">;

const mediaUpload = multer({
  storage: storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250 MB limit, refined in validateFile middleware
  fileFilter: (req, file, cb: multer.FileFilterCallback) => {
    if (AllowedMediaMimeTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(
        new UnsupportedFileTypeError(file.fieldname, file.mimetype, [
          "PNG",
          "JPG",
          "MP4",
          "MOV",
          "AVI",
        ]),
      );
    }
  },
});

export const AllowedDocumentsMimeTypes: Record<
  string,
  (typeof DocumentTypeEnum.enumValues)[number]
> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOC",
  "image/png": "IMAGE",
  "image/jpeg": "IMAGE",
  "image/jpg": "IMAGE",
  // Phones and screenshot tools hand out WebP by default now. sharp reads it,
  // so there's no reason to bounce a headshot for it.
  "image/webp": "IMAGE",
  "application/vnd.ms-excel": "SPREADSHEET",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "SPREADSHEET",
  "application/vnd.ms-powerpoint": "PRESENTATION",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PRESENTATION",
};

export const documentsUpload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit for docs
  fileFilter: (req, file, cb: multer.FileFilterCallback) => {
    if (Object.keys(AllowedDocumentsMimeTypes).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new UnsupportedFileTypeError(file.fieldname, file.mimetype, [
          "PDF",
          "DOC",
          "DOCX",
          "PNG",
          "JPG",
          "WEBP",
        ]),
      );
    }
  },
});

const filesUpload = {
  mediaUpload,
  documentsUpload,
};

export default filesUpload;
