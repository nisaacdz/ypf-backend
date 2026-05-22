import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateQuery,
  validateParams,
  validateBody,
} from "@/shared/middlewares/validate";
import * as constituentsHandler from "./constituentsHandler";
import {
  GetConstituentsQuerySchema,
  InviteConstituentSchema,
  OnboardConstituentSchema,
  UpdateConstituentSchema,
} from "./schemas";
import { Visitors, MEMBER, ADMIN, anyOf } from "@/configs/authorizer";
import z from "zod";
import variables from "@/configs/env";
import redisClient from "@/configs/redis";

const constituentsRouter = Router();
const dashboardUrl = variables.app.dashboardUrl ?? "http://localhost:3000";

constituentsRouter.get(
  "/",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER)),
  ),
  validateQuery(GetConstituentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await constituentsHandler.getConstituents(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

constituentsRouter.post(
  "/invite",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(InviteConstituentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await constituentsHandler.inviteConstituent(
        req.Body,
        dashboardUrl,
      );
      await redisClient.delCache("/api/v1/members");
      await redisClient.delCache("/api/v1/chapters");
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

constituentsRouter.post(
  "/onboard",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(OnboardConstituentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await constituentsHandler.onboardConstituent(
        req.Body,
        dashboardUrl,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

constituentsRouter.get(
  "/:constituentId",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER)),
  ),
  validateParams(z.object({ constituentId: z.uuid("Invalid constituent ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await constituentsHandler.getConstituent(
        req.Params.constituentId,
      );
      if (!response.data) {
        res
          .status(404)
          .json({ success: false, error: "Constituent not found" });
        return;
      }
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Edit direct constituent fields (name, contact, location). Admin-only.
 * Cache for `/members` is invalidated on success so the People list shows
 * the new values immediately. The People drawer in UMS hits this endpoint.
 */
constituentsRouter.put(
  "/:constituentId",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ constituentId: z.uuid("Invalid constituent ID") })),
  validateBody(UpdateConstituentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await constituentsHandler.updateConstituent(
        req.Params.constituentId,
        req.Body,
      );
      await redisClient.delCache("/api/v1/members");
      await redisClient.delCache("/api/v1/members/leadership");
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default constituentsRouter;
