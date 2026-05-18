import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors, ADMIN, anyOf } from "@/configs/authorizer";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import { audit } from "@/shared/middlewares/audit";
import {
  canAccessTechnical,
  canManageTechnical,
} from "@/shared/services/workspaceAccessService";
import * as systemHandler from "./systemHandler";

/**
 * /api/v1/system — ops surface.
 *
 * Super admins and the Technical Committee can view system telemetry. Super
 * admins and Technical Committee chairs can operate controls. Mutating routes
 * are wrapped in the audit middleware so changes leave a trail in
 * `app.audit_logs`. Health + metrics are read-only and not audited.
 */

const systemRouter = Router();

systemRouter.use(authenticate);

const canViewSystem = anyOf(Visitors.hasRole(ADMIN.SUPER), canAccessTechnical);
const canOperateSystem = anyOf(
  Visitors.hasRole(ADMIN.SUPER),
  canManageTechnical,
);

// ─── Health + metrics ──────────────────────────────────────────────────────

systemRouter.get(
  "/health",
  authorize(canViewSystem),
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
  authorize(canViewSystem),
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
  authorize(canViewSystem),
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
  authorize(canOperateSystem),
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
  authorize(canViewSystem),
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
  authorize(canOperateSystem),
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
  authorize(canOperateSystem),
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
  authorize(canViewSystem),
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
  authorize(canOperateSystem),
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
  authorize(canViewSystem),
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
  authorize(canOperateSystem),
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
  authorize(canOperateSystem),
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
  authorize(canOperateSystem),
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
  authorize(canViewSystem),
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
  authorize(canOperateSystem),
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
  authorize(canOperateSystem),
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
  authorize(canViewSystem),
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
