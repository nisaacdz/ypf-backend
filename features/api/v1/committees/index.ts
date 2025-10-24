import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { authenticateLax, authorize } from "@/shared/middlewares/auth";
import { validateQuery, validateParams } from "@/shared/middlewares/validate";
import * as committeesHandler from "./committeesHandler";
import { GetCommitteesQuerySchema } from "@/shared/validators/core";
import { Visitors } from "@/configs/authorizer";
import z from "zod";

const committeesRouter = Router();

/**
 * @swagger
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
committeesRouter.get(
  "/",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetCommitteesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await committeesHandler.getCommittees(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
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
 *                   type: object
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
  },
);

export default committeesRouter;
