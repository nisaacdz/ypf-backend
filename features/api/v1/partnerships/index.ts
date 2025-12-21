import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
  validateFile,
} from "@/shared/middlewares/validate";
import { documentsUpload } from "@/shared/middlewares/multipart";
import { Visitors } from "@/configs/authorizer";
import {
  GetPartnershipsQuerySchema,
  CreatePartnershipSchema,
  UpdatePartnershipSchema,
  UploadContractDocumentSchema,
} from "./schemas";
import * as partnershipsHandler from "./partnershipsHandler";
import z from "zod";

const partnershipsRouter = Router();

/**
 * @swagger
 * /api/v1/partnerships:
 *   get:
 *     summary: Get list of partnerships
 *     description: Returns a paginated list of partnerships with optional filtering by type, project, event, or organization
 *     tags: [Partnerships]
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
 *         name: partnershipType
 *         schema:
 *           type: string
 *           enum: [SPONSOR, IN_KIND, TECHNICAL, VENUE, OTHER]
 *         description: Filter by partnership type
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by project ID
 *       - in: query
 *         name: eventId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by event ID
 *       - in: query
 *         name: organizationId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by organization ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Filter by active status (based on start/end dates)
 *     responses:
 *       200:
 *         description: Partnerships list retrieved successfully
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
 *                           organization:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               logoUrl:
 *                                 type: string
 *                               website:
 *                                 type: string
 *                           partnershipType:
 *                             type: string
 *                             enum: [SPONSOR, IN_KIND, TECHNICAL, VENUE, OTHER]
 *                           startedAt:
 *                             type: string
 *                             format: date
 *                           endedAt:
 *                             type: string
 *                             format: date
 *                           value:
 *                             type: string
 *                             description: Monetary value
 *                           isActive:
 *                             type: boolean
 *                           project:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                           event:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
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
 *         description: Forbidden - requires MEMBER or ADMIN profile
 */
partnershipsRouter.get(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetPartnershipsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.getPartnerships(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/partnerships/{id}:
 *   get:
 *     summary: Get partnership details
 *     description: Returns detailed information about a specific partnership
 *     tags: [Partnerships]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partnership ID
 *     responses:
 *       200:
 *         description: Partnership details retrieved successfully
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
 *                     organization:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         logoUrl:
 *                           type: string
 *                         website:
 *                           type: string
 *                         description:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                     partnershipType:
 *                       type: string
 *                       enum: [SPONSOR, IN_KIND, TECHNICAL, VENUE, OTHER]
 *                     startedAt:
 *                       type: string
 *                       format: date
 *                     endedAt:
 *                       type: string
 *                       format: date
 *                     value:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     metadata:
 *                       type: string
 *                     contractDocument:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         type:
 *                           type: string
 *                     project:
 *                       type: object
 *                     event:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Partnership not found
 */
partnershipsRouter.get(
  "/:id",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.getPartnership(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/partnerships:
 *   post:
 *     summary: Create a new partnership
 *     description: Creates a new partnership record with optional contract document. Requires ADMIN privileges.
 *     tags: [Partnerships]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - organizationId
 *               - partnershipType
 *               - startedAt
 *             properties:
 *               organizationId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the partner organization
 *               partnershipType:
 *                 type: string
 *                 enum: [SPONSOR, IN_KIND, TECHNICAL, VENUE, OTHER]
 *                 description: Type of partnership
 *               projectId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated project ID (optional)
 *               eventId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated event ID (optional)
 *               startedAt:
 *                 type: string
 *                 format: date
 *                 description: Partnership start date
 *               endedAt:
 *                 type: string
 *                 format: date
 *                 description: Partnership end date (optional)
 *               value:
 *                 type: number
 *                 description: Monetary value of the partnership
 *               metadata:
 *                 type: string
 *                 description: Additional structured data as JSON string
 *               contractDocument:
 *                 type: string
 *                 format: binary
 *                 description: Contract document file (PDF, DOC, or image, max 10MB)
 *     responses:
 *       201:
 *         description: Partnership created successfully
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
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN profile
 *       404:
 *         description: Referenced organization, project, or event not found
 */
partnershipsRouter.post(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  documentsUpload.single("contractDocument"),
  validateFile(UploadContractDocumentSchema.optional()),
  validateBody(CreatePartnershipSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.createPartnership({
        data: req.Body,
        contractDocument: req.file,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/partnerships/{id}:
 *   patch:
 *     summary: Update a partnership
 *     description: Updates an existing partnership. Requires ADMIN privileges.
 *     tags: [Partnerships]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partnership ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               partnershipType:
 *                 type: string
 *                 enum: [SPONSOR, IN_KIND, TECHNICAL, VENUE, OTHER]
 *               projectId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               eventId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               startedAt:
 *                 type: string
 *                 format: date
 *               endedAt:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               value:
 *                 type: number
 *               metadata:
 *                 type: string
 *                 nullable: true
 *               contractDocumentId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Partnership updated successfully
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
 *                     message:
 *                       type: string
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN profile
 *       404:
 *         description: Partnership not found
 */
partnershipsRouter.patch(
  "/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdatePartnershipSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.updatePartnership(
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
 * /api/v1/partnerships/{id}:
 *   delete:
 *     summary: Delete a partnership
 *     description: Permanently deletes a partnership. Requires ADMIN privileges.
 *     tags: [Partnerships]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Partnership ID
 *     responses:
 *       200:
 *         description: Partnership deleted successfully
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
 *                     message:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN profile
 *       404:
 *         description: Partnership not found
 */
partnershipsRouter.delete(
  "/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await partnershipsHandler.deletePartnership(
        req.Params.id,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default partnershipsRouter;
