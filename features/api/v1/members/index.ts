import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import redisClient from "@/configs/redis";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import {
  validateQuery,
  validateParams,
  validateBody,
} from "@/shared/middlewares/validate";
import * as membersHandler from "./membersHandler";
import {
  GetMembersQuerySchema,
  EnrollMemberSchema,
  UnenrollMemberSchema,
  EnrollRoleSchema,
  UnenrollRoleSchema,
  GetRolesQuerySchema,
  GetLeadershipQuerySchema,
} from "./schemas";
import { Visitors, ADMIN, MEMBER, anyOf } from "@/configs/authorizer";
import z from "zod";
import logger from "@/configs/logger";

const membersRouter = Router();

membersRouter.get(
  "/",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetMembersQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getMembers(req.Query);
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// IMPORTANT: static routes (/stats, /export.csv, /roles, /leadership) MUST
// be declared BEFORE the catch-all /:constituentId — otherwise Express
// matches them as a UUID param, validateParams rejects them as not-a-UUID,
// and the request 404s. The People page's /members/stats fetch failed
// exactly this way before the reorder.

// Whole-org KPI snapshot for the People page. Drawn off the entire dataset
// so the dashboard cards stay accurate regardless of pagination or search.
membersRouter.get(
  "/stats",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getMemberStats();
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// CSV export of the current members list. Honors the same query filters as
// GET /members so admins can "Export what I'm seeing." Streams direct to
// the response — never materialises the full list in memory.
membersRouter.get(
  "/export.csv",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetMembersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await membersHandler.exportMembersCsv(req.Query, res);
    } catch (err) {
      next(err);
    }
  },
);

membersRouter.get(
  "/:constituentId",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ constituentId: z.uuid("Member not found") }), 404),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getMember(req.Params.constituentId);
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

membersRouter.post(
  "/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(EnrollMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.enrollMember(req.Body);
      // Clear member list cache
      await redisClient.delCache("/api/v1/members");
      await redisClient.delCache("/api/v1/members/leadership");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

membersRouter.patch(
  "/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(UnenrollMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.unenrollMember(req.Body);
      await redisClient.delCache("/api/v1/members");
      await redisClient.delCache("/api/v1/members/leadership");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

membersRouter.get(
  "/roles",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER)),
  ),
  validateQuery(GetRolesQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getRoles(req.Query);

      redisClient
        .setResponseCache(req.CacheKey, response, 60 * 60)
        .catch((err) => {
          logger.error(err, `Failed to set cache for ${req.CacheKey}`);
        });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

membersRouter.get(
  "/leadership",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER)),
  ),
  validateQuery(GetLeadershipQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getLeadership(req.Query);
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

membersRouter.post(
  "/roles/:id/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid role ID") })),
  validateBody(EnrollRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.enrollRole(req.Params.id, req.Body);
      await redisClient.delCache(`/api/v1/members/${req.Body.constituentId}`);
      await redisClient.delCache("/api/v1/members/leadership");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

membersRouter.patch(
  "/roles/:id/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid role ID") })),
  validateBody(UnenrollRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.unenrollRole(
        req.Params.id,
        req.Body,
      );
      await redisClient.delCache(`/api/v1/members/${req.Body.constituentId}`);
      await redisClient.delCache("/api/v1/members/leadership");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default membersRouter;
