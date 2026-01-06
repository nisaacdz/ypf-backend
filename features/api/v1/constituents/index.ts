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
  OnboardConstituentSchema,
} from "./schemas";
import { Visitors, MEMBER, ADMIN, anyOf } from "@/configs/authorizer";
import z from "zod";
import variables from "@/configs/env";

const constituentsRouter = Router();

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
  "/onboard",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(OnboardConstituentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardUrl = `${variables.app.dashboardUrl}/auth/onboarding`;
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

export default constituentsRouter;
