import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import { Visitors } from "@/configs/authorizer";
import {
  InitiateDuesPaymentSchema,
  GetMemberDuesPaymentsQuerySchema,
  GetDuesQuerySchema,
} from "./schemas";
import * as duesHandler from "./duesHandler";
import * as duesService from "@/shared/services/duesService";
import z from "zod";
import { ApiError } from "@/shared/types";

const duesRouter = Router();

/**
 * @swagger
 * /api/v1/dues:
 *   get:
 *     summary: Get all available dues
 *     description: Returns a paginated list of available dues (global dues where chapterId is null)
 *     tags: [Dues]
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
 *     responses:
 *       200:
 *         description: Dues list retrieved successfully
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
 *                           amount:
 *                             type: string
 *                           currency:
 *                             type: string
 *                           periodStart:
 *                             type: string
 *                             format: date
 *                           periodEnd:
 *                             type: string
 *                             format: date
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - requires MEMBER profile
 */
duesRouter.get(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER", "ADMIN")),
  validateQuery(GetDuesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await duesHandler.getAvailableDues(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/dues/{duesId}/status:
 *   get:
 *     summary: Get payment status for a specific dues
 *     description: Returns the payment status for a specific dues including total paid, remaining balance, and payment history
 *     tags: [Dues]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: duesId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Dues ID
 *     responses:
 *       200:
 *         description: Dues status retrieved successfully
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
 *                     dues:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         amount:
 *                           type: string
 *                         currency:
 *                           type: string
 *                         periodStart:
 *                           type: string
 *                           format: date
 *                         periodEnd:
 *                           type: string
 *                           format: date
 *                     totalPaid:
 *                       type: string
 *                       description: Total amount paid so far
 *                     remainingBalance:
 *                       type: string
 *                       description: Amount still owed
 *                     isFullyPaid:
 *                       type: boolean
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           amount:
 *                             type: string
 *                           currency:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - requires MEMBER profile
 *       404:
 *         description: Dues not found
 */
duesRouter.get(
  "/:duesId/status",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER")),
  validateParams(z.object({ duesId: z.string().uuid() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await duesService.getActiveMember(req.User!.constituentId);
      if (!member) {
        throw new ApiError(
          "You must be an active member to view dues status",
          403,
        );
      }

      const response = await duesHandler.getMemberDuesStatus(
        member.id,
        req.Params.duesId,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/dues/payments:
 *   get:
 *     summary: Get payment history for the authenticated member
 *     description: Returns a paginated list of all dues payments made by the authenticated member
 *     tags: [Dues]
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
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
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
 *                           duesId:
 *                             type: string
 *                             format: uuid
 *                           amount:
 *                             type: string
 *                           currency:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           periodStart:
 *                             type: string
 *                             format: date
 *                           periodEnd:
 *                             type: string
 *                             format: date
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - requires MEMBER profile
 */
duesRouter.get(
  "/payments",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER")),
  validateQuery(GetMemberDuesPaymentsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await duesService.getActiveMember(req.User!.constituentId);
      if (!member) {
        throw new ApiError(
          "You must be an active member to view payment history",
          403,
        );
      }

      const response = await duesHandler.getMemberDuesPayments(
        member.id,
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
 * /api/v1/dues/pay:
 *   post:
 *     summary: Initiate a dues payment
 *     description: |
 *       Initiates a dues payment via Paystack. Supports partial payments -
 *       you can pay any amount up to the remaining balance on the dues.
 *       Returns a Paystack payment URL to complete the transaction.
 *     tags: [Dues]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - duesId
 *               - amount
 *             properties:
 *               duesId:
 *                 type: string
 *                 format: uuid
 *                 description: The ID of the dues to pay
 *               amount:
 *                 type: number
 *                 description: Amount to pay (can be partial)
 *                 example: 50.00
 *               currency:
 *                 type: string
 *                 description: Currency code (defaults to GHS)
 *                 default: GHS
 *                 example: GHS
 *     responses:
 *       200:
 *         description: Payment initiated successfully
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
 *                     paymentId:
 *                       type: string
 *                       format: uuid
 *                       description: ID of the dues payment record
 *                     paymentUrl:
 *                       type: string
 *                       description: Paystack URL to complete payment
 *       400:
 *         description: Invalid request - dues already paid or amount exceeds balance
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - requires MEMBER profile
 *       404:
 *         description: Dues not found
 *       500:
 *         description: Failed to initialize payment
 */
duesRouter.post(
  "/pay",
  authenticate,
  authorize(Visitors.hasProfile("MEMBER")),
  validateBody(InitiateDuesPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await duesHandler.initiateDuesPayment(
        req.Body,
        req.User!,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default duesRouter;
