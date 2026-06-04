import { NextFunction, Request, Response, Router } from "express";
import {
  validateQuery,
  validateParams,
  validateBody,
} from "@/shared/middlewares/validate";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import logger from "@/configs/logger";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors, MEMBER, anyOf } from "@/configs/authorizer";
import { canManageProgramsRecords } from "@/shared/services/workspaceAccessService";
import {
  GetPublicMediaQuerySchema,
  GalleryMediumParamsSchema,
  UpdateGalleryMediumSchema,
} from "./schemas";
import * as mediaHandler from "./mediaHandler";

const mediaRouter = Router();

const canManageGallery = authorize(
  anyOf(
    Visitors.hasProfile("ADMIN"),
    Visitors.hasRole(MEMBER.PRESIDENT),
    canManageProgramsRecords,
  ),
);

// Invalidate the cached public gallery after any mutation.
async function clearGalleryCache() {
  await redisClient.delCache("/api/v1/media/public").catch(() => {});
}

// Public gallery (plan §8.6) — UNION over project/event/chapter/committee
// media. Cached 60s; cache key is built per-query by redisCacheEarlyReturn.
mediaRouter.get(
  "/public",
  authorize(Visitors.ALL),
  validateQuery(GetPublicMediaQuerySchema),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await mediaHandler.getPublicMedia(req.Query);
      redisClient
        .setResponseCache(req.CacheKey, response, 60)
        .catch((err) => logger.error(err, `Cache set failed for ${req.CacheKey}`));
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// Update a gallery image's caption / featured flag (admin or programs chair).
mediaRouter.patch(
  "/:kind/:id",
  authenticate,
  validateParams(GalleryMediumParamsSchema, 404),
  canManageGallery,
  validateBody(UpdateGalleryMediumSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await mediaHandler.updateGalleryMedium(
        req.Params.kind,
        req.Params.id,
        req.Body,
      );
      await clearGalleryCache();
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// Remove a gallery image (deletes the media row + file).
mediaRouter.delete(
  "/:kind/:id",
  authenticate,
  validateParams(GalleryMediumParamsSchema, 404),
  canManageGallery,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await mediaHandler.deleteGalleryMedium(
        req.Params.kind,
        req.Params.id,
      );
      await clearGalleryCache();
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default mediaRouter;
