import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors, ADMIN } from "@/configs/authorizer";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import { audit } from "@/shared/middlewares/audit";
import * as systemHandler from "./systemHandler";

/**
 * /api/v1/system — super-admin-only ops surface.
 *
 * Every route requires `ADMIN.SUPER_ADMIN`. Mutating routes are wrapped in
 * the audit middleware so changes leave a trail in `app.audit_logs`. Health
 * + metrics are read-only and not audited (would just inflate noise).
 */

const systemRouter = Router();

systemRouter.use(authenticate);
systemRouter.use(authorize(Visitors.hasRole(ADMIN.SUPER)));

// ─── Health + metrics ──────────────────────────────────────────────────────

systemRouter.get(
  "/health",
  validateQuery(
    z.object({
      fresh: z
        .string()
        .optional()
        .transform((v) => v === "true" || v === "1"),
    }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.health(Boolean(req.Query?.fresh));
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.get(
  "/metrics",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.metrics();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.get(
  "/surface",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.surface();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Integration probes ────────────────────────────────────────────────────

systemRouter.post(
  "/integrations/:name/test",
  validateParams(
    z.object({
      name: z.enum([
        "database",
        "redis",
        "queue",
        "smtp",
        "imagekit",
        "paystack",
        "azure-blob",
      ]),
    }),
  ),
  audit({ action: "system.integration.probe" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.probeOne(req.Params.name);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Job queue ─────────────────────────────────────────────────────────────

systemRouter.get(
  "/jobs/failed",
  validateQuery(
    z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.listFailedJobs(req.Query.limit);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.post(
  "/jobs/:queue/:jobId/retry",
  validateParams(z.object({ queue: z.string(), jobId: z.string().uuid() })),
  audit({ action: "system.job.retry" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.retryJob(
        req.Params.queue,
        req.Params.jobId,
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.post(
  "/jobs/:queue/:jobId/cancel",
  validateParams(z.object({ queue: z.string(), jobId: z.string().uuid() })),
  audit({ action: "system.job.cancel" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.cancelJob(
        req.Params.queue,
        req.Params.jobId,
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Maintenance mode ──────────────────────────────────────────────────────

systemRouter.get(
  "/maintenance",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.getMaintenance();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.put(
  "/maintenance",
  validateBody(
    z.object({
      enabled: z.boolean(),
      message: z.string().max(500).nullable().optional(),
    }),
  ),
  audit({ action: "system.maintenance.update" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.setMaintenance(req.User!, req.Body);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Per-committee maintenance (notice-only) ──────────────────────────────

systemRouter.get(
  "/maintenance/committees",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.listCommitteeMaintenance();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.put(
  "/maintenance/committees/:id",
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(z.object({ message: z.string().max(500).nullable().optional() })),
  audit({ action: "system.maintenance.committee.update" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.setCommitteeMaintenance(
        req.User!,
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.delete(
  "/maintenance/committees/:id",
  validateParams(z.object({ id: z.string().uuid() })),
  audit({ action: "system.maintenance.committee.clear" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.clearCommitteeMaintenance(
        req.Params.id,
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.post(
  "/maintenance/committees/bulk",
  validateBody(
    z.object({
      committeeIds: z.array(z.string().uuid()).min(1).max(100),
      action: z.enum(["enable", "disable"]),
      message: z.string().max(500).nullable().optional(),
    }),
  ),
  audit({ action: "system.maintenance.committee.bulk" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.bulkCommitteeMaintenance(
        req.User!,
        req.Body,
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Feature flags ─────────────────────────────────────────────────────────

systemRouter.get(
  "/flags",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.getFlags();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.put(
  "/flags/:key",
  validateParams(
    z.object({
      key: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[a-z0-9_-]+$/i, "Flag key must be alphanumeric (with _ or -)"),
    }),
  ),
  validateBody(z.object({ enabled: z.boolean() })),
  audit({ action: "system.flag.update" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.setFlag(
        req.User!,
        req.Params.key,
        req.Body.enabled,
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

systemRouter.delete(
  "/flags/:key",
  validateParams(z.object({ key: z.string().min(1).max(64) })),
  audit({ action: "system.flag.delete" }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.deleteFlag(
        req.User!,
        req.Params.key,
      );
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ─── Audit log ─────────────────────────────────────────────────────────────

systemRouter.get(
  "/audit",
  validateQuery(
    z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      actorId: z.string().uuid().optional(),
      action: z.string().max(64).optional(),
    }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await systemHandler.listAudit(req.Query);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default systemRouter;
