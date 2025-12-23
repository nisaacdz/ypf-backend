import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import { Visitors } from "@/configs/authorizer";
import * as shopHandler from "./shopHandler";
import {
  CreateOrderSchema,
  InitiateGuestOrderSchema,
  CompleteGuestOrderSchema,
  ValidateOrderItemsSchema,
  GetShopProductsQuerySchema,
  CreateProductSchema,
  UpdateProductSchema,
} from "./schemas";
import z from "zod";

const shopRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Shop
 *   description: Shop products and order management
 */

// ========================
// PUBLIC PRODUCT ROUTES
// ========================

/**
 * @swagger
 * /api/v1/shop/products:
 *   get:
 *     summary: Get list of shop products
 *     tags: [Shop]
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
 *         name: onlyActive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter to show only active products
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Products fetched successfully
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
 *                           name:
 *                             type: string
 *                           sku:
 *                             type: string
 *                           price:
 *                             type: number
 *                           stockQuantity:
 *                             type: integer
 *                           previewUrl:
 *                             type: string
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 */
shopRouter.get(
  "/products",
  validateQuery(GetShopProductsQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.getProducts(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/shop/products/{id}:
 *   get:
 *     summary: Get a single product by ID
 *     tags: [Shop]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Product fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     name:
 *                       type: string
 *                     sku:
 *                       type: string
 *                     description:
 *                       type: string
 *                     price:
 *                       type: number
 *                     stockQuantity:
 *                       type: integer
 *                     gallery:
 *                       type: array
 *                       items:
 *                         type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Product not found
 */
shopRouter.get(
  "/products/:id",
  validateParams(z.object({ id: z.uuid("Invalid product ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.getProduct(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ========================
// ORDER ROUTES
// ========================

/**
 * @swagger
 * /api/v1/shop/orders/validate:
 *   post:
 *     summary: Validate order items before checkout
 *     tags: [Shop]
 *     description: Checks stock levels and product availability for each item in a cart. Invalid entries are omitted from the response instead of causing an error.
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
 *     responses:
 *       200:
 *         description: Returns only the items that passed validation along with the recomputed total amount.
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
 *                     validatedItems:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           productId:
 *                             type: string
 *                             format: uuid
 *                           quantity:
 *                             type: number
 *                           price:
 *                             type: string
 *                           name:
 *                             type: string
 *                     totalAmount:
 *                       type: number
 *       400:
 *         description: Invalid request payload
 *       500:
 *         description: Server error
 */
shopRouter.post(
  "/orders/validate",
  validateBody(ValidateOrderItemsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.validateOrderItems(req.Body);
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
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

// ========================
// AUTHENTICATED ORDER ROUTES
// ========================

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

// ========================
// ADMIN PRODUCT MANAGEMENT ROUTES
// ========================

/**
 * @swagger
 * /api/v1/shop/products:
 *   post:
 *     summary: Create a new product (Admin only)
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
 *               - name
 *               - sku
 *               - price
 *               - stockQuantity
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *               sku:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               description:
 *                 type: string
 *               price:
 *                 type: string
 *                 description: Price in decimal format (e.g., "49.99")
 *               stockQuantity:
 *                 type: integer
 *                 minimum: 0
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Product created successfully
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
 *                   type: string
 *                   format: uuid
 *                   description: The created product ID
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - Admin access required
 */
shopRouter.post(
  "/products",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateBody(CreateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.createProduct(req.Body);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/shop/products/{id}:
 *   put:
 *     summary: Update a product (Admin only)
 *     tags: [Shop]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 255
 *               sku:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *               description:
 *                 type: string
 *               price:
 *                 type: string
 *               stockQuantity:
 *                 type: integer
 *                 minimum: 0
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Product updated successfully
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
 *                   type: null
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Product not found
 */
shopRouter.put(
  "/products/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid product ID") })),
  validateBody(UpdateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.updateProduct(req.Params.id, req.Body);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /api/v1/shop/products/{id}:
 *   delete:
 *     summary: Delete a product (Admin only)
 *     tags: [Shop]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
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
 *                   type: null
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Product not found
 */
shopRouter.delete(
  "/products/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid product ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.deleteProduct(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default shopRouter;
