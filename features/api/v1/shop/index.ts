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

// ========================
// PUBLIC PRODUCT ROUTES
// ========================

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

shopRouter.get(
  "/products/:id/related",
  validateParams(z.object({ id: z.uuid("Invalid product ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.getRelatedProducts(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ========================
// ORDER ROUTES
// ========================

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

// Plan §8.8 — public success-page polling. No PII; status + total + itemCount.
shopRouter.get(
  "/orders/by-ref/:ref",
  validateParams(z.object({ ref: z.string().min(8).max(100) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.getOrderByRef(req.Params.ref);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// ========================
// AUTHENTICATED ORDER ROUTES
// ========================

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
