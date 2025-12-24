import { Router, Request, Response, NextFunction } from "express";
import { authorize, authenticate } from "@/shared/middlewares/auth";
import { validateBody } from "@/shared/middlewares/validate";
import { Visitors, Role, ADMIN, MEMBER } from "@/configs/authorizer";
import { CreateAnnouncementSchema } from "./schemas";
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
 *               - content
 *               - targetCriteria
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the announcement
 *               content:
 *                 type: string
 *                 description: The content of the announcement (Markdown/HTML)
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED]
 *                 default: DRAFT
 *               publishedAt:
 *                 type: string
 *                 format: date-time
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *               targetCriteria:
 *                 type: object
 *                 description: Flat targeting filter. Top-level fields are AND combined; arrays within fields are OR combined.
 *                 properties:
 *                   chapterIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: uuid
 *                     description: Filter by Chapter membership (OR)
 *                   committeeIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: uuid
 *                     description: Filter by Committee membership (OR)
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                     description: Filter by specific roles/titles (e.g. PRESIDENT) (OR)
 *                   constituentTypes:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [MEMBER, VOLUNTEER, ADMIN]
 *                     description: Filter by constituent type (OR)
 *                   status:
 *                     type: string
 *                     enum: [ACTIVE, PAST, ALL]
 *                     default: ACTIVE
 *                     description: Filter by active status in the selected roles/types
 *     responses:
 *       201:
 *         description: Announcement created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 title:
 *                   type: string
 *                 status:
 *                   type: string
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
