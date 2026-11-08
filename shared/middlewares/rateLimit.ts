import { rateLimit as expressRateLimit } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import variables from "@/configs/env";

export function rateLimit({
  windowMs = 15 * 60 * 1000,
  maxRequests,
  skip,
}: {
  windowMs: number;
  maxRequests: number;
  /** Return true to exempt a request from this limiter. */
  skip?: (req: Request) => boolean;
}): RequestHandler {
  if (!variables.app.isProduction) {
    return (req, res, next) => next();
  }

  return expressRateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    ...(skip ? { skip } : {}),
    handler: (req, res) => {
      const response = {
        success: false,
        data: null,
        message: "Too many requests, please try again later.",
      };
      res.status(429).send(response);
    },
  });
}
