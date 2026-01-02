/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../types";
import logger from "@/configs/logger";
import fs from "fs/promises";

// Helper to cleanup temp files
const cleanupFiles = async (req: Request) => {
  const filesToDelete: string[] = [];

  if (req.file?.path) {
    filesToDelete.push(req.file.path);
  }

  if (req.files) {
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | Express.Multer.File[];

    if (Array.isArray(files)) {
      filesToDelete.push(...files.map((f) => f.path).filter(Boolean));
    } else {
      Object.values(files).forEach((fileArray) => {
        filesToDelete.push(...fileArray.map((f) => f.path).filter(Boolean));
      });
    }
  }

  if (filesToDelete.length > 0) {
    await Promise.allSettled(
      filesToDelete.map(async (path) => {
        try {
          await fs.unlink(path);
        } catch (error) {
          logger.warn(error, `Failed to cleanup temp file: ${path}`);
        }
      })
    );
  }
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (!!req.file || !!req.files) {
    cleanupFiles(req).catch((cleanupErr) => {
      logger.error(cleanupErr, "Error during file cleanup in errorHandler");
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      data: undefined,
      message: err.message,
    });
  }

  logger.error(err.stack);

  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred.",
  });
};
