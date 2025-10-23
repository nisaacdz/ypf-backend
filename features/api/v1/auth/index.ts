import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import * as authHandler from "./authHandler";
import { validateBody } from "@/shared/middlewares/validate";
import { UsernameAndPasswordSchema } from "@/shared/validators";

const authRouter = Router();

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: User login with username and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: User's username
 *               password:
 *                 type: string
 *                 minLength: 4
 *                 maxLength: 55
 *                 description: User's password
 *     responses:
 *       200:
 *         description: Login successful
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: access_token=...; refresh_token=...
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                           format: email
 *                         fullName:
 *                           type: string
 *                         profiles:
 *                           type: array
 *                           items:
 *                             type: string
 *                             enum: [ADMIN, MEMBER, VOLUNTEER, DONOR, AUDITOR]
 *       400:
 *         description: Invalid credentials or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
