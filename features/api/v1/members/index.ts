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
  //authenticateLax,
  //authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetMembersQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getMembers(req.Query);
      redisClient.setCache(req.CacheKey, response, 60 * 5).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

membersRouter.get(
  "/:constituentId",
  //authenticateLax,
  //authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ constituentId: z.uuid("Member not found ID") })),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getMember(req.Params.constituentId);
      redisClient.setCache(req.CacheKey, response, 60 * 5).catch((err) => {
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

      redisClient.setCache(req.CacheKey, response, 60 * 60).catch((err) => {
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
      redisClient.setCache(req.CacheKey, response, 60 * 5).catch((err) => {
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
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default membersRouter;
