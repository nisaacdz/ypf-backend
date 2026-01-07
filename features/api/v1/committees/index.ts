import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import {
  validateQuery,
  validateParams,
  validateBody,
} from "@/shared/middlewares/validate";
import * as committeesHandler from "./committeesHandler";
import {
  GetCommitteesQuerySchema,
  GetConstituentCommitteesQuerySchema,
  GetCommitteeLeadershipQuerySchema,
  EnrollCommitteeSchema,
  UnenrollCommitteeSchema,
} from "./schemas";
import { Visitors, anyOf, ADMIN } from "@/configs/authorizer";
import z from "zod";

const committeesRouter = Router();

committeesRouter.get(
  "/",
  authorize(Visitors.ALL),
  validateQuery(GetCommitteesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommittees(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.get(
  "/constituents/:constituentId",
  authenticate,
  validateParams(z.object({ constituentId: z.string() })),
  validateQuery(GetConstituentCommitteesQuerySchema),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasID((req) => req.Params.constituentId),
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommitteesByConstituentId(
        req.Params.constituentId,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.get(
  "/:id",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommittee(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.get(
  "/:id/leadership",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  validateQuery(GetCommitteeLeadershipQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getLeadership(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.post(
  "/:id/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  validateBody(EnrollCommitteeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.enrollToCommittee(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

committeesRouter.patch(
  "/:id/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  validateBody(UnenrollCommitteeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.unenrollFromCommittee(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default committeesRouter;
