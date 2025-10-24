import { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { authenticateLax, authorize } from "@/shared/middlewares/auth";
import { validateQuery } from "@/shared/middlewares/validate";
import * as membersHandler from "./membersHandler";
import { GetMembersQuerySchema } from "@/shared/validators/core";
import { Visitors } from "@/configs/authorizer";

const membersRouter = Router();

/**
 * @swagger
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
membersRouter.get(
  "/",
  authenticateLax,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetMembersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await membersHandler.getMembers(req.Query); // we know its safe because of validateParams
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default membersRouter;
