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

/**
 * Sniffing the bytes catches a .exe renamed to .pdf, but demanding the sniffed
 * mime *string-match* the browser's rejects legitimate files: Word 97-2003
 * documents are OLE2 containers (application/x-cfb), OOXML files are ZIP
 * containers, and some platforms label JPEGs "image/jpg". Those uploads were
 * failing with "Invalid file content". Accept the known-equivalent pairs.
 */
const EQUIVALENT_MIME_TYPES: Record<string, string[]> = {
  "application/msword": ["application/x-cfb"],
  "application/vnd.ms-excel": ["application/x-cfb"],
  "application/vnd.ms-powerpoint": ["application/x-cfb"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "application/zip",
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    "application/zip",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "application/zip",
  ],
  "image/jpg": ["image/jpeg"],
  "image/jpeg": ["image/jpg"],
};

function contentMatchesDeclaredType(
  declaredMimeType: string,
  sniffedMimeType: string | undefined,
): boolean {
  if (!sniffedMimeType) return false;
  if (sniffedMimeType === declaredMimeType) return true;
  return (
    EQUIVALENT_MIME_TYPES[declaredMimeType]?.includes(sniffedMimeType) ?? false
  );
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

    if (!contentMatchesDeclaredType(req.file.mimetype, actualMimeType?.mime)) {
      return next(
        new ApiError(
          "The file's contents don't match its type. Please re-save it as a PDF, DOCX, PNG or JPG and try again.",
          400,
        ),
      );
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

      if (!contentMatchesDeclaredType(file.mimetype, actualMimeType?.mime)) {
        return next(
          new ApiError(
            `The file uploaded for "${fileName}" doesn't match its type. Please re-save it as a PDF, DOCX, PNG or JPG and try again.`,
            400,
          ),
        );
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
