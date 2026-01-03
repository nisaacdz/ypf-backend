import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateQuery,
  validateParams,
  validateBody,
} from "@/shared/middlewares/validate";
import * as constituentsHandler from "./constituentsHandler";
import {
  GetConstituentsQuerySchema,
  OnboardConstituentSchema,
} from "./schemas";
import { Visitors, MEMBER, ADMIN, anyOf } from "@/configs/authorizer";
import z from "zod";
import variables from "@/configs/env";

const constituentsRouter = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Constituent:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         profilePhotoUrl:
 *           type: string
 *         fullName:
 *           type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         profiles:
 *           type: array
 *           items:
 *             type: string
 *         roles:
 *           type: array
 *           items:
 *             type: string
 *     ConstituentDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         preferredName:
 *           type: string
 *         profilePhoto:
 *           $ref: '#/components/schemas/Medium'
 *         profiles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               endedAt:
 *                 type: string
 *                 format: date-time
 *         roles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               profile:
 *                 type: string
 *               title:
 *                 type: string
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               endedAt:
 *                 type: string
 *                 format: date-time
 *         committees:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *               featuredPhotoUrl:
 *                 type: string
 *               chapterName:
 *                 type: string
 *         chapters:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *               country:
 *                 type: string
 *               featuredPhotoUrl:
 *                 type: string
 *     Medium:
 *       type: object
 *       properties:
 *         url:
 *           type: string
 *         type:
 *           type: string
 *         dimensions:
 *           type: object
 *           properties:
 *             width:
 *               type: number
 *             height:
 *               type: number
 *         size:
 *           type: number
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *
 * /api/v1/constituents:
 *   get:
 *     summary: Get list of constituents
 *     description: Retrieve a paginated list of constituents. Accessible by ADMINs and MEMBER leaders.
 *     tags: [Constituents]
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
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
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
 *                         $ref: '#/components/schemas/Constituent'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         pageSize:
 *                           type: integer
 *                         total:
 *                           type: integer
 *       403:
 *         description: Forbidden
 */
constituentsRouter.get(
  "/",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER))
  ),
  validateQuery(GetConstituentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await constituentsHandler.getConstituents(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/constituents/onboard:
 *   post:
 *     summary: Onboard constituents to the platform
 *     description: Creates User accounts for constituents and sends invitation emails. Only accessible by SUPER_ADMIN.
 *     tags: [Constituents]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 description: Array of constituent IDs to onboard
 *     responses:
 *       200:
 *         description: Onboarding results
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
 *                     successful:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           constituentId:
 *                             type: string
 *                           error:
 *                             type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role
 */
constituentsRouter.post(
  "/onboard",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(OnboardConstituentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dashboardUrl = `${variables.app.dashboardUrl}/auth/onboarding`;
      const response = await constituentsHandler.onboardConstituent(
        req.Body,
        dashboardUrl
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/constituents/{constituentId}:
 *   get:
 *     summary: Get constituent details
 *     description: Retrieve detailed information for a specific constituent.
 *     tags: [Constituents]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: constituentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Success
 *       404:
 *         description: Not Found
 */
constituentsRouter.get(
  "/:constituentId",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER))
  ),
  validateParams(z.object({ constituentId: z.uuid("Invalid constituent ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await constituentsHandler.getConstituent(
        req.Params.constituentId
      );
      if (!response.data) {
        res
          .status(404)
          .json({ success: false, error: "Constituent not found" });
        return;
      }
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default constituentsRouter;
