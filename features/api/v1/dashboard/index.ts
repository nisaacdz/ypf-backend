import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import { redisCacheEarlyReturn } from "@/shared/middlewares/redisCache";
import redisClient from "@/configs/redis";
import * as dashboardHandler from "./dashboardHandler";

const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.use(authorize(Visitors.hasProfile("ADMIN")));

dashboardRouter.get(
  "/stats",
  redisCacheEarlyReturn,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await dashboardHandler.getStats();
      // Cache for 5 minutes (300 seconds)
      if (req.CacheKey) {
        await redisClient.setCache(req.CacheKey, response, 300);
      }
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

dashboardRouter.get(
  "/activity",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await dashboardHandler.getActivity();
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default dashboardRouter;
