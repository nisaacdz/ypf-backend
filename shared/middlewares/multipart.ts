import multer from "multer";

const storage = multer.memoryStorage();

const filesUpload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB limit, refined in validateFile middleware
  fileFilter: (req, file, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
      "image/png",
      "image/jpg",
      "image/jpeg",
      "video/mp4",
      "video/mov",
      "video/avi",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

export default filesUpload;
