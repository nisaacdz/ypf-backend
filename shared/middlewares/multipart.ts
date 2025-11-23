import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

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

export const AllowedMimeTypes = {
  "image/png": "PICTURE",
  "image/jpeg": "PICTURE",
  "video/mp4": "VIDEO",
  "video/mov": "VIDEO",
  "video/avi": "VIDEO",
} as Record<string, "PICTURE" | "VIDEO">;

const filesUpload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB limit, refined in validateFile middleware
  fileFilter: (req, file, cb: multer.FileFilterCallback) => {
    if (AllowedMimeTypes[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

export default filesUpload;
