import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import * as chaptersHandler from "./chaptersHandler";
import {
  GetChaptersQuerySchema,
  UpdateChapterSchema,
} from "@/shared/validators/core";
import { Visitors, MEMBER, anyOf } from "@/configs/authorizer";
import z from "zod";

const chaptersRouter = Router();

/**
 * @swagger
 * /api/v1/chapters:
 *   get:
 *     summary: Get list of chapters
 *     tags: [Chapters]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Chapters list retrieved successfully
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
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires MEMBER or ADMIN profile
 */
chaptersRouter.get(
  "/",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetChaptersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapters(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/chapters/{id}:
 *   get:
 *     summary: Get a single chapter by ID
 *     tags: [Chapters]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chapter ID
 *     responses:
 *       200:
 *         description: Chapter details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid chapter ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires MEMBER or ADMIN profile
 *       404:
 *         description: Chapter not found
 */
chaptersRouter.get(
  "/:id",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapter(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/chapters/{id}:
 *   patch:
 *     summary: Update a chapter (SUPER_ADMIN or chapter lead only)
 *     tags: [Chapters]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Chapter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
Comment view *                 description: Chapter name
 *               description:
 *                 type: string
 *                 description: Chapter description
 *               foundingDate:
 *                 type: string
 *                 format: date
 *                 description: Founding date of the chapter
 *     responses:
 *       200:
 *         description: Chapter updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid request body or chapter ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role or chapter lead role
 *       404:
 *         description: Chapter not found
 */
chaptersRouter.patch(
  "/:id",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  authorize(
    anyOf(
      Visitors.hasRole("ADMIN.SUPER_ADMIN"),
      Visitors.satisfies(async (req) => {
        return Visitors.hasRole(MEMBER.chapterLead(req.Params.id))(req);
      }),
    ),
  ),
  validateBody(UpdateChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.updateChapter(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default chaptersRouter;
