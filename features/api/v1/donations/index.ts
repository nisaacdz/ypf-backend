import { Request, Response, NextFunction, Router } from "express";
import { authenticateLax } from "@/shared/middlewares/auth";
import { validateBody, validateParams } from "@/shared/middlewares/validate";
import { CreateDonationSchema } from "@/shared/validators/donations";
import * as donationsHandler from "./donationsHandler";
import z from "zod";

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
 * /api/v1/donations/{id}/verify:
 *   patch:
 *     summary: Verify a donation payment status
 *     tags: [Donations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Donation ID
 *     responses:
 *       200:
 *         description: Donation verified successfully
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
 *                     status:
 *                       type: string
 *                       enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *       404:
 *         description: Donation not found
 *       500:
 *         description: Server error
 */
donationsRouter.patch(
  "/:id/verify",
  authenticateLax,
  validateParams(
    z.object({
      id: z.uuid("Invalid donation ID"),
    }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await donationsHandler.verifyDonation(
        req.Params.id,
        req.User ?? null,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/donations/{id}/check:
 *   get:
 *     summary: Check if a donation has been completed
 *     tags: [Donations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Donation ID
 *     responses:
 *       200:
 *         description: Donation status retrieved successfully
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
 *                     completed:
 *                       type: boolean
 *                     status:
 *                       type: string
 *                       enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Donation not found
 *       500:
 *         description: Server error
 */
donationsRouter.get(
  "/:id/check",
  authenticateLax,
  validateParams(
    z.object({
      id: z.uuid("Invalid donation ID"),
    }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await donationsHandler.checkDonation(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default donationsRouter;
