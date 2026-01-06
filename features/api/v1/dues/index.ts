import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import { Visitors } from "@/configs/authorizer";
import {
  InitiateDuesPaymentSchema,
  GetMemberDuesPaymentsQuerySchema,
  GetDuesQuerySchema,
} from "./schemas";
import * as duesHandler from "./duesHandler";
import * as duesService from "@/shared/services/duesService";
import z from "zod";
import { ApiError } from "@/shared/types";

const duesRouter = Router();

duesRouter.get(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetDuesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await duesHandler.getAvailableDues(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

duesRouter.get(
  "/:duesId/status",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER")),
  validateParams(z.object({ duesId: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await duesService.getActiveMember(req.User!.constituentId);
      if (!member) {
        throw new ApiError(
          "You must be an active member to view dues status",
          403,
        );
      }

      const response = await duesHandler.getMemberDuesStatus(
        member.id,
        req.Params.duesId,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

duesRouter.get(
  "/payments",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER")),
  validateQuery(GetMemberDuesPaymentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await duesService.getActiveMember(req.User!.constituentId);
      if (!member) {
        throw new ApiError(
          "You must be an active member to view payment history",
          403,
        );
      }

      const response = await duesHandler.getMemberDuesPayments(
        member.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

duesRouter.post(
  "/pay",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER")),
  validateBody(InitiateDuesPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await duesHandler.initiateDuesPayment(
        req.Body,
        req.User!,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default duesRouter;
