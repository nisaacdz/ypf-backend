import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import * as chaptersHandler from "./chaptersHandler";
import {
  GetChaptersQuerySchema,
  UpdateChapterSchema,
  GetConstituentChaptersQuerySchema,
  GetChapterLeadershipQuerySchema,
  EnrollChapterSchema,
  UnenrollChapterSchema,
} from "./schemas";
import { Visitors, MEMBER, anyOf, ADMIN } from "@/configs/authorizer";
import z from "zod";

const chaptersRouter = Router();

chaptersRouter.get(
  "/",
  authorize(Visitors.ALL),
  validateQuery(GetChaptersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapters(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.get(
  "/:id",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapter(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.get(
  "/constituents/:constituentId",
  authenticate,
  validateParams(z.object({ constituentId: z.string() })),
  validateQuery(GetConstituentChaptersQuerySchema),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasID((req) => req.Params.constituentId),
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChaptersByConstituentId(
        req.Params.constituentId,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.patch(
  "/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  authorize(
    anyOf(
      Visitors.hasRole(ADMIN.SUPER),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.Params.id)),
    ),
  ),
  validateBody(UpdateChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.updateChapter(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.get(
  "/:id/leadership",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  validateQuery(GetChapterLeadershipQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getLeadership(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.post(
  "/:id/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  validateBody(EnrollChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.enrollToChapter(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

chaptersRouter.patch(
  "/:id/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  validateBody(UnenrollChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.unenrollFromChapter(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default chaptersRouter;
