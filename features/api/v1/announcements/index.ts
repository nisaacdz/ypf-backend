import { Router, Request, Response, NextFunction } from "express";
import { authorize, authenticate } from "@/shared/middlewares/auth";
import { validateBody, validateParams } from "@/shared/middlewares/validate";
import { Visitors, ADMIN, MEMBER } from "@/configs/authorizer";
import {
  CreateAnnouncementSchema,
  UpdateAnnouncementSchema,
} from "./schemas";
import * as announcementHandler from "./announcementHandler";
import z from "zod";

const announcementsRouter = Router();

announcementsRouter.post(
  "/",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.LEADER)),
  validateBody(CreateAnnouncementSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await announcementHandler.createAnnouncement(
        req.Body,
        req.User!.constituentId,
      );
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/announcements
 * Returns the authenticated caller's announcement feed. Sourced from
 * `constituent_announcements` so it respects per-recipient targeting and
 * read state.
 */
announcementsRouter.get(
  "/",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? Number(req.query.page) : undefined;
      const pageSize = req.query.pageSize
        ? Number(req.query.pageSize)
        : undefined;
      const response = await announcementHandler.listMyAnnouncements(
        req.User!.constituentId,
        { page, pageSize },
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

announcementsRouter.get(
  "/:id",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  validateParams(z.object({ id: z.uuid("Invalid announcement ID") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await announcementHandler.getMyAnnouncement(
        req.User!.constituentId,
        req.Params.id,
      );
      if (!response.data) {
        res.status(404).json({
          success: false,
          message: "Announcement not found",
        });
        return;
      }
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

announcementsRouter.patch(
  "/:id/read",
  authenticate,
  authorize(Visitors.AUTHENTICATED),
  validateParams(z.object({ id: z.uuid("Invalid announcement ID") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await announcementHandler.markRead(
        req.User!.constituentId,
        req.Params.id,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

announcementsRouter.patch(
  "/:id",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.LEADER)),
  validateParams(z.object({ id: z.uuid("Invalid announcement ID") }), 404),
  validateBody(UpdateAnnouncementSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await announcementHandler.updateAnnouncement(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

announcementsRouter.delete(
  "/:id",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.LEADER)),
  validateParams(z.object({ id: z.uuid("Invalid announcement ID") }), 404),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await announcementHandler.deleteAnnouncement(
        req.Params.id,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default announcementsRouter;
