import { Request, Response, NextFunction, Router } from "express";
import {
  authenticateLax,
  authenticate,
  authorize,
} from "@/shared/middlewares/auth";
import { validateBody, validateQuery } from "@/shared/middlewares/validate";
import { CreateDonationSchema, GetDonationsQuerySchema } from "./schemas";
import { Visitors } from "@/configs/authorizer";
import * as donationsHandler from "./donationsHandler";

const donationsRouter = Router();

/**
 * @swagger
 * /api/v1/donations/paystack:
 *   post:
 *     summary: Create a new donation via Paystack
 *     tags: [Donations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Donation amount
 *                 example: 100
 *               currency:
 *                 type: string
 *                 description: Currency code (defaults to GHS)
 *                 example: GHS
 *                 default: GHS
 *               anonymous:
 *                 type: boolean
 *                 description: Whether this is an anonymous donation
 *                 default: false
 *               donorInfo:
 *                 type: object
 *                 description: Donor information (required for non-anonymous guest donations)
 *                 properties:
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   phone:
 *                     type: string
 *                   salutation:
 *                     type: string
 *               projectId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated project ID
 *               eventId:
 *                 type: string
 *                 format: uuid
 *                 description: Associated event ID
 *     responses:
 *       200:
 *         description: Donation created successfully
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
 *                     donation:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         amount:
 *                           type: string
 *                         currency:
 *                           type: string
 *                         donor:
 *                           type: object
 *                           properties:
 *                             firstName:
 *                               type: string
 *                             lastName:
 *                               type: string
 *                             salutation:
 *                               type: string
 *                     paymentUrl:
 *                       type: string
 *                       description: Paystack payment URL
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
donationsRouter.post(
  "/paystack",
  authenticateLax,
  validateBody(CreateDonationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await donationsHandler.initiatePaystackDonation(
        req.Body,
        req.User || null,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/donations:
 *   get:
 *     summary: Get list of donations
 *     tags: [Donations]
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
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date (ISO 8601)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *         description: Filter by transaction status
 *     responses:
 *       200:
 *         description: Donations list retrieved successfully
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
 *         description: Forbidden - requires ADMIN profile
 */
donationsRouter.get(
  "/",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetDonationsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await donationsHandler.getDonations(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default donationsRouter;
