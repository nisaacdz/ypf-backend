import { NextFunction, Request, Response } from "express";
import * as systemService from "@/shared/services/systemService";
import logger from "@/configs/logger";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Paths that are ALWAYS allowed through, even when maintenance mode is on.
 * Without these, a super admin whose session expires during maintenance can't
 * log back in to disable the flag — total lockout. Webhooks pass too because
 * Paystack will keep retrying and we don't want to lose receipts.
 *
 * Match is on `req.path` after the /api/v1 prefix is stripped by the router,
 * so `/auth/login` matches `/auth/*`.
 */
const ALWAYS_ALLOW_PREFIXES = [
  "/auth/", // login, logout, refresh, password reset
  "/system/", // super admin needs to disable the flag itself
  "/webhooks/", // payment provider callbacks — never block these
];

export async function maintenanceGate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method)) return next();

  if (ALWAYS_ALLOW_PREFIXES.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // The maintenance flag is read from a Redis-cached settings row; this is
  // ~sub-millisecond once warm and only ~5ms on a cold read.
  try {
    const mode = await systemService.getMaintenanceMode();
    if (!mode.enabled) return next();
  } catch (err) {
    // If we can't read the flag (DB outage during deploy?), fail open — the
    // alternative would block all writes including the flag-disable call.
    logger.warn({ err }, "maintenanceGate: failed to read flag, allowing write");
    return next();
  }

  // Super admins always pass — backup path in case the request lands here
  // (e.g. cookie-authed mutation outside the allow list).
  const isSuperAdmin = req.User?.roles?.includes("ADMIN.SUPER_ADMIN") ?? false;
  if (isSuperAdmin) return next();

  return res.status(503).json({
    success: false,
    message: "Service is in maintenance mode. Writes are temporarily disabled.",
  });
}
