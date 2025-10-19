import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  validateBody,
  validateFile,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import {
  CreateEventSchema,
  GetEventMediaQuerySchema,
  UploadEventFileSchema,
  UploadEventMediumOptionsSchema,
} from "@/shared/validators/activities";
import {
  authenticate,
  authenticateLax,
  authorize,
} from "@/shared/middlewares/auth";
import * as eventsHandler from "./eventsHandler";
import filesUpload from "@/shared/middlewares/multipart";
import z from "zod";
import { anyOf, Visitors } from "@/configs/authorizer";

const eventsRouter = Router();

eventsRouter.post(
  "/",
  authenticate,
  authorize(
    anyOf(
      Visitors.hasMembership("SUPER_USER"),
      Visitors.hasRole("event_coordinator"),
    ),
  ),
  validateBody(CreateEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.createEvent(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

eventsRouter.post(
  "/:id/media",
  validateParams(z.object({ id: z.uuid("Invalid Request") })),
  authenticate,
  authorize(
    anyOf(
      Visitors.hasMembership("SUPER_USER"),
      Visitors.hasRole("event_coordinator"),
    ),
  ),
  filesUpload.single("file"),
  validateFile(UploadEventFileSchema),
  validateBody(UploadEventMediumOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.uploadEventMedium({
        constituentId: req.User!.constituentId,
        eventId: req.Params.id,
        file: req.File,
        options: req.Body,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

eventsRouter.get(
  "/:id/media",
  validateParams(z.object({ id: z.uuid("Invalid Request") })),
  authenticateLax,
  authorize(Visitors.ALL),
  validateQuery(GetEventMediaQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.getEventMedia(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default eventsRouter;
