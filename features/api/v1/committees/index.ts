import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import {
  validateBody,
  validateFile,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import logger from "@/configs/logger";
import * as committeesHandler from "./committeesHandler";
import filesUpload from "@/shared/middlewares/multipart";
import {
  GetCommitteesQuerySchema,
  GetConstituentCommitteesQuerySchema,
  GetCommitteeLeadershipQuerySchema,
  EnrollCommitteeSchema,
  UnenrollCommitteeSchema,
  GetCommitteeMediaQuerySchema,
  UpdateCommitteeMediumSchema,
  UploadCommitteeFileSchema,
  UploadCommitteeMediumOptionsSchema,
} from "./schemas";
import { Visitors, anyOf, ADMIN, MEMBER } from "@/configs/authorizer";
import z from "zod";

const committeesRouter = Router();

committeesRouter.get(
  "/",
  authorize(Visitors.ALL),
  validateQuery(GetCommitteesQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommittees(req.Query);
      // Cache for 60 seconds
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.get(
  "/constituents/:constituentId",
  authenticate,
  validateParams(z.object({ constituentId: z.uuid("User not found") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasID((req) => req.Params.constituentId),
    ),
  ),
  validateQuery(GetConstituentCommitteesQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommitteesByConstituentId(
        req.Params.constituentId,
        req.Query,
      );
      redisClient
        .setResponseCache(req.CacheKey, response, 60 * 5)
        .catch((err) => {
          logger.error(err, `Failed to set cache for ${req.CacheKey}`);
        });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.get(
  "/:id",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Committee not found") }), 404),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommittee(req.Params.id);
      redisClient
        .setResponseCache(req.CacheKey, response, 60 * 5)
        .catch((err) => {
          logger.error(err, `Failed to set cache for ${req.CacheKey}`);
        });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.get(
  "/:id/leadership",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Committee not found") }), 404),
  validateQuery(GetCommitteeLeadershipQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getLeadership(
        req.Params.id,
        req.Query,
      );
      redisClient
        .setResponseCache(req.CacheKey, response, 60 * 5)
        .catch((err) => {
          logger.error(err, `Failed to set cache for ${req.CacheKey}`);
        });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.post(
  "/:id/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  validateBody(EnrollCommitteeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.enrollToCommittee(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.patch(
  "/:id/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  validateBody(UnenrollCommitteeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.unenrollFromCommittee(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────
// Committee media (Phase 1.3). Chair OR any committee member may write —
// the Media committee in particular uses this to populate the public
// /gallery directly. Reads are public.
// ────────────────────────────────────────────────────────────────────────

committeesRouter.get(
  "/:id/media",
  authenticateLax,
  authorize(Visitors.ALL),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") }), 404),
  validateQuery(GetCommitteeMediaQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommitteeMedia(
        req.Params.id,
        req.Query,
      );
      redisClient.setResponseCache(req.CacheKey, response, 60).catch((err) => {
        logger.error(err, `Failed to set cache for ${req.CacheKey}`);
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.post(
  "/:id/media",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid committee ID") }), 404),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
      Visitors.hasRole((req) => MEMBER.committeeChair(req.Params.id)),
      Visitors.hasRole((req) => MEMBER.committeeMember(req.Params.id)),
    ),
  ),
  filesUpload.mediaUpload.single("file"),
  validateFile(UploadCommitteeFileSchema),
  validateBody(UploadCommitteeMediumOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.uploadCommitteeMedium({
        constituentId: req.User!.constituentId,
        committeeId: req.Params.id,
        file: req.File,
        options: req.Body,
      });
      await redisClient.delCache(`/api/v1/committees/${req.Params.id}`);
      await redisClient.delCache(`/api/v1/committees/${req.Params.id}/media`);
      await redisClient.delCache(`/api/v1/media/public`);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.patch(
  "/:committeeId/media/:mediumId",
  authenticate,
  validateParams(
    z.object({ committeeId: z.uuid(), mediumId: z.uuid() }),
    404,
  ),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
      Visitors.hasRole((req) => MEMBER.committeeChair(req.Params.committeeId)),
      Visitors.hasRole((req) => MEMBER.committeeMember(req.Params.committeeId)),
    ),
  ),
  validateBody(UpdateCommitteeMediumSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.updateCommitteeMedium(
        req.Params.committeeId,
        req.Params.mediumId,
        req.Body,
      );
      await redisClient.delCache(
        `/api/v1/committees/${req.Params.committeeId}/media`,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.delete(
  "/:committeeId/media/:mediumId",
  authenticate,
  validateParams(
    z.object({ committeeId: z.uuid(), mediumId: z.uuid() }),
    404,
  ),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
      Visitors.hasRole((req) => MEMBER.committeeChair(req.Params.committeeId)),
      // Note: members cannot delete other members' uploads. Only chair/admin.
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.deleteCommitteeMedium(
        req.Params.committeeId,
        req.Params.mediumId,
      );
      await redisClient.delCache(
        `/api/v1/committees/${req.Params.committeeId}/media`,
      );
      await redisClient.delCache(`/api/v1/media/public`);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default committeesRouter;
