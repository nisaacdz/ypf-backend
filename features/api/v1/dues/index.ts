import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import { ADMIN, MEMBER, anyOf, Visitors } from "@/configs/authorizer";
// ADMIN/MEMBER/anyOf/Visitors still used by policy + admin/record routes below
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
      const member = await duesService.getOrCreateActiveMember(
        req.User!.constituentId,
      );

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
      const member = await duesService.getOrCreateActiveMember(
        req.User!.constituentId,
      );

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
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.COMMITTEECHAIR),
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

// ---------------------------------------------------------------------------
// Dues reminders
// ---------------------------------------------------------------------------

import * as duesReminderService from "@/shared/services/duesReminderService";

duesRouter.get(
  "/reminders",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reminders = await duesReminderService.getRemindersForConstituent(
        req.User!.constituentId,
      );
      res.status(200).json({ success: true, data: reminders });
    } catch (error) {
      next(error);
    }
  },
);

duesRouter.post(
  "/reminders/:reminderId/dismiss",
  authenticate,
  validateParams(z.object({ reminderId: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await duesReminderService.dismissReminder(req.Params.reminderId);
      res.status(200).json({ success: true, data: null });
    } catch (error) {
      next(error);
    }
  },
);

duesRouter.post(
  "/reminders/generate",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR),
    ),
  ),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const count =
        await duesReminderService.generateRemindersForCurrentMonth({ force: true });
      res.status(200).json({
        success: true,
        data: { generated: count },
        message: `Generated ${count} reminder(s).`,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default duesRouter;
