import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  authenticate,
  authenticateLax,
  authorize,
} from "@/shared/middlewares/auth";
import {
  GetProjectsQuerySchema,
  GetProjectMediaQuerySchema,
  UploadProjectFileSchema,
  UploadProjectMediumOptionsSchema,
} from "@/shared/validators/activities";
import {
  validateQuery,
  validateParams,
  validateFile,
  validateBody,
} from "@/shared/middlewares/validate";
import * as projectsHandler from "./projectsHandler";
import { Visitors, MEMBER, anyOf } from "@/configs/authorizer";
import z from "zod";
import filesUpload from "@/shared/middlewares/multipart";

const projectsRouter = Router();

/**
 * @swagger
 * /api/v1/projects:
 *   get:
 *     summary: Get list of projects
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: filterStatus
 *         schema:
 *           type: string
 *           enum: [PLANNING, ACTIVE, COMPLETED, ON_HOLD]
 *         description: Filter projects by status
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
 *         description: Projects list retrieved successfully
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
 *                     projects:
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
 */
projectsRouter.get(
  "/",
  authenticateLax,
  authorize(Visitors.ALL),
  validateQuery(GetProjectsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProjects(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/projects/{id}/media:
 *   get:
 *     summary: Get media files for a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
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
 *         name: mediaType
 *         schema:
 *           type: string
 *           enum: [PICTURE, VIDEO]
 *     responses:
 *       200:
 *         description: Media list retrieved successfully
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
 *                     media:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
projectsRouter.get(
  "/:id/media",
  validateParams(z.object({ id: z.uuid("Invalid Request") })),
  authenticateLax,
  authorize(Visitors.ALL),
  validateQuery(GetProjectMediaQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.getProjectMedia(
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
 * /api/v1/projects/{id}/media:
 *   post:
 *     summary: Upload media file for a project
 *     tags: [Projects]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Media file (PNG, JPEG up to 50MB or MP4, AVI up to 250MB)
 *               caption:
 *                 type: string
 *                 maxLength: 255
 *               isFeatured:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Media uploaded successfully
 *       400:
 *         description: Invalid file type, size, or payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
projectsRouter.post(
  "/:id/media",
  validateParams(z.object({ id: z.uuid("Invalid Request") })),
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.PRESIDENT)),
  ),
  filesUpload.single("file"),
  validateFile(UploadProjectFileSchema),
  validateBody(UploadProjectMediumOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await projectsHandler.uploadProjectMedium({
        constituentId: req.User!.constituentId,
        projectId: req.Params.id,
        file: req.File,
        options: req.Body,
      });
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default projectsRouter;
