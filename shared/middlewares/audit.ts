import { NextFunction, Request, Response } from "express";
import * as systemService from "@/shared/services/systemService";

/**
 * Records an audit_log row after a request completes. Capture is best-effort —
 * a DB failure on the audit insert is logged but never blocks the response.
 *
 * Mount AFTER `authenticate` so `req.User` is populated. The middleware
 * extracts metadata from `req.Body` (already validated by validate middleware)
 * and `req.params`. Listeners can override the captured action/target by
 * setting `res.locals.audit = { action, target, metadata }` from a handler.
 */
export function audit(defaults: { action: string; target?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      // Only audit successful mutating requests. Failed requests already show
      // up in the error log; auditing them would inflate noise.
      if (res.statusCode >= 400) return;

      const overrides = (res.locals.audit ?? {}) as {
        action?: string;
        target?: string;
        metadata?: unknown;
      };

      void systemService.recordAudit({
        actorId: req.User?.constituentId ?? null,
        actorEmail: req.User?.email ?? null,
        action: overrides.action ?? defaults.action,
        target:
          overrides.target ??
          defaults.target ??
          buildTarget(req),
        metadata:
          overrides.metadata ??
          (req.Body && Object.keys(req.Body ?? {}).length > 0
            ? sanitizeBody(req.Body)
            : null),
        sourceIp:
          (req.headers["x-forwarded-for"] as string | undefined)
            ?.split(",")[0]
            ?.trim() ?? req.socket.remoteAddress ?? null,
        userAgent: req.headers["user-agent"] ?? null,
        statusCode: res.statusCode,
      });
    });
    next();
  };
}

function buildTarget(req: Request): string {
  const params = req.params;
  const id =
    params.id ?? params.jobId ?? params.key ?? params.name ?? undefined;
  return id ? `${req.method} ${req.baseUrl}${req.route?.path ?? ""} :: ${id}` : `${req.method} ${req.originalUrl}`;
}

// Strip likely-sensitive fields before persisting the body in the audit log.
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const REDACT = new Set([
    "password",
    "newPassword",
    "currentPassword",
    "token",
    "accessToken",
    "secret",
  ]);
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    clone[k] = REDACT.has(k) ? "[REDACTED]" : v;
  }
  return clone;
}
