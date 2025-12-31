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
  GetConstituentChaptersQuerySchema,
  GetChapterLeadershipQuerySchema,
  EnrollChapterSchema,
  UnenrollChapterSchema,
  CreateChapterSchema,
} from "./schemas";
import { Visitors, MEMBER, anyOf, ADMIN } from "@/configs/authorizer";
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
  authorize(Visitors.ALL),
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
 * /api/v1/chapters:
 *   post:
 *     summary: Create a new chapter (SUPER_ADMIN only)
 *     tags: [Chapters]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - country
 *               - foundingDate
 *             properties:
 *               name:
 *                 type: string
 *                 description: Chapter name
 *               country:
 *                 type: string
 *                 description: Country where the chapter is located
 *               description:
 *                 type: string
 *                 description: Chapter description
 *               foundingDate:
 *                 type: string
 *                 format: date
 *                 description: Founding date of the chapter
 *               parentId:
 *                 type: string
 *                 format: uuid
 *                 description: Parent chapter ID (optional)
 *     responses:
 *       201:
 *         description: Chapter created successfully
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
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role
 */
chaptersRouter.post(
  "/",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(CreateChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.createChapter(req.Body);
      res.status(201).json(response);
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
 * /api/v1/chapters/constituents/{constituentId}:
 *   get:
 *     summary: Get chapters for a specific constituent
 *     description: Returns a paginated list of chapters that the constituent is a member of. Only accessible by the constituent themselves or ADMINs.
 *     tags: [Chapters]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: constituentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Constituent ID
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
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       400:
 *         description: Invalid query parameters or constituent ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - can only access own chapters or requires ADMIN profile
 */
chaptersRouter.get(
  "/constituents/:constituentId",
  authenticate,
  validateParams(z.object({ constituentId: z.string() })),
  validateQuery(GetConstituentChaptersQuerySchema),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasID((req) => req.Params.constituentId),
    ),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChaptersByConstituentId(
        req.Params.constituentId,
        req.Query,
      );
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
 *                 description: Chapter name
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
      Visitors.hasRole(ADMIN.SUPER),
      Visitors.hasRole((req) => MEMBER.chapterLead(req.Params.id)),
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

/**
 * @swagger
 * /api/v1/chapters/{id}/leadership:
 *   get:
 *     summary: Get chapter leadership
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
 *     responses:
 *       200:
 *         description: Chapter leadership retrieved successfully
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
 *         description: Invalid chapter ID or query parameters
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
  "/:id/leadership",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  validateQuery(GetChapterLeadershipQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getLeadership(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/chapters/{id}/members:
 *   get:
 *     summary: Get all members enrolled in a chapter
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
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: Chapter members retrieved successfully
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
 *         description: Invalid chapter ID or query parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires MEMBER or ADMIN profile
 *       404:
 *         description: Chapter not found
 */
chaptersRouter.get(
  "/:id/members",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  validateQuery(GetChapterLeadershipQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.getChapterMembers(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/chapters/{id}/enroll:
 *   post:
 *     summary: Enroll a constituent to a chapter
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
 *             required:
 *               - constituentId
 *             properties:
 *               constituentId:
 *                 type: string
 *                 format: uuid
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Enrolled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role
 *       404:
 *         description: No active membership found
 */
chaptersRouter.post(
  "/:id/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  validateBody(EnrollChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.enrollToChapter(
        req.Params.id,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/chapters/{id}/unenroll:
 *   patch:
 *     summary: Unenroll a constituent from a chapter
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
 *             required:
 *               - constituentId
 *             properties:
 *               constituentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Unenrolled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role
 *       404:
 *         description: No active chapter membership found
 */
chaptersRouter.patch(
  "/:id/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid chapter ID") })),
  validateBody(UnenrollChapterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await chaptersHandler.unenrollFromChapter(
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
