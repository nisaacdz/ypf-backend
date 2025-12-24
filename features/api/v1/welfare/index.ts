import { Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import { ADMIN, anyOf, MEMBER, Visitors } from "@/configs/authorizer";
import * as welfareHandler from "./welfareHandler";
import {
  GetWelfareCasesQuerySchema,
  CreateWelfareCaseSchema,
  UpdateWelfareCaseSchema,
} from "./schemas";
import z from "zod";

const welfareRouter = Router();

/**
 * @swagger
 * /api/v1/welfare:
 *   get:
 *     summary: Get all welfare cases
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: filterType
 *         schema:
 *           type: string
 *           enum: [MEDICAL, EDUCATIONAL, FUNERAL, FINANCIAL_SUPPORT, OTHER]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of welfare cases
 */
welfareRouter.get(
  "/",
  validateQuery(GetWelfareCasesQuerySchema),
  async (req, res, next) => {
    try {
      const response = await welfareHandler.getWelfareCases(req.Query);
      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/welfare/{id}:
 *   get:
 *     summary: Get welfare case by ID
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Welfare case details
 *       404:
 *         description: Welfare case not found
 */
welfareRouter.get(
  "/:id",
  validateParams(z.object({ id: z.uuid() })),
  async (req, res, next) => {
    try {
      const response = await welfareHandler.getWelfareCase(req.params.id);
      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

// Admin-only routes below
welfareRouter.use(authorize(Visitors.hasProfile("ADMIN")));

/**
 * @swagger
 * /api/v1/welfare:
 *   post:
 *     summary: Create a new welfare case (Admin only)
 *     tags: [Welfare]
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
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               type:
 *                 type: string
 *                 enum: [MEDICAL, EDUCATIONAL, FUNERAL, FINANCIAL_SUPPORT, OTHER]
 *               beneficiaryIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       201:
 *         description: Welfare case created
 */
welfareRouter.post(
  "/",
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER)),
  ),
  validateBody(CreateWelfareCaseSchema),
  async (req, res, next) => {
    try {
      const response = await welfareHandler.createWelfareCase(req.Body);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/welfare/{id}:
 *   patch:
 *     summary: Update a welfare case (Admin only)
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               type:
 *                 type: string
 *                 enum: [MEDICAL, EDUCATIONAL, FUNERAL, FINANCIAL_SUPPORT, OTHER]
 *     responses:
 *       200:
 *         description: Welfare case updated
 *       404:
 *         description: Welfare case not found
 */
welfareRouter.patch(
  "/:id",
  validateParams(z.object({ id: z.uuid("Invalid welfarecase id") })),
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER)),
  ),
  validateBody(UpdateWelfareCaseSchema),
  async (req, res, next) => {
    try {
      const response = await welfareHandler.updateWelfareCase(
        req.Params.id,
        req.Body,
      );
      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/welfare/{id}:
 *   delete:
 *     summary: Delete a welfare case (Admin only)
 *     tags: [Welfare]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Welfare case deleted
 *       404:
 *         description: Welfare case not found
 */
welfareRouter.delete(
  "/:id",
  validateParams(z.object({ id: z.uuid("Invalid welfarecase id") })),
  authorize(Visitors.hasRole(ADMIN.SUPER)),
  async (req, res, next) => {
    try {
      const response = await welfareHandler.deleteWelfareCase(req.Params.id);
      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

welfareRouter.post(
  "/:id/beneficiaries",
  authenticate,
  validateParams(z.object({ id: z.uuid("Invalid welfarecase id") })),
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER)),
  ),
  validateBody(z.array(z.uuid("Invalid id format"))),
  async (req, res, next) => {
    try {
      const response = await welfareHandler.addWelfareCaseBeneficiaries(
        req.Params.id,
        req.Body,
      );
      const ids = req.Body;
    } catch (error) {
      next(error);
    }
  },
);

welfareRouter.delete(
  "/:id/beneficiaries/:beneficiaryId",
  validateParams(
    z.object({
      id: z.uuid("Invalid welfarecase id"),
      beneficiaryId: z.uuid("Invalid beneficiary id"),
    }),
  ),
  authorize(
    anyOf(Visitors.hasProfile("ADMIN"), Visitors.hasRole(MEMBER.LEADER)),
  ),
  async (req, res, next) => {
    try {
      const response = await welfareHandler.removeWelfareCaseBeneficiary(
        req.Params.id,
        req.Params.beneficiaryId,
      );
      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/welfare/{id}/events:
 *   get:
 *     summary: Get events associated with a welfare case
 *     tags: [Welfare]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: Welfare case events retrieved successfully
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
 *       404:
 *         description: Welfare case not found
 */
welfareRouter.get(
  "/:id/events",
  validateParams(z.object({ id: z.uuid("Invalid welfare case id") })),
  validateQuery(
    z.object({
      page: z.coerce.number().min(1).default(1).optional(),
      pageSize: z.coerce.number().min(1).max(100).default(10).optional(),
    }),
  ),
  async (req, res, next) => {
    try {
      const response = await welfareHandler.getWelfareCaseEvents(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default welfareRouter;
