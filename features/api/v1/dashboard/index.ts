import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { Visitors } from "@/configs/authorizer";
import * as dashboardHandler from "./dashboardHandler";

const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.use(authorize(Visitors.hasProfile("ADMIN")));

dashboardRouter.get(
  "/stats",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await dashboardHandler.getStats();
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
