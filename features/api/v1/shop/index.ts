import { Request, Response, NextFunction, Router } from "express";
import { authenticate, authorize } from "@/shared/middlewares/auth";
import {
  validateBody,
  validateFile,
  validateQuery,
  validateParams,
} from "@/shared/middlewares/validate";
import { Visitors } from "@/configs/authorizer";
import filesUpload from "@/shared/middlewares/multipart";
import { rateLimit } from "@/shared/middlewares/rateLimit";
import * as shopHandler from "./shopHandler";
import {
  CreateOrderSchema,
  InitiateGuestOrderSchema,
  CompleteGuestOrderSchema,
  ValidateOrderItemsSchema,
  GetShopProductsQuerySchema,
  CreateProductSchema,
  UpdateProductSchema,
  UploadProductFileSchema,
  UploadProductMediumOptionsSchema,
  UpdateProductMediumSchema,
  GetProductMediaQuerySchema,
  GetAdminOrdersQuerySchema,
  UpdateAdminOrderStatusSchema,
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
  // Audit I1 — every initiate sends an OTP email and reserves stock. Cap at
  // 5 per 5-min window per IP to keep spammers from torching our SMTP quota.
  rateLimit({ windowMs: 5 * 60 * 1000, maxRequests: 5 }),
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
  // Audit I1 — OTP verification + Paystack init happens here. 10 attempts
  // per 5-min window per IP covers retry-after-typo without enabling
  // brute-force of the 6-digit OTP.
  rateLimit({ windowMs: 5 * 60 * 1000, maxRequests: 10 }),
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
// ADMIN ORDER MANAGEMENT ROUTES (Audit C2)
// ========================
// Namespaced under /orders/admin/* so they don't collide with /orders (user
// scope) or /orders/by-ref/:ref (public success-page polling). Admin-only.

shopRouter.get(
  "/orders/admin",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetAdminOrdersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.getAdminOrders(req.Query);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// CSV export of every order matching the same filters as /orders/admin.
// Same auth as the list. Streams to keep memory bounded on large dumps.
shopRouter.get(
  "/orders/admin/export.csv",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateQuery(GetAdminOrdersQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await shopHandler.exportAdminOrdersCsv(req.Query, res);
    } catch (err) {
      next(err);
    }
  },
);

shopRouter.get(
  "/orders/admin/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid order ID") })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.getAdminOrderById(req.Params.id);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

shopRouter.patch(
  "/orders/admin/:id",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid order ID") })),
  validateBody(UpdateAdminOrderStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.updateAdminOrderStatus(
        req.Params.id,
        req.Body,
      );
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

// ========================
// PRODUCT MEDIA ROUTES (Phase 1.1)
// ========================

// Public — list media for a product (used by shop detail page).
shopRouter.get(
  "/products/:id/media",
  validateParams(z.object({ id: z.uuid("Invalid product ID") })),
  validateQuery(GetProductMediaQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.getProductMedia(
        req.Params.id,
        req.Query,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// Admin-only — upload a new product image/video.
shopRouter.post(
  "/products/:id/media",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(z.object({ id: z.uuid("Invalid product ID") })),
  filesUpload.mediaUpload.single("file"),
  validateFile(UploadProductFileSchema),
  validateBody(UploadProductMediumOptionsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.uploadProductMedium({
        constituentId: req.User!.constituentId,
        productId: req.Params.id,
        file: req.File,
        options: req.Body,
      });
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// Admin-only — update caption / featured flag.
shopRouter.patch(
  "/products/:productId/media/:mediumId",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(
    z.object({ productId: z.uuid(), mediumId: z.uuid() }),
  ),
  validateBody(UpdateProductMediumSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.updateProductMedium(
        req.Params.productId,
        req.Params.mediumId,
        req.Body,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

// Admin-only — remove a media row + best-effort delete underlying asset.
shopRouter.delete(
  "/products/:productId/media/:mediumId",
  authenticate,
  authorize(Visitors.hasProfile("ADMIN")),
  validateParams(
    z.object({ productId: z.uuid(), mediumId: z.uuid() }),
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await shopHandler.deleteProductMedium(
        req.Params.productId,
        req.Params.mediumId,
      );
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default shopRouter;
