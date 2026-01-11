import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import * as authHandler from "./authHandler";
import { validateBody } from "@/shared/middlewares/validate";
import {
  UsernameAndPasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  OnboardSchema,
} from "./schemas";
import { authenticateLax } from "@/shared/middlewares/auth";
import { rateLimit } from "@/shared/middlewares/rateLimit";

const authRouter = Router();

// Rate limiter for sensitive auth endpoints (5 attempts per 15 minutes)
const authRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 });

authRouter.post(
  "/login",
  authRateLimiter,
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
        partitioned: true,
      });

      // Set refresh_token cookie with 3-day expiry
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
        path: "/",
        partitioned: true,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/forgot-password",
  authRateLimiter,
  validateBody(ForgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await authHandler.forgotPassword(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/reset-password",
  validateBody(ResetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { response, accessToken, refreshToken } =
        await authHandler.resetPassword(req.Body);

      // Set access_token cookie with 30-minute expiry
      res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3 * 24 * 60 * 60 * 1000, // actual token expires earlier
        path: "/",
        partitioned: true,
      });

      // Set refresh_token cookie with 3-day expiry
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
        path: "/",
        partitioned: true,
      });

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/logout", async (req: Request, res: Response) => {
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
});

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
//         partitioned: true,
//       });

//       res.status(200).json(response);
//     } catch (error) {
//       next(error);
//     }
//   },
// );

authRouter.get("/me", authenticateLax, async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: req.User ?? null,
  });
});

authRouter.post(
  "/onboard",
  validateBody(OnboardSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await authHandler.onboard(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default authRouter;
