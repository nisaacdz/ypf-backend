import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import * as authHandler from "./authHandler";
import { validateBody } from "@/shared/middlewares/validate";
import { AuthCodeSchema, UsernameAndPasswordSchema } from "@/shared/validators";
import envConfig from "@/configs/env";

const authRoutes = Router();

authRoutes.post(
  "/login",
  validateBody(UsernameAndPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { response, token } =
        await authHandler.loginWithUsernameAndPassword(req.Body);
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: envConfig.isProduction,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

authRoutes.post(
  "/google",
  validateBody(AuthCodeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { response, token } = await authHandler.loginWithGoogleAuthCode(
        req.Body
      );
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: envConfig.isProduction,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default authRoutes;
