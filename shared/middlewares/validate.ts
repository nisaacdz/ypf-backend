import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import { fileTypeFromBuffer } from "file-type";
import z from "zod";

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message ?? "Invalid body.";
      return next(new AppError(errorMessage, 400));
    }

    req.Body = result.data;

    return next();
  };
}

export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message ?? "Invalid query.";
      return next(new AppError(errorMessage, 400));
    }

    req.Query = result.data;

    return next();
  };
}

export function validateParams<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const errorMessage =
        result.error.issues[0]?.message ?? "Invalid parameters.";
      return next(new AppError(errorMessage, 400));
    }

    req.Params = result.data;

    return next();
  };
}

export function validateFile<T>(schema: z.ZodType<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      return next(new AppError("File is required", 400));
    }
    const meta = {
      size: req.file.size,
      mimeType: req.file.mimetype,
    };

    const actualMimeType = await fileTypeFromBuffer(req.file.buffer);

    if (!actualMimeType || actualMimeType.mime !== req.file.mimetype) {
      return next(new AppError("Invalid file content", 400));
    }

    const result = schema.safeParse(meta);

    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message ?? "Invalid file.";
      return next(new AppError(errorMessage, 400));
    }

    req.File = req.file;
    return next();
  };
}
