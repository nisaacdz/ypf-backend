/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { ApiError } from "../types";
import logger from "@/configs/logger";
import fs from "fs/promises";
import multer from "multer";

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
      }),
    );
  }
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (req.file || req.files) {
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

  // Upload problems are the client's to fix. Left unclassified they fell
  // through to the generic 500 below, so a too-large headshot told the
  // applicant "An unexpected error occurred" and nothing else.
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `That file is too large${err.field ? ` (${err.field})` : ""}. Please upload a smaller one.`
        : err.code === "LIMIT_UNEXPECTED_FILE"
          ? `Unexpected file field: ${err.field ?? "unknown"}.`
          : `Upload failed: ${err.message}.`;
    return res.status(400).json({ success: false, data: undefined, message });
  }

  // Postgres errors (from the `postgres` driver) carry the real diagnostic
  // info — table, column, constraint name, severity — outside the basic
  // stack trace. The previous handler only logged `err.stack`, which
  // produced log entries like "Failed query: insert into..." with no
  // hint *why*. Surface the cause chain so future 500s aren't black-box.
  // Standard PostgresError shape: { code, severity, table_name,
  // column_name, constraint_name, detail, hint }.
  if (isPostgresError(err) || isPostgresError(err.cause)) {
    const pg = (isPostgresError(err) ? err : err.cause) as PostgresError;
    logger.error(
      {
        code: pg.code,
        severity: pg.severity,
        table: pg.table_name,
        column: pg.column_name,
        constraint: pg.constraint_name,
        detail: pg.detail,
        hint: pg.hint,
        message: pg.message,
        stack: err.stack,
      },
      "Postgres query failed",
    );

    // Translate common user-recoverable Postgres errors into clean 4xx
    // responses so the UMS shows a useful message instead of a
    // generic "Internal Server Error".
    if (pg.code === "23514") {
      // check_violation — invalid combination of values (e.g. dates
      // out of order, amount negative, etc.)
      return res.status(400).json({
        success: false,
        message: friendlyCheckViolation(pg.constraint_name),
      });
    }
    if (pg.code === "23505") {
      // unique_violation
      return res.status(409).json({
        success: false,
        message: "A record with these values already exists.",
      });
    }
    if (pg.code === "23503") {
      // foreign_key_violation
      return res.status(400).json({
        success: false,
        message: "Referenced record was not found.",
      });
    }
    if (pg.code === "23502") {
      // not_null_violation
      return res.status(400).json({
        success: false,
        message: `Missing required field${pg.column_name ? `: ${pg.column_name}` : ""}.`,
      });
    }
  }

  logger.error({ err, stack: err.stack }, "Unhandled error");

  return res.status(500).json({
    success: false,
    message: "An unexpected error occurred.",
  });
};

type PostgresError = {
  code?: string;
  severity?: string;
  table_name?: string;
  column_name?: string;
  constraint_name?: string;
  detail?: string;
  hint?: string;
  message?: string;
};

function isPostgresError(err: unknown): err is PostgresError {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { code?: unknown }).code === "string" &&
    /^\d{5}$/.test((err as { code: string }).code)
  );
}

// Map well-known constraint names to user-facing messages. Falls back to a
// generic "value out of allowed range" when the constraint name is new.
function friendlyCheckViolation(name?: string): string {
  switch (name) {
    case "projects_schedule_valid":
    case "events_schedule_valid":
      return "End date must be on or after the start date.";
    case "dues_policies_period_valid":
      return "Dues policy period end must be after the start.";
    default:
      return `One or more values are invalid${name ? ` (${name})` : ""}.`;
  }
}
