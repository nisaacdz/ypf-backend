import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { DocumentTypeEnum, MediumTypeEnum } from "@/db/schema/core";

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
      cb(new Error("Invalid file type"));
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
      cb(new Error("Invalid document file type"));
    }
  },
});

const filesUpload = {
  mediaUpload,
  documentsUpload,
};

export default filesUpload;
