import { rateLimit as expressRateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";

export function rateLimit({
  windowMs = 15 * 60 * 1000,
  maxRequests,
}: {
  windowMs: number;
  maxRequests: number;
}): RequestHandler {
  return expressRateLimit({
    windowMs,
    limit: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
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
