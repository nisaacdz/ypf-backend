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
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import * as chaptersHandler from "./chaptersHandler";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import logger from "@/configs/logger";
import {
  AssignChapterRoleSchema,
  ChapterRoleParamsSchema,
  CreateChapterSchema,
  GetChaptersQuerySchema,
  UpdateChapterSchema,
  GetConstituentChaptersQuerySchema,
  GetChapterLeadershipQuerySchema,
  EnrollChapterSchema,
  UnenrollChapterSchema,
  GetChapterMediaQuerySchema,
  UpdateChapterMediumSchema,
  UploadChapterFileSchema,
  UploadChapterMediumOptionsSchema,
} from "./schemas";
import { Visitors, MEMBER, anyOf, ADMIN } from "@/configs/authorizer";
import filesUpload from "@/shared/middlewares/multipart";
import z from "zod";

const chaptersRouter = Router();

chaptersRouter.get(
  "/",
  authorize(Visitors.ALL),
  validateQuery(GetChaptersQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapters(req.Query);
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

chaptersRouter.post(
  "/",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  validateBody(CreateChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.createChapter(req.Body);
      await redisClient.delCache("/api/v1/chapters");
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.get(
  "/:id",
  authenticateLax,
  authorize(
    anyOf(
      Visitors.hasProfile("MEMBER", "ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapter(req.Params.id);
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

chaptersRouter.get(
  "/constituents/:constituentId",
  authenticate,
  validateParams(z.object({ constituentId: z.string() }), 404),
  validateQuery(GetConstituentChaptersQuerySchema),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasID((req) => req.Params.constituentId),
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChaptersByConstituentId(
        req.Params.constituentId,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.patch(
  "/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.Params.id)),
    ),
  ),
  validateBody(UpdateChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.updateChapter(
        req.Params.id,
        req.Body,
      );

      // Clear the detail cache
      await redisClient.delCache(`/api/v1/chapters/${req.Params.id}`);
      await redisClient.delCache("/api/v1/chapters");

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.delete(
  "/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.archiveChapter(req.Params.id);
      await redisClient.delCache(`/api/v1/chapters/${req.Params.id}`);
      await redisClient.delCache("/api/v1/chapters");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.get(
  "/:id/leadership",
  authenticateLax,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("MEMBER", "ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  validateQuery(GetChapterLeadershipQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getLeadership(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.post(
  "/:id/enroll",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  validateBody(EnrollChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.enrollToChapter(
        req.Params.id,
        req.Body,
      );
      await redisClient.delCache(`/api/v1/chapters/${req.Params.id}`);
      await redisClient.delCache("/api/v1/chapters");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.patch(
  "/:id/unenroll",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  validateBody(UnenrollChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.unenrollFromChapter(
        req.Params.id,
        req.Body,
      );
      await redisClient.delCache(`/api/v1/chapters/${req.Params.id}`);
      await redisClient.delCache("/api/v1/chapters");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.get(
  "/:id/roles",
  authenticateLax,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  authorize(
    anyOf(
      Visitors.hasProfile("MEMBER", "ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapterRoles(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.put(
  "/:id/roles/:roleAlias",
  authenticate,
  validateParams(ChapterRoleParamsSchema, 404),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.Params.id)),
    ),
  ),
  validateBody(AssignChapterRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.assignChapterRole(
        req.Params.id,
        req.Params.roleAlias,
        req.Body,
      );
      await redisClient.delCache(`/api/v1/chapters/${req.Params.id}`);
      await redisClient.delCache("/api/v1/chapters");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.delete(
  "/:id/roles/:roleAlias",
  authenticate,
  validateParams(ChapterRoleParamsSchema, 404),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.Params.id)),
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.clearChapterRole(
        req.Params.id,
        req.Params.roleAlias,
      );
      await redisClient.delCache(`/api/v1/chapters/${req.Params.id}`);
      await redisClient.delCache("/api/v1/chapters");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ────────────────────────────────────────────────────────────────────────
// Chapter media routes (Phase 1.2). Admin or chapter lead may write; reads
// are public so the home/public site can show chapter hero images.
// ────────────────────────────────────────────────────────────────────────

chaptersRouter.get(
  "/:id/media",
  authenticateLax,
  authorize(Visitors.ALL),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  validateQuery(GetChapterMediaQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapterMedia(
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

chaptersRouter.post(
  "/:id/media",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") }), 404),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.Params.id)),
    ),
  ),
  filesUpload.mediaUpload.single("file"),
  validateFile(UploadChapterFileSchema),
  validateBody(UploadChapterMediumOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.uploadChapterMedium({
        constituentId: req.User!.constituentId,
        chapterId: req.Params.id,
        file: req.File,
        options: req.Body,
      });
      await redisClient.delCache(`/api/v1/chapters/${req.Params.id}`);
      await redisClient.delCache(`/api/v1/chapters/${req.Params.id}/media`);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.patch(
  "/:chapterId/media/:mediumId",
  authenticate,
  validateParams(
    z.object({ chapterId: z.uuid(), mediumId: z.uuid() }),
    404,
  ),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.Params.chapterId)),
    ),
  ),
  validateBody(UpdateChapterMediumSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.updateChapterMedium(
        req.Params.chapterId,
        req.Params.mediumId,
        req.Body,
      );
      await redisClient.delCache(
        `/api/v1/chapters/${req.Params.chapterId}/media`,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.delete(
  "/:chapterId/media/:mediumId",
  authenticate,
  validateParams(
    z.object({ chapterId: z.uuid(), mediumId: z.uuid() }),
    404,
  ),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.Params.chapterId)),
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.deleteChapterMedium(
        req.Params.chapterId,
        req.Params.mediumId,
      );
      await redisClient.delCache(
        `/api/v1/chapters/${req.Params.chapterId}/media`,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default chaptersRouter;
