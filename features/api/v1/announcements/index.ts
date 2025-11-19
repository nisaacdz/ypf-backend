import { Router, Request, Response, NextFunction } from "express";
import { authorize, authenticate } from "@/shared/middlewares/auth";
import { validateBody } from "@/shared/middlewares/validate";
import { Visitors, Role, ADMIN, MEMBER } from "@/configs/authorizer";
import { CreateAnnouncementSchema } from "@/shared/validators/announcements";
import * as announcementHandler from "./announcementHandler";

const announcementsRouter = Router();

/**
 * @swagger
 * /api/v1/announcements:
 *   post:
 *     summary: Create a new announcement
 *     tags: [Announcements]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *               - audience
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the announcement
 *               message:
 *                 type: string
 *                 description: The content of the announcement
 *               audience:
 *                 type: object
 *                 description: Targeting rules for the announcement
 *                 properties:
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                   profiles:
 *                     type: array
 *                     items:
 *                       type: string
 *               sendEmail:
 *                 type: boolean
 *                 description: Whether to send an email notification
 *                 default: false
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Insufficient permissions
 */
announcementsRouter.post(
  "/",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER, ADMIN.REGULAR, MEMBER.LEADER)),
  validateBody(CreateAnnouncementSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await announcementHandler.createAnnouncement(
        req.Body,
        req.User!.id,
      );
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default announcementsRouter;
