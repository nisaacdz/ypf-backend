import { Router, Request, Response, NextFunction } from "express";
import { authorize, authenticate } from "@/shared/middlewares/auth";
import { validateBody } from "@/shared/middlewares/validate";
import { Visitors, Role, ADMIN } from "@/configs/authorizer";
import { CreateAnnouncementSchema } from "@/shared/validators/announcements";
import * as announcementHandler from "./announcementHandler";

const announcementsRouter = Router();

const MEMBER_LEADERS = Role.matches(/^MEMBER\..+$/);

announcementsRouter.post(
  "/",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER_LEADERS)),
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

export default announcementsRouter;
