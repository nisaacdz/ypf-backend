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
import * as membersHandler from "./membersHandler";
import {
  GetMembersQuerySchema,
  EnrollMemberSchema,
  UnenrollMemberSchema,
  EnrollRoleSchema,
  UnenrollRoleSchema,
  GetRolesQuerySchema,
  GetLeadershipQuerySchema,
} from "./schemas";
import { Visitors, ADMIN, MEMBER, anyOf } from "@/configs/authorizer";
import z from "zod";

const membersRouter = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Member:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         publicId:
 *           type: string
 *         profilePhotoUrl:
 *           type: string
 *         fullName:
 *           type: string
 *         startedAt:
 *           type: string
 *           format: date-time
 *         title:
 *           type: string
 *     MemberDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         publicId:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         salutation:
 *           type: string
 *         profilePhoto:
 *           $ref: '#/components/schemas/Medium'
 *         contactInfo:
 *           type: object
 *           properties:
 *             phone:
 *               type: string
 *             whatsapp:
 *               type: string
 *             email:
 *               type: string
 *         titles:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               scope:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: ['chapter', 'committee']
 *                   name:
 *                     type: string
 *                   id:
 *                     type: string
 *               _level:
 *                 type: number
 *               startedAt:
 *                 type: string
 *                 format: date-time
 *               endedAt:
 *                 type: string
 *                 format: date-time
 *         startedAt:
 *           type: string
 *           format: date-time
 *         endedAt:
 *           type: string
 *           format: date-time
 *     MemberRole:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *         alias:
 *           type: string
 *         _level:
 *           type: number
 *         scope:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: ['chapter', 'committee']
 *             name:
 *               type: string
 *             id:
 *               type: string
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
 * /api/v1/members:
 *   get:
 *     summary: Get list of members
 *     tags: [Members]
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
 *         name: committeeId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by committee ID
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
 *         description: Members list retrieved successfully
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
 *                     members:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Member'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         pageSize:
 *                           type: integer
 *                         total:
 *                           type: integer
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
membersRouter.get(
  "/",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetMembersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getMembers(req.Query); // we know its safe because of validateQuery
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/members/{constituentId}:
 *   get:
 *     summary: Get a single member by ID
 *     tags: [Members]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: constituentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Constituent ID - Note that members are identified by their constituent ID
 *     responses:
 *       200:
 *         description: Member details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/MemberDetail'
 *       400:
 *         description: Invalid member ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires MEMBER or ADMIN profile
 *       404:
 *         description: Member not found
 */
membersRouter.get(
  "/:constituentId",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateParams(z.object({ constituentId: z.uuid("Member not found ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getMember(req.Params.constituentId);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/members/enroll:
 *   post:
 *     summary: Enroll a constituent as a global member
 *     tags: [Members]
 *     security:
 *       - cookieAuth: []
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
 *         description: Member enrolled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role
 */
membersRouter.post(
  "/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(EnrollMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.enrollMember(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/members/unenroll:
 *   patch:
 *     summary: Unenroll a constituent from global membership
 *     tags: [Members]
 *     security:
 *       - cookieAuth: []
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
 *         description: Member unenrolled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role
 *       404:
 *         description: No active membership found
 */
membersRouter.patch(
  "/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateBody(UnenrollMemberSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.unenrollMember(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/members/roles:
 *   get:
 *     summary: Get paginated list of member roles/titles
 *     description: Search roles by title or alias. Returns { id, title, alias, _level, scope }
 *     tags: [Members]
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
 *         description: Search by role title or alias
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
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
 *                         $ref: '#/components/schemas/MemberRole'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer }
 *                         pageSize: { type: integer }
 *                         total: { type: integer }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN or MEMBER leader role
 */
membersRouter.get(
  "/roles",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER))
  ),
  validateQuery(GetRolesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getRoles(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/members/leadership:
 *   get:
 *     summary: Get global leadership
 *     description: Returns members with active global role assignments (roles not scoped to chapter/committee)
 *     tags: [Members]
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
 *     responses:
 *       200:
 *         description: Leadership retrieved successfully
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires ADMIN or MEMBER leader role
 */
membersRouter.get(
  "/leadership",
  authenticate,
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER))
  ),
  validateQuery(GetLeadershipQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getLeadership(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/members/roles/{id}/enroll:
 *   post:
 *     summary: Assign a role to a member
 *     tags: [Members]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Role/Title ID
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
 *         description: Role assigned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role
 *       404:
 *         description: No active membership found
 */
membersRouter.post(
  "/roles/:id/enroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid role ID") })),
  validateBody(EnrollRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.enrollRole(req.Params.id, req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/members/roles/{id}/unenroll:
 *   patch:
 *     summary: Unassign a role from a member
 *     tags: [Members]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Role/Title ID
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
 *         description: Role unassigned successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires SUPER_ADMIN role
 *       404:
 *         description: No active role assignment found
 */
membersRouter.patch(
  "/roles/:id/unenroll",
  authenticate,
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  validateParams(z.object({ id: z.uuid("Invalid role ID") })),
  validateBody(UnenrollRoleSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.unenrollRole(
        req.Params.id,
        req.Body
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default membersRouter;
