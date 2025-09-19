import { NextFunction, Request, Response } from "express";
import envConfig from "../../configs/env";
import { AppError } from "../types";

const allowedClients = [
  "dashboard",
  "website",
  "tool",
  "mobile",
  ...(envConfig.isProduction ? [] : ["postman"]),
];

// bounce unallowed origins and clients
export default async function bounce(
  req: { headers: { [key: string]: unknown } },
  next: (err?: Error | undefined) => void,
) {
  const client = req.headers["x-client"];

  if (
    !client ||
    typeof client !== "string" ||
    !allowedClients.includes(client)
  ) {
    return next(new AppError("Unauthorized", 403));
  }

  const origin = String(req.headers.origin);
  if (
    envConfig.allowedOrigins &&
    origin &&
    !envConfig.allowedOrigins.includes(origin)
  ) {
    return next(new AppError("CORS Error: This origin is not allowed", 403));
  }

  next();
}
