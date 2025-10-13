import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  validateBody,
  validateFile,
  validateParams,
} from "@/shared/middlewares/validate";
import {
  CreateEventSchema,
  UploadEventFileSchema,
  UploadEventMediumOptionsSchema,
} from "@/shared/validators/activities";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import * as eventsHandler from "./eventsHandler";
import filesUpload from "@/shared/middlewares/multipart";
import z from "zod";

const eventsRouter = Router();

eventsRouter.post(
  "/",
  authenticate,
  authorize,
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
  validateParams(z.object({ id: z.uuid() })),
  authenticate,
  authorize,
  filesUpload.single("file"),
  validateFile(UploadEventFileSchema),
  validateBody(UploadEventMediumOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.uploadEventMedia({
        userId: req.User!.id,
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

export default eventsRouter;
