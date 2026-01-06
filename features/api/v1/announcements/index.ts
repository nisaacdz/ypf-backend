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

export default announcementsRouter;
