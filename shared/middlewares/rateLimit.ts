import { rateLimit as expressRateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";

/**
 * Creates a rate limiting middleware that restricts the number of requests
 * a client can make within a 1-hour window.
 *
 * @param maxRequests - The maximum number of requests allowed within the 1-hour window
 * @returns Express middleware that enforces rate limiting
 *
 * @example
 * ```typescript
 * // Allow 100 requests per hour
 * router.post("/api/endpoint", rateLimit(100), handler);
 *
 * // Allow 10 requests per hour for stricter endpoints
 * router.post("/api/sensitive", rateLimit(10), handler);
 * ```
 */
export function rateLimit(maxRequests: number): RequestHandler {
  return expressRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    limit: maxRequests,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: "Too many requests, please try again later.",
    statusCode: 429,
  });
}
