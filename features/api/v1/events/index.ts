import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { validateBody } from "@/shared/middlewares/validate";
import { CreateEventSchema } from "@/shared/validators";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import * as eventsHandler from "./eventsHandler";

const authRoutes = Router();

authRoutes.post(
  "/",
  authenticate,
  authorize,
  validateBody(CreateEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await eventsHandler.createEvent(req.body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default authRoutes;
