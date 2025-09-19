import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import * as usersHandler from "../users/usersHandler";
import { authenticate } from "@/shared/middleware/auth";

const authRoutes = Router();

authRoutes.post(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id!;
      const response = await usersHandler.getUserData({ userId });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default authRoutes;
