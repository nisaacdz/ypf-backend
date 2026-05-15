import { Router, Request, Response, NextFunction } from "express";
import { authorize, authenticate } from "@/shared/middlewares/auth";
import { validateBody } from "@/shared/middlewares/validate";
import { Visitors, Role, ADMIN, MEMBER } from "@/configs/authorizer";
import { CreateAnnouncementSchema } from "./schemas";
import * as announcementHandler from "./announcementHandler";

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
        req.User!.id,
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

export default announcementsRouter;
