import { NextFunction, Request, Response, Router } from "express";
import { validateQuery } from "@/shared/middlewares/validate";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import logger from "@/configs/logger";
import { authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import { GetPublicMediaQuerySchema } from "./schemas";
import * as mediaHandler from "./mediaHandler";

const mediaRouter = Router();

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

export default mediaRouter;
