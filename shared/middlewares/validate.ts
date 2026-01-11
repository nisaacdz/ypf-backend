import { NextFunction, Request, Response } from "express";
import { ApiError } from "../types";
import { fileTypeFromBuffer, fileTypeFromFile } from "file-type";
import z from "zod";

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message ?? "Invalid body.";
      return next(new ApiError(errorMessage, 400));
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
      return next(new ApiError(errorMessage, 400));
    }

    req.Query = result.data;

    return next();
  };
}

export function validateParams<T>(
  schema: z.ZodType<T>,
  statusCode: number = 400,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const errorMessage =
        result.error.issues[0]?.message ?? "Invalid parameters.";
      return next(new ApiError(errorMessage, statusCode));
    }

    req.Params = result.data;

    return next();
  };
}

export function validateFile<T>(schema: z.ZodType<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file && schema.safeParse(undefined).success) {
      return next();
    } else if (!req.file) {
      return next(new ApiError("File is required", 400));
    }

    const meta = {
      size: req.file.size,
      mimeType: req.file.mimetype,
    };

    let actualMimeType;
    if (req.file.path) {
      actualMimeType = await fileTypeFromFile(req.file.path);
    } else if (req.file.buffer) {
      actualMimeType = await fileTypeFromBuffer(req.file.buffer);
    }

    if (!actualMimeType || actualMimeType.mime !== req.file.mimetype) {
      return next(new ApiError("Invalid file content", 400));
    }

    const result = schema.safeParse(meta);

    if (!result.success) {
      const errorMessage = result.error.issues[0]?.message ?? "Invalid file.";
      return next(new ApiError(errorMessage, 400));
    }

    req.File = req.file;
    return next();
  };
}

export function validateFiles<T>(schemas: Record<string, z.ZodType<T>>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let raw = (req.files ?? {}) as unknown as {
      [fieldname: string]: Express.Multer.File[];
    };

    let files = Object.keys(schemas).reduce(
      (ac, b) => ({ ...ac, [b]: raw[b]?.[0] ?? null }),
      {} as Record<string, Express.Multer.File | null>,
    );

    for (let [fileName, schema] of Object.entries(schemas)) {
      let file = files[fileName];
      if (!file && schema.safeParse(undefined).success) {
        continue;
      } else if (!file) {
        return next(new ApiError(`Missing file: ${fileName}`, 400));
      }

      const meta = {
        size: file.size,
        mimeType: file.mimetype,
      };

      let actualMimeType;
      if (file.path) {
        actualMimeType = await fileTypeFromFile(file.path);
      } else if (file.buffer) {
        actualMimeType = await fileTypeFromBuffer(file.buffer);
      }

      if (!actualMimeType || actualMimeType.mime !== file.mimetype) {
        return next(new ApiError("Invalid file content", 400));
      }

      const result = schema.safeParse(meta);

      if (!result.success) {
        const errorMessage = result.error.issues[0]?.message ?? "Invalid file.";
        return next(new ApiError(errorMessage, 400));
      }
    }

    req.Files = files;
    return next();
  };
}
