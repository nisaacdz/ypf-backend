import { ApiResponse, AuthenticatedUser } from "@/shared/types";
import * as shopService from "@/shared/services/shopService";
import z from "zod";
import {
  CreateOrderSchema,
  InitiateGuestOrderSchema,
  CompleteGuestOrderSchema,
} from "@/shared/validators/shop";
import { OrderResponse, ValidateOrderItems } from "@/shared/dtos/shop";

/**
 * Handler for creating an order for authenticated users
 */
export async function createOrder(
  body: z.infer<typeof CreateOrderSchema>,
  user: AuthenticatedUser,
): Promise<ApiResponse<OrderResponse>> {
  const result = await shopService.createAuthenticatedOrder(body, user);

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
export async function getUserOrders(user: AuthenticatedUser): Promise<
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
  const orders = await shopService.getUserOrders(user);

  return {
    success: true,
    message: "Orders retrieved successfully",
    data: orders,
  };
}

export async function validateOrderItems(
  data: z.infer<typeof CreateOrderSchema>,
): Promise<ApiResponse<ValidateOrderItems>> {
  const result = await shopService.validateOrderItems(data.items);

  return {
    success: true,
    message: "Order items are valid",
    data: result,
  };
}
