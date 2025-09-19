import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import * as authHandler from "./authHandler";

const authRoutes = Router();

authRoutes.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { response, token } =
        await authHandler.loginWithUsernameAndPassword(req.body);
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default authRoutes;
