import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import { ADMIN, anyOf, Visitors } from "@/configs/authorizer";
import {
  InitiateDuesPaymentSchema,
  GetMemberDuesPaymentsQuerySchema,
  GetDuesQuerySchema,
  RecordOfflineDuesPaymentSchema,
  SetDuesPolicySchema,
} from "./schemas";
import * as duesHandler from "./duesHandler";
import * as duesService from "@/shared/services/duesService";
import z from "zod";

const duesRouter = Router();

duesRouter.get(
  "/",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("MEMBER", "ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
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
  validateParams(z.object({ duesId: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await duesService.getActiveMember(req.User!.constituentId);
      // Non-members get an empty status payload instead of a 403 — the My
      // Dues page already renders an empty state, and dropping the 403 keeps
      // the browser console clean for admin / volunteer accounts.
      if (!member) {
        res.status(200).json({
          success: true,
          data: null,
          message: "Not an active member — no dues status to report.",
        });
        return;
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
  validateQuery(GetMemberDuesPaymentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await duesService.getActiveMember(req.User!.constituentId);
      // See above — return an empty page for non-members rather than 403.
      if (!member) {
        const { page, pageSize } = req.Query;
        res.status(200).json({
          success: true,
          data: { items: [], page, pageSize, total: 0 },
          message: "Not an active member — no dues payment history to report.",
        });
        return;
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
  validateBody(InitiateDuesPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // No route-level profile guard — the service throws a clearer
      // "You must be an active member to pay dues" 403 when getActiveMember
      // returns null.
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

// ---------------------------------------------------------------------------
// Super-admin: configure the monthly dues policy
// ---------------------------------------------------------------------------

duesRouter.get(
  "/policy",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await duesHandler.getDuesPolicy();
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

duesRouter.put(
  "/policy",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  validateBody(SetDuesPolicySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await duesHandler.setDuesPolicy(req.Body, req.User!);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Super-admin: record an offline payment on behalf of a member
// ---------------------------------------------------------------------------

duesRouter.post(
  "/admin/record",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  validateBody(RecordOfflineDuesPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await duesHandler.recordOfflineDuesPayment(
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
