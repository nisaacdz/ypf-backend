import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import {
  validateQuery,
  validateParams,
  validateBody,
} from "@/shared/middlewares/validate";
import * as committeesHandler from "./committeesHandler";
import {
  GetCommitteesQuerySchema,
  GetConstituentCommitteesQuerySchema,
  GetCommitteeLeadershipQuerySchema,
  EnrollCommitteeSchema,
  UnenrollCommitteeSchema,
} from "./schemas";
import { Visitors, anyOf, ADMIN } from "@/configs/authorizer";
import z from "zod";

const committeesRouter = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Committee:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         featuredPhotoUrl:
 *           type: string
 *         chapterName:
 *           type: string
 *         memberCount:
 *           type: integer
 *     CommitteeDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         featuredMedia:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               caption:
 *                 type: string
 *               medium:
 *                 $ref: '#/components/schemas/Medium'
 *         chapter:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
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
 * /api/v1/committees:
 *   get:
 *     summary: Get list of committees
 *     tags: [Committees]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: chapterId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by chapter ID
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
 *         description: Committees list retrieved successfully
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
 *                         $ref: '#/components/schemas/Committee'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         pageSize: { type: integer }
 *                         total: { type: integer }
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
committeesRouter.get(
  "/",
  authorize(Visitors.ALL),
  validateQuery(GetCommitteesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommittees(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/committees/constituents/{constituentId}:
 *   get:
 *     summary: Get committees for a specific constituent
 *     description: Returns a paginated list of committees that the constituent is a member of. Only accessible by the constituent themselves or ADMINs.
 *     tags: [Committees]
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
 *         description: Committees list retrieved successfully
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
 *         description: Forbidden - can only access own committees or requires ADMIN profile
 */
committeesRouter.get(
  "/constituents/:constituentId",
  authenticate,
  validateParams(z.object({ constituentId: z.string() })),
  validateQuery(GetConstituentCommitteesQuerySchema),
  authorize(
    anyOf(
      Visitors.hasProfile("ADMIN"),
      Visitors.hasID((req) => req.Params.constituentId)
    )
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommitteesByConstituentId(
        req.Params.constituentId,
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
 * /api/v1/committees/{id}:
 *   get:
 *     summary: Get a single committee by ID
 *     tags: [Committees]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Committee ID
 *     responses:
 *       200:
 *         description: Committee details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CommitteeDetail'
 *       400:
 *         description: Invalid committee ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires MEMBER or ADMIN profile
 *       404:
 *         description: Committee not found
 */
committeesRouter.get(
  "/:id",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommittee(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/committees/{id}/leadership:
 *   get:
 *     summary: Get committee leadership
 *     tags: [Committees]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Committee ID
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
 *         description: Committee leadership retrieved successfully
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
 *                         $ref: '#/components/schemas/Member'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         pageSize: { type: integer }
 *                         total: { type: integer }
 *       400:
 *         description: Invalid committee ID or query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires MEMBER or ADMIN profile
 *       404:
 *         description: Committee not found
 */
committeesRouter.get(
  "/:id/leadership",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  validateQuery(GetCommitteeLeadershipQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getLeadership(
        req.Params.id,
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
 * /api/v1/committees/{id}/enroll:
 *   post:
 *     summary: Enroll a constituent to a committee
 *     tags: [Committees]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Committee ID
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
committeesRouter.post(
  "/:id/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  validateBody(EnrollCommitteeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.enrollToCommittee(
        req.Params.id,
        req.Body
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/committees/{id}/unenroll:
 *   patch:
 *     summary: Unenroll a constituent from a committee
 *     tags: [Committees]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Committee ID
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
 *         description: No active committee membership found
 */
committeesRouter.patch(
  "/:id/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid committee ID") })),
  validateBody(UnenrollCommitteeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.unenrollFromCommittee(
        req.Params.id,
        req.Body
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default committeesRouter;
