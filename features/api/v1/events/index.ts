import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { validateBody } from "@/shared/middlewares/validate";
import { CreateEventSchema } from "@/shared/validators/activities";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import * as eventsHandler from "./eventsHandler";

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

export default eventsRouter;
