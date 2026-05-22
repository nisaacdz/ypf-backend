import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import * as authHandler from "./authHandler";
import {
  validateBody,
  validateFile,
  validateQuery,
} from "@/shared/middlewares/validate";
import {
  UsernameAndPasswordSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  OnboardSchema,
  OnboardStatusQuerySchema,
  UpdateMeSchema,
  ChangePasswordSchema,
  UploadProfilePhotoSchema,
} from "./schemas";
import { authenticate, authenticateLax } from "@/shared/middlewares/auth";
import filesUpload from "@/shared/middlewares/multipart";
import { rateLimit } from "@/shared/middlewares/rateLimit";
import {
  getAccessCookieOptions,
  getAccessCookieClearVariants,
} from "@/shared/utils/cookies";

const authRouter = Router();

// Rate limiter for sensitive auth endpoints (5 attempts per 15 minutes)
const authRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 });

authRouter.post(
  "/login",
  authRateLimiter,
  validateBody(UsernameAndPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { response, accessToken } =
        await authHandler.loginWithUsernameAndPassword(req.Body);

      clearAccessTokenCookies(res);
      res.cookie("access_token", accessToken, getAccessCookieOptions());

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
      const { response, accessToken } = await authHandler.resetPassword(
        req.Body,
      );

      clearAccessTokenCookies(res);
      res.cookie("access_token", accessToken, getAccessCookieOptions());

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/logout", async (req: Request, res: Response) => {
  const { response } = await authHandler.logout();

  clearAccessTokenCookies(res);

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

authRouter.get(
  "/me",
  authenticateLax,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.User) {
        res.status(200).json({
          success: true,
          data: null,
        });
        return;
      }

      const response = await authHandler.getMe(req.User);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.patch(
  "/me",
  authenticate,
  validateBody(UpdateMeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await authHandler.updateMe(req.User!, req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/me/profile-photo",
  authenticate,
  filesUpload.mediaUpload.single("file"),
  validateFile(UploadProfilePhotoSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await authHandler.uploadProfilePhoto(
        req.User!,
        req.File,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  "/change-password",
  authenticate,
  authRateLimiter,
  validateBody(ChangePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await authHandler.changePassword(req.User!, req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.get(
  "/me/preferences",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await authHandler.getPreferences(req.User!);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.patch(
  "/me/preferences",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await authHandler.updatePreferences(req.User!, req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

authRouter.get(
  "/onboard/status",
  validateQuery(OnboardStatusQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await authHandler.checkOnboardStatus(req.Query.user);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

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

function clearAccessTokenCookies(res: Response) {
  for (const options of getAccessCookieClearVariants()) {
    res.clearCookie("access_token", options);
  }
}
