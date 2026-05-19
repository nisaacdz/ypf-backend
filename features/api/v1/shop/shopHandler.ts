import { ApiError, ApiResponse } from "@/shared/types";
import * as shopService from "@/shared/services/shopService";
import * as mediaUtils from "@/shared/utils/files";
import * as mediaService from "@/shared/services/mediaService";
import * as transactionsService from "@/shared/services/transactionsService";
import z from "zod";
import {
  CreateOrderSchema,
  InitiateGuestOrderSchema,
  CompleteGuestOrderSchema,
  GetShopProductsQuerySchema,
  GetProductMediaQuerySchema,
  CreateProductSchema,
  UpdateProductSchema,
  UpdateProductMediumSchema,
} from "./schemas";
import { OrderResponse, ValidatedOrderItems } from "@/shared/dtos/shop";
import { Paginated } from "@/shared/dtos";
import { ShopProduct, ShopProductDetail } from "./dtos";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import { eq, count } from "drizzle-orm";
import logger from "@/configs/logger";

/**
 * Handler for getting all shop products
 */
export async function getProducts(
  query: z.infer<typeof GetShopProductsQuerySchema>,
): Promise<ApiResponse<Paginated<ShopProduct>>> {
  const data = await shopService.fetchShopProducts(query);

  return {
    success: true,
    message: "Products fetched successfully",
    data,
  };
}

/**
 * Handler for getting a single product by ID
 */
export async function getProduct(
  productId: string,
): Promise<ApiResponse<ShopProductDetail>> {
  const data = await shopService.fetchShopProductById(productId);

  if (!data) {
    throw new ApiError("Product not found", 404);
  }

  return {
    success: true,
    message: "Product fetched successfully",
    data,
  };
}

/**
 * Handler for getting up to 3 related products (same category, excluding self).
 */
export async function getRelatedProducts(
  productId: string,
): Promise<ApiResponse<ShopProduct[]>> {
  const data = await shopService.fetchRelatedShopProducts(productId, 3);
  return {
    success: true,
    message: "Related products fetched successfully",
    data,
  };
}

/**
 * Plan §8.8 — public order success-page polling by Paystack reference.
 * No PII; returns status + total + itemCount.
 *
 * Webhook-loss fallback (mirrors getDonationByRef): when status is PENDING,
 * opportunistically call Paystack's /transaction/verify endpoint and refresh
 * the row if Paystack reports a terminal state. This is what makes the
 * success page work in local development (Paystack can't reach localhost)
 * and acts as a safety net in production for the rare case where a webhook
 * is dropped.
 */
export async function getOrderByRef(ref: string): Promise<
  ApiResponse<{
    orderId: string;
    status: "PENDING" | "COMPLETED" | "CANCELLED";
    totalAmount: string;
    currency: string;
    itemCount: number;
  }>
> {
  const selectByRef = () =>
    dbClient.db
      .select({
        orderId: schema.Orders.id,
        orderStatus: schema.Orders.status,
        totalAmount: schema.Orders.totalAmount,
        currency: schema.FinancialTransactions.currency,
      })
      .from(schema.FinancialTransactions)
      .innerJoin(
        schema.OrderPayments,
        eq(
          schema.OrderPayments.transactionId,
          schema.FinancialTransactions.id,
        ),
      )
      .innerJoin(
        schema.Orders,
        eq(schema.Orders.id, schema.OrderPayments.orderId),
      )
      .where(eq(schema.FinancialTransactions.externalRef, ref))
      .limit(1);

  let [row] = await selectByRef();

  if (!row) {
    throw new ApiError("Order not found", 404);
  }

  if (row.orderStatus === "PENDING") {
    try {
      const result = await transactionsService.verifyTransaction(ref);
      if (result.wasUpdated) {
        [row] = await selectByRef();
      }
    } catch (err) {
      // Verify failed (network, Paystack 4xx, etc.). Keep returning the
      // current PENDING state so the client keeps polling.
      logger.warn(
        { err, ref },
        "Paystack verify-on-poll failed for order; returning current status",
      );
    }
  }

  const [itemCountRow] = await dbClient.db
    .select({ n: count() })
    .from(schema.OrderItems)
    .where(eq(schema.OrderItems.orderId, row.orderId));

  return {
    success: true,
    data: {
      orderId: row.orderId,
      status: row.orderStatus,
      totalAmount: row.totalAmount,
      currency: row.currency,
      itemCount: Number(itemCountRow?.n ?? 0),
    },
  };
}

/**
 * Handler for creating a new product (admin only)
 */
export async function createProduct(
  body: z.infer<typeof CreateProductSchema>,
): Promise<ApiResponse<string>> {
  const productId = await shopService.createProduct(body);

  return {
    success: true,
    message: "Product created successfully",
    data: productId,
  };
}

/**
 * Handler for updating a product (admin only)
 */
export async function updateProduct(
  productId: string,
  body: z.infer<typeof UpdateProductSchema>,
): Promise<ApiResponse<null>> {
  await shopService.updateProduct(productId, body);

  return {
    success: true,
    message: "Product updated successfully",
    data: null,
  };
}

/**
 * Handler for deleting a product (admin only)
 */
export async function deleteProduct(
  productId: string,
): Promise<ApiResponse<null>> {
  await shopService.deleteProduct(productId);

  return {
    success: true,
    message: "Product deleted successfully",
    data: null,
  };
}

/**
 * Handler for creating an order for authenticated users
 */
export async function createOrder(
  body: z.infer<typeof CreateOrderSchema>,
  user: { constituentId: string; email: string; fullName: string },
): Promise<ApiResponse<OrderResponse>> {
  const result = await shopService.createAuthenticatedOrder(body, user as any);

  return {
    success: true,
    message: "Order created successfully. Please complete payment.",
    data: result,
  };
}

/**
 * Handler for initiating a guest order (sends OTP)
 */
export async function initiateGuestOrder(
  body: z.infer<typeof InitiateGuestOrderSchema>,
): Promise<ApiResponse<{ message: string }>> {
  const result = await shopService.initiateGuestOrder(body);

  return {
    success: true,
    message: result.message,
    data: { message: result.message },
  };
}

/**
 * Handler for completing a guest order (after OTP verification)
 */
export async function completeGuestOrder(
  body: z.infer<typeof CompleteGuestOrderSchema>,
): Promise<ApiResponse<OrderResponse>> {
  const result = await shopService.completeGuestOrder(body.email, body.otp);

  return {
    success: true,
    message: "Order created successfully. Please complete payment.",
    data: result,
  };
}

/**
 * Handler for getting user's order history
 */
export async function getUserOrders(user: { constituentId: string }): Promise<
  ApiResponse<
    Array<{
      id: string;
      totalAmount: string;
      status: string;
      createdAt: Date;
      itemCount: number;
    }>
  >
> {
  const orders = await shopService.getUserOrders(user as any);

  return {
    success: true,
    message: "Orders retrieved successfully",
    data: orders,
  };
}

export async function validateOrderItems(
  data: z.infer<typeof CreateOrderSchema>,
): Promise<ApiResponse<ValidatedOrderItems>> {
  const result = await shopService.validateOrderItems(data.items);

  return {
    success: true,
    message: "Order items are valid",
    data: result,
  };
}

// ─── Product media handlers (Phase 1.1) ─────────────────────────────────────

export async function uploadProductMedium({
  constituentId,
  productId,
  file,
  options,
}: {
  constituentId: string;
  productId: string;
  file: Express.Multer.File;
  options: { caption?: string; isFeatured: boolean };
}): Promise<ApiResponse<string>> {
  const uploadMeta = await mediaUtils.storeMediumFile(file);

  try {
    const newMediumId = await mediaService.uploadProductMedium(productId, {
      caption: options.caption,
      isFeatured: options.isFeatured,
      medium: {
        ...uploadMeta,
        uploadedBy: constituentId,
      },
    });

    return {
      success: true,
      message: "Media uploaded successfully",
      data: newMediumId,
    };
  } catch (error) {
    await mediaUtils.deleteMediumFile(uploadMeta.externalId);
    throw error;
  }
}

export async function getProductMedia(
  productId: string,
  query: z.infer<typeof GetProductMediaQuerySchema>,
): Promise<
  ApiResponse<
    Paginated<{
      id: string;
      caption?: string;
      isFeatured: boolean;
      medium: {
        id: string;
        type: "PICTURE" | "VIDEO";
        size: number;
        uploadedAt: Date;
        url: string;
        dimensions: { width: number; height: number };
      };
    }>
  >
> {
  const { page, pageSize } = query;
  const { items, total } = await shopService.fetchProductMedia(productId, {
    page,
    pageSize,
  });

  return {
    success: true,
    message: "Product media fetched successfully",
    data: { items, page, pageSize, total },
  };
}

export async function updateProductMedium(
  productId: string,
  mediumId: string,
  body: z.infer<typeof UpdateProductMediumSchema>,
): Promise<ApiResponse<null>> {
  await shopService.updateProductMedium(productId, mediumId, body);
  return {
    success: true,
    message: "Product medium updated successfully",
    data: null,
  };
}

export async function deleteProductMedium(
  productId: string,
  mediumId: string,
): Promise<ApiResponse<null>> {
  await shopService.removeProductMedium(productId, mediumId);
  return {
    success: true,
    message: "Product medium removed",
    data: null,
  };
}
