import { NextFunction, Request, Response } from "express";
import { AppError } from "../types";
import { decodeData } from "../utils/jwt";
import { AuthTokenValidationSchema } from "../validators";
import policyConfig from "@/configs/policy";
import envConfig from "@/configs/env";

const allowedClients = [
  "dashboard",
  "website",
  "tool",
  "mobile",
  ...(envConfig.isProduction ? [] : ["postman"]),
];

export async function filter(
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

export function authenticate(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    return next();
  }

  const token = req.cookies.auth_token;

  if (!token) {
    return next(
      new AppError("You are not logged in. Please log in to get access.", 401),
    );
  }

  const decodedUser = decodeData(token, AuthTokenValidationSchema);

  if (!decodedUser) {
    return next(new AppError("Invalid token. Please log in again.", 401));
  }

  req.user = decodedUser;

  next();
}

export async function authorize(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return next(new AppError("User not authenticated", 401));
  }

  const isAuthorized = await policyConfig.enforce(
    req.user,
    req.path,
    req.method, // todo
  );

  if (!isAuthorized) {
    return next(new AppError("User not authorized", 403));
  }

  next();
}
