import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import * as dashboardHandler from "./dashboardHandler";
import { validateQuery } from "@/shared/middlewares/validate";
import { z } from "zod";

const dashboardRouter = Router();

dashboardRouter.get(
  "/stats",
  authenticate,
  authorize(Visitors.ALL),
  validateQuery(z.object({})),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await dashboardHandler.getStats();
      // Cache for 15 minutes (900 seconds)
      await redisClient.setResponseCache(req.CacheKey, response, 15 * 60);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

dashboardRouter.get(
  "/activity",
  authenticate,
  authorize(Visitors.ALL),
  validateQuery(z.object({})),
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await dashboardHandler.getActivity();
      // Cache for 15 minutes (900 seconds)
      await redisClient.setResponseCache(req.CacheKey, response, 15 * 60);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default dashboardRouter;
