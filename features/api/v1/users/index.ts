import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import * as usersHandler from "../users/usersHandler";
import { authenticate } from "@/shared/middlewares/auth";

const usersRouter = Router();

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current authenticated user data
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                       format: email
 *                     fullName:
 *                       type: string
 *                     constituentId:
 *                       type: string
 *                     profiles:
 *                       type: array
 *                       items:
 *                         type: string
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         description: Unauthorized - authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
usersRouter.get(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.User?.id as string;
      const response = await usersHandler.getUserData({ userId });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default usersRouter;
