import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  validateBody,
  validateFile,
  validateFiles,
  validateParams,
  validateQuery,
} from "@/shared/middlewares/validate";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import * as applicationsHandler from "./applicationsHandler";
import { documentsUpload } from "@/shared/middlewares/multipart";
import { Visitors } from "@/configs/authorizer";
import z from "zod";
import {
  PostApplicationBody,
  UpdateApplicationStatusSchema,
  GetApplicationsQuerySchema,
  UploadRegistrationFileSchema,
} from "./schemas";

const applicationsRouter = Router();

/**
 * @swagger
 * /api/v1/applications:
 *   get:
 *     summary: Get list of applications
 *     tags: [Applications]
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
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by application status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *     responses:
 *       200:
 *         description: Applications list retrieved successfully
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
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 */
applicationsRouter.get(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetApplicationsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.getApplications(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/applications/{id}:
 *   get:
 *     summary: Get application details
 *     tags: [Applications]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application ID
 *     responses:
 *       200:
 *         description: Application details retrieved successfully
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
 *                     status:
 *                       type: string
 *                     constituent:
 *                       type: object
 *                     preferredChapter:
 *                       type: object
 *                     cvDocument:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Application not found
 */
applicationsRouter.get(
  "/:id",
  validateParams(z.object({ id: z.uuid("Invalid Request") })),
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.getApplicationById(
        req.Params.id,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/applications:
 *   post:
 *     summary: Submit a new application
 *     tags: [Applications]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - phone
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               preferredName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               whatsappNumber:
 *                 type: string
 *               salutation:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE, OTHER]
 *               occupation:
 *                 type: string
 *               country:
 *                 type: string
 *               region:
 *                 type: string
 *               city:
 *                 type: string
 *               campus:
 *                 type: string
 *               chapterId:
 *                 type: string
 *                 format: uuid
 *               committeeId:
 *                 type: string
 *                 format: uuid
 *               commitmentStatement:
 *                 type: string
 *               referralSource:
 *                 type: string
 *               cv:
 *                 type: string
 *                 format: binary
 *                 description: CV document (PDF, max 10MB)
 *     responses:
 *       201:
 *         description: Application submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: string
 *                   format: uuid
 *                   description: ID of the created application
 *       400:
 *         description: Invalid request data
 */
applicationsRouter.post(
  "/",
  documentsUpload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "nationalId", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  validateFiles({
    passportPhoto: UploadRegistrationFileSchema,
    nationalId: UploadRegistrationFileSchema,
    resume: UploadRegistrationFileSchema,
  }),
  validateBody(PostApplicationBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.createApplication({
        data: req.Body,
        files: req.Files,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default applicationsRouter;
