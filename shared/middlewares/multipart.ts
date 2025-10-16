import multer from "multer";
const storage = multer.memoryStorage();

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
