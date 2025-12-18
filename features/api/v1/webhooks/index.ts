import { NextFunction, Request, Response } from "express";
import { verifyPaystackSignature } from "@/shared/middlewares/webhooks";
import { Router } from "express";
import { handlePaystackWebhook } from "./webhooksHandler";

const webhooksRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Webhook handlers for external services
 */

/**
 * @swagger
 * /api/v1/webhooks/paystack:
 *   post:
 *     summary: Handle Paystack webhook events
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Paystack event payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
webhooksRouter.post(
  "/paystack",
  verifyPaystackSignature,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await handlePaystackWebhook(req.body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default webhooksRouter;
