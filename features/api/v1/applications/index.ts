import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  validateBody,
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
  PostMembershipApplicationBody,
  UpdateMembershipApplicationStatusSchema,
  GetMembershipApplicationsQuerySchema,
  UploadRegistrationFileSchema,
} from "./schemas";

const applicationsRouter = Router();

/**
 * @swagger
 * /api/v1/applications/membership:
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
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           status:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           applicant:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                               fullName:
 *                                 type: string
 *                               email:
 *                                 type: string
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
  "/membership",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetMembershipApplicationsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.getMembershipApplications(
        req.Query
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/applications/membership/{id}:
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
 *                     commitmentStatement:
 *                       type: string
 *                     referralSource:
 *                       type: string
 *                     declinedReason:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     approvedAt:
 *                       type: string
 *                       format: date-time
 *                     applicant:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         occupation:
 *                           type: string
 *                         country:
 *                           type: string
 *                         region:
 *                           type: string
 *                         city:
 *                           type: string
 *                         campus:
 *                           type: string
 *                         skills:
 *                           type: array
 *                           items:
 *                             type: string
 *                         previousVolunteerExperience:
 *                           type: string
 *                     preferredChapter:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                     preferredCommittee:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                     cvDocument:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         externalId:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Application not found
 */
applicationsRouter.get(
  "/membership/:id",
  validateParams(z.object({ id: z.uuid("Invalid Request") })),
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.getMembershipApplicationById(
        req.Params.id
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/applications/membership:
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
 *               - commitmentStatement
 *               - willingToServe
 *               - nationalIdType
 *               - dateOfBirth
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
 *               whatsapp:
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
 *               nationalIdType:
 *                 type: string
 *                 enum: [ECOWASIDCARD]
 *               emergencyContactName:
 *                 type: string
 *               emergencyContactPhone:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               linkedinProfile:
 *                 type: string
 *               twitterHandle:
 *                 type: string
 *               preferredChapterId:
 *                 type: string
 *                 format: uuid
 *               preferredCommitteeId:
 *                 type: string
 *                 format: uuid
 *               preferredProfile:
 *                 type: string
 *                 default: MEMBER
 *                 enum: [MEMBER, VOLUNTEER]
 *               commitmentStatement:
 *                 type: string
 *               referralSource:
 *                 type: string
 *               previousVolunteerExperience:
 *                 type: string
 *               willingToServe:
 *                 type: boolean
 *               passportPhoto:
 *                 type: string
 *                 format: binary
 *                 description: Passport photo (image, max 10MB)
 *               nationalId:
 *                 type: string
 *                 format: binary
 *                 description: National ID document (PDF or image, max 10MB)
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: Resume/CV document (PDF, max 10MB)
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
  "/membership",
  documentsUpload.fields([
    { name: "passportPhoto", maxCount: 1 },
    { name: "nationalId", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  validateFiles({
    passportPhoto: UploadRegistrationFileSchema,
    nationalId: UploadRegistrationFileSchema,
    resume: UploadRegistrationFileSchema.optional(),
  }),
  validateBody(PostMembershipApplicationBody),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await applicationsHandler.createMembershipApplication({
        data: req.Body,
        files: req.Files,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default applicationsRouter;
