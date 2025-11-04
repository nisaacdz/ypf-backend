import { Request, Response, NextFunction, Router } from "express";
import { authenticate } from "@/shared/middlewares/auth";
import { validateBody } from "@/shared/middlewares/validate";
import {
  CreateOrderSchema,
  InitiateGuestOrderSchema,
  CompleteGuestOrderSchema,
} from "@/shared/validators/shop";
import * as shopHandler from "./shopHandler";

const shopRouter = Router();

/**
 * @swagger
 * /api/v1/shop/orders:
 *   post:
 *     summary: Create a new order (authenticated users)
 *     tags: [Shop]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: number
 *               currency:
 *                 type: string
 *                 default: GHS
 *     responses:
 *       200:
 *         description: Order created successfully
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
 *                     orderId:
 *                       type: string
 *                       format: uuid
 *                     paymentUrl:
 *                       type: string
 *       400:
 *         description: Invalid request or insufficient stock
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
shopRouter.post(
  "/orders",
  authenticate,
  validateBody(CreateOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.createOrder(req.Body, req.User!);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/shop/orders/guest/initiate:
 *   post:
 *     summary: Initiate a guest order (sends OTP)
 *     tags: [Shop]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - items
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: number
 *               currency:
 *                 type: string
 *                 default: GHS
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request or insufficient stock
 *       500:
 *         description: Server error
 */
shopRouter.post(
  "/orders/guest/initiate",
  validateBody(InitiateGuestOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.initiateGuestOrder(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/shop/orders/guest/complete:
 *   post:
 *     summary: Complete a guest order (after OTP verification)
 *     tags: [Shop]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order created successfully
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
 *                     orderId:
 *                       type: string
 *                       format: uuid
 *                     paymentUrl:
 *                       type: string
 *       400:
 *         description: Invalid OTP or request
 *       500:
 *         description: Server error
 */
shopRouter.post(
  "/orders/guest/complete",
  validateBody(CompleteGuestOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.completeGuestOrder(req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/shop/orders:
 *   get:
 *     summary: Get user's order history
 *     tags: [Shop]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       totalAmount:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       itemCount:
 *                         type: number
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
shopRouter.get(
  "/orders",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.getUserOrders(req.User!);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default shopRouter;
