import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import { validateBody, validateQuery } from "@/shared/middlewares/validate";
import { Visitors } from "@/configs/authorizer";
import * as smsHandler from "./smsHandler";
import { SendBroadcastSchema, GetHistoryQuerySchema } from "./schemas";

const smsRouter = Router();

// Every route is admin-only. SMS sends real-money credit, so we restrict to
// ADMIN profile holders (super admin or regular admin).
const adminOnly = [authenticate, authorize(Visitors.hasProfile("ADMIN"))];

smsRouter.get(
  "/balance",
  ...adminOnly,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await smsHandler.getBalance();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

smsRouter.post(
  "/send",
  ...adminOnly,
  validateBody(SendBroadcastSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await smsHandler.sendBroadcast(req.Body, req.User!);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

smsRouter.get(
  "/history",
  ...adminOnly,
  validateQuery(GetHistoryQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await smsHandler.getHistory(req.Query);
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

smsRouter.get(
  "/stats",
  ...adminOnly,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await smsHandler.getStats();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  },
);

export default smsRouter;
