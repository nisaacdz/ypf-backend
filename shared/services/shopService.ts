import { eq, desc, inArray, and, gte } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import variables from "@/configs/env";
import { ApiError, AuthenticatedUser } from "@/shared/types";
import logger from "@/configs/logger";
import { send_otp_email } from "@/shared/utils/email";
import { v4 as uuidv4 } from "uuid";
import { randomInt } from "crypto";
import { sql } from "drizzle-orm";
import { OrderResponse, ValidatedOrderItems } from "@/shared/dtos/shop";
import { sendOrderPlacementEmail } from "@/shared/utils/email";

type OrderItem = {
  productId: string;
  quantity: number;
};

type CreateOrderInput = {
  items: OrderItem[];
  currency: string;
};

type GuestOrderInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  items: OrderItem[];
  currency: string;
};

/**
 * Validates stock availability and calculates total amount for order items
 */
export async function validateOrderItems(
  items: OrderItem[],
): Promise<ValidatedOrderItems> {
  if (items.length === 0) {
    return { validatedItems: [], totalAmount: 0 };
  }

  const productIds = items.map((item) => item.productId);

  const dbProducts = await dbClient.db
    .select()
    .from(schema.Products)
    .where(inArray(schema.Products.id, productIds));

  const productMap = new Map(
    dbProducts.map((product) => [product.id, product]),
  );

  const validatedItems: {
    productId: string;
    quantity: number;
    price: string;
    name: string;
  }[] = [];
  let totalAmount = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new ApiError(`Product with ID ${item.productId} not found`, 404);
    }

    if (!product.isActive) {
      throw new ApiError(
        `Product "${product.name}" is no longer available`,
        400,
      );
    }

    if (product.stockQuantity < item.quantity) {
      throw new ApiError(
        `Insufficient stock for "${product.name}". Only ${product.stockQuantity} available.`,
        400,
      );
    }

    const itemPrice = parseFloat(product.price);
    totalAmount += itemPrice * item.quantity;

    validatedItems.push({
      productId: product.id,
      quantity: item.quantity,
      price: product.price,
      name: product.name,
    });
  }
  return { validatedItems, totalAmount };
}

/**
 * Creates an order for an authenticated user
 */
export async function createAuthenticatedOrder(
  input: CreateOrderInput,
  user: AuthenticatedUser,
): Promise<OrderResponse> {
  const { items, currency } = input;

  const { validatedItems, totalAmount } = await validateOrderItems(items);

  const paymentReference = uuidv4();
  let orderId: string;
  let transactionId: string;

  try {
    const result = await dbClient.db.transaction(async (tx) => {
      const [newTransaction] = await tx
        .insert(schema.FinancialTransactions)
        .values({
          amount: totalAmount.toFixed(2),
          currency,
          status: "PENDING",
          externalProvider: "PAYSTACK",
          externalRef: paymentReference,
        })
        .returning({ id: schema.FinancialTransactions.id });

      const [newOrder] = await tx
        .insert(schema.Orders)
        .values({
          constituentId: user.constituentId,
          totalAmount: totalAmount.toFixed(2),
          status: "PENDING",
          deliveryAddress: null,
        })
        .returning();

      await tx.insert(schema.OrderPayments).values({
        orderId: newOrder.id,
        transactionId: newTransaction.id,
      });

      await tx.insert(schema.OrderItems).values(
        validatedItems.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: item.price,
        })),
      );

      for (const item of validatedItems) {
        await tx
          .update(schema.Products)
          .set({
            stockQuantity: sql`${schema.Products.stockQuantity} - ${item.quantity}`,
          })
          .where(
            and(
              eq(schema.Products.id, item.productId),
              gte(schema.Products.stockQuantity, item.quantity),
            ),
          );
      }

      return {
        orderId: newOrder.id,
        transactionId: newTransaction.id,
      };
    });

    orderId = result.orderId;
    transactionId = result.transactionId;
  } catch (dbError) {
    logger.error(dbError, "Failed to create order:");
    throw new ApiError("Failed to create order.", 500);
  }

  // Generate Paystack payment URL
  let paymentUrl: string;
  try {
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${variables.services.paystack.secretHash}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(totalAmount * 100),
          currency,
          reference: paymentReference,
          callback_url: `${variables.app.host}/shop/callback`,
          email: user.email,
        }),
      },
    );

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      logger.error("Paystack initialization failed:", errorData);
      throw new ApiError(
        `Failed to initialize payment: ${errorData.message || "Unknown error"}`,
        500,
      );
    }

    const paystackData = await paystackResponse.json();
    paymentUrl = paystackData.data.authorization_url;
  } catch (apiError) {
    logger.warn(
      `Compensating transaction for order [${orderId}] due to API failure.`,
    );
    try {
      await dbClient.db
        .update(schema.FinancialTransactions)
        .set({ status: "FAILED" })
        .where(eq(schema.FinancialTransactions.id, transactionId));
    } catch (compensationError) {
      logger.error(
        compensationError,
        `CRITICAL: Failed to compensate (mark as FAILED) transaction [${transactionId}].`,
      );
    }
    throw apiError;
  }

  // Send initial order placement email
  try {
    await sendOrderPlacementEmail({
      email: user.email,
      name: user.fullName,
      order: {
        id: orderId,
        amount: totalAmount.toFixed(2),
        currency,
        items: validatedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      },
      paymentUrl,
    });
  } catch (emailError) {
    logger.error(emailError, "Failed to send order placement email");
    // Don't fail the order if email fails
  }

  return {
    orderId,
    paymentUrl,
  };
}

/**
 * Initiates a guest order by generating and sending an OTP
 */
export async function initiateGuestOrder(
  input: GuestOrderInput,
): Promise<{ success: boolean; message: string }> {
  const { email, items } = input;

  // Validate order items to ensure they exist and have stock
  await validateOrderItems(items);

  // Generate OTP
  const otp = randomInt(100000, 1000000).toString();

  // Store OTP with the entire payload
  await dbClient.db.transaction(async (tx) => {
    // Delete any existing OTPs for this email
    await tx.delete(schema.Otps).where(eq(schema.Otps.email, email));

    // Insert new OTP with the order payload
    await tx.insert(schema.Otps).values({
      email,
      code: otp,
      payload: input,
      expiresAt: sql`now() + interval '6 minutes'`,
    });
  });

  // Send OTP email
  try {
    await send_otp_email(email, otp);
  } catch (emailError) {
    logger.error(emailError, "Failed to send OTP email");
    throw new ApiError("Failed to send verification code", 500);
  }

  return {
    success: true,
    message: "Verification code sent to your email",
  };
}

/**
 * Completes a guest order after OTP verification
 */
export async function completeGuestOrder(
  email: string,
  otp: string,
): Promise<OrderResponse> {
  // Verify OTP and retrieve payload
  const [otpRecord] = await dbClient.db
    .select()
    .from(schema.Otps)
    .where(eq(schema.Otps.email, email));

  if (!otpRecord) {
    throw new ApiError("Invalid or expired verification code", 400);
  }

  if (otpRecord.code !== otp) {
    throw new ApiError("Invalid verification code", 400);
  }

  if (otpRecord.usedAt) {
    throw new ApiError("Verification code has already been used", 400);
  }

  const now = new Date();
  const expiresAt = new Date(otpRecord.expiresAt);
  if (now > expiresAt) {
    throw new ApiError("Verification code has expired", 400);
  }

  // Retrieve the order payload
  const payload = otpRecord.payload as GuestOrderInput;
  if (!payload || !payload.items) {
    throw new ApiError("Invalid order data", 400);
  }

  // Validate order items again (stock might have changed)
  const { validatedItems, totalAmount } = await validateOrderItems(
    payload.items,
  );

  const paymentReference = uuidv4();
  let orderId: string;
  let transactionId: string;

  try {
    // Create constituent, order, and transaction in a database transaction
    const result = await dbClient.db.transaction(async (tx) => {
      // Mark OTP as used
      await tx
        .update(schema.Otps)
        .set({ usedAt: sql`now()` })
        .where(eq(schema.Otps.id, otpRecord.id));

      // Create constituent
      const [newConstituent] = await tx
        .insert(schema.Constituents)
        .values({
          firstName: payload.firstName,
          lastName: payload.lastName,
        })
        .returning();

      // Create email contact information
      await tx.insert(schema.ContactInformations).values({
        constituentId: newConstituent.id,
        contactType: "EMAIL",
        value: payload.email,
        isPrimary: true,
      });

      // Create phone contact information if provided
      if (payload.phone) {
        await tx.insert(schema.ContactInformations).values({
          constituentId: newConstituent.id,
          contactType: "PHONE",
          value: payload.phone,
          isPrimary: false,
        });
      }

      // Create the financial transaction
      const [newTransaction] = await tx
        .insert(schema.FinancialTransactions)
        .values({
          amount: totalAmount.toFixed(2),
          currency: payload.currency,
          status: "PENDING",
          externalProvider: "PAYSTACK",
          externalRef: paymentReference,
        })
        .returning();

      // Create the order
      const [newOrder] = await tx
        .insert(schema.Orders)
        .values({
          constituentId: newConstituent.id,
          totalAmount: totalAmount.toFixed(2),
          status: "PENDING",
          deliveryAddress: null,
        })
        .returning();

      // Link order to transaction
      await tx.insert(schema.OrderPayments).values({
        orderId: newOrder.id,
        transactionId: newTransaction.id,
      });

      // Create order items
      for (const item of validatedItems) {
        await tx.insert(schema.OrderItems).values({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: item.price,
        });
      }

      // Decrease stock quantities
      for (const item of validatedItems) {
        await tx
          .update(schema.Products)
          .set({
            stockQuantity: sql`${schema.Products.stockQuantity} - ${item.quantity}`,
          })
          .where(eq(schema.Products.id, item.productId));
      }

      return {
        orderId: newOrder.id,
        transactionId: newTransaction.id,
      };
    });

    orderId = result.orderId;
    transactionId = result.transactionId;
  } catch (dbError) {
    logger.error(dbError, "Failed to create guest order:");
    throw new ApiError("Failed to create order.", 500);
  }

  // Generate Paystack payment URL
  let paymentUrl: string;
  try {
    const paystackResponse = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${variables.services.paystack.secretHash}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(totalAmount * 100),
          currency: payload.currency,
          reference: paymentReference,
          callback_url: `${variables.app.host}/shop/callback`,
          email: payload.email,
        }),
      },
    );

    if (!paystackResponse.ok) {
      const errorData = await paystackResponse.json();
      logger.error("Paystack initialization failed:", errorData);
      throw new ApiError(
        `Failed to initialize payment: ${errorData.message || "Unknown error"}`,
        500,
      );
    }

    const paystackData = await paystackResponse.json();
    paymentUrl = paystackData.data.authorization_url;
  } catch (apiError) {
    logger.warn(
      `Compensating transaction for order [${orderId}] due to API failure.`,
    );
    try {
      await dbClient.db
        .update(schema.FinancialTransactions)
        .set({ status: "FAILED" })
        .where(eq(schema.FinancialTransactions.id, transactionId));
    } catch (compensationError) {
      logger.error(
        compensationError,
        `CRITICAL: Failed to compensate (mark as FAILED) transaction [${transactionId}].`,
      );
    }
    throw apiError;
  }

  // Send initial order placement email
  try {
    const fullName = `${payload.firstName} ${payload.lastName}`;
    await sendOrderPlacementEmail({
      email: payload.email,
      name: fullName,
      order: {
        id: orderId,
        amount: totalAmount.toFixed(2),
        currency: payload.currency,
        items: validatedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      },
      paymentUrl,
    });
  } catch (emailError) {
    logger.error(emailError, "Failed to send order placement email");
    // Don't fail the order if email fails
  }

  return {
    orderId,
    paymentUrl,
  };
}

/**
 * Gets order history for an authenticated user
 */
export async function getUserOrders(user: AuthenticatedUser): Promise<
  Array<{
    id: string;
    totalAmount: string;
    status: string;
    createdAt: Date;
    itemCount: number;
  }>
> {
  // Get orders with item counts in a single query using a subquery
  const orders = await dbClient.db
    .select({
      id: schema.Orders.id,
      totalAmount: schema.Orders.totalAmount,
      status: schema.Orders.status,
      createdAt: schema.Orders.createdAt,
      itemCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${schema.OrderItems}
        WHERE ${schema.OrderItems.orderId} = ${schema.Orders.id}
      )`,
    })
    .from(schema.Orders)
    .where(eq(schema.Orders.constituentId, user.constituentId))
    .orderBy(desc(schema.Orders.createdAt));

  return orders;
}
