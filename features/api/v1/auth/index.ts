import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import * as authHandler from "./authHandler";
import { validateBody } from "@/shared/middlewares/validate";
import { UsernameAndPasswordSchema } from "@/shared/validators";

const authRouter = Router();

authRouter.post(
  "/login",
  validateBody(UsernameAndPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { response, accessToken, refreshToken } =
        await authHandler.loginWithUsernameAndPassword(req.Body);

      // Set access_token cookie with 30-minute expiry
      res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3 * 24 * 60 * 60 * 1000, // actual token expires earlier
        path: "/",
      });

      // Set refresh_token cookie with 3-day expiry
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
        path: "/",
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/logout",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { response } = await authHandler.logout();

      // Clear access_token cookie
      res.clearCookie("access_token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      });

      // Clear refresh_token cookie
      res.clearCookie("refresh_token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// authRouter.post(
//   "/google",
//   validateBody(AuthCodeSchema),
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       const { response, token } = await authHandler.loginWithGoogleAuthCode(
//         req.Body,
//       );
//       res.cookie("access_token", token, {
//         httpOnly: true,
//         secure: variables.isProduction,
//         sameSite: "lax",
//         maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
//         path: "/",
//       });

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   },
// );

export default authRouter;
