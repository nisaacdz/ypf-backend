import { eq, desc, inArray, and, gte, count } from "drizzle-orm";
import dbClient from "@/configs/db";
import schema from "@/db/schema";
import variables from "@/configs/env";
import { ApiError, AuthenticatedUser } from "@/shared/types";
import logger from "@/configs/logger";
import { sendOtpEmail } from "@/shared/utils/email";
import { v4 as uuidv4 } from "uuid";
import { randomInt } from "crypto";
import { sql } from "drizzle-orm";
import { OrderResponse, ValidatedOrderItems } from "@/shared/dtos/shop";
import { sendOrderPlacementEmail } from "@/shared/utils/email";
import z from "zod";
import { GetShopProductsQuerySchema } from "@/features/api/v1/shop/schemas";
import { ShopProduct, ShopProductDetail } from "@/features/api/v1/shop/dtos";
import { paystackSplitFields } from "./paymentProviders";
import { Paginated } from "../dtos";
import * as mediaUtils from "@/shared/utils/files";

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
  deliveryAddress?: { raw: string };
  note?: string;
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

      await Promise.all(
        validatedItems.map((item) =>
          tx
            .update(schema.Products)
            .set({
              stockQuantity: sql`${schema.Products.stockQuantity} - ${item.quantity}`,
            })
            .where(
              and(
                eq(schema.Products.id, item.productId),
                gte(schema.Products.stockQuantity, item.quantity),
              ),
            ),
        ),
      );

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
          Authorization: `Bearer ${variables.services.paystack.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(totalAmount * 100),
          currency,
          reference: paymentReference,
          callback_url: `${variables.app.websiteUrl ?? variables.app.host}/orders/success`,
          email: user.email,
          ...paystackSplitFields(),
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
    await sendOtpEmail(email, otp);
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
          email: payload.email,
          phone: payload.phone,
        })
        .returning();

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
          deliveryAddress: payload.deliveryAddress ?? null,
          note: payload.note ?? null,
        })
        .returning();

      // Link order to transaction
      await tx.insert(schema.OrderPayments).values({
        orderId: newOrder.id,
        transactionId: newTransaction.id,
      });

      // Create order items (Bulk Insert)
      await tx.insert(schema.OrderItems).values(
        validatedItems.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: item.price,
        })),
      );

      // Decrease stock quantities (Parallel)
      await Promise.all(
        validatedItems.map((item) =>
          tx
            .update(schema.Products)
            .set({
              stockQuantity: sql`${schema.Products.stockQuantity} - ${item.quantity}`,
            })
            .where(eq(schema.Products.id, item.productId)),
        ),
      );

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
          Authorization: `Bearer ${variables.services.paystack.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(totalAmount * 100),
          currency: payload.currency,
          reference: paymentReference,
          callback_url: `${variables.app.websiteUrl ?? variables.app.host}/orders/success`,
          email: payload.email,
          ...paystackSplitFields(),
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

export async function fetchShopProducts(
  query: z.infer<typeof GetShopProductsQuerySchema>,
): Promise<Paginated<ShopProduct>> {
  const { page = 1, pageSize = 10, onlyActive = true } = query;
  const offset = (page - 1) * pageSize;

  // Build where conditions
  const conditions = [];
  if (onlyActive) {
    conditions.push(eq(schema.Products.isActive, true));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [products, total] = await Promise.all([
    // Get products with featured media using joins
    dbClient.db
      .select({
        id: schema.Products.id,
        name: schema.Products.name,
        sku: schema.Products.sku,
        price: schema.Products.price,
        stockQuantity: schema.Products.stockQuantity,
        description: schema.Products.description,
        category: schema.Products.category,
        featuredMediumExternalId: schema.Media.externalId,
      })
      .from(schema.Products)
      .leftJoin(
        schema.ProductMedia,
        and(
          eq(schema.Products.id, schema.ProductMedia.productId),
          eq(schema.ProductMedia.isFeatured, true),
        ),
      )
      .leftJoin(schema.Media, eq(schema.ProductMedia.mediumId, schema.Media.id))
      .where(whereClause)
      .orderBy(desc(schema.Products.createdAt))
      .limit(pageSize)
      .offset(offset)
      .groupBy(
        schema.Products.id,
        schema.Products.name,
        schema.Products.sku,
        schema.Products.price,
        schema.Products.stockQuantity,
        schema.Products.description,
        schema.Products.category,
        schema.Products.createdAt,
        schema.Media.externalId,
      ),
    // Get total count
    dbClient.db
      .select({ count: count() })
      .from(schema.Products)
      .where(whereClause)
      .then((res) => res[0].count),
  ]);

  const items: ShopProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: parseFloat(p.price),
    stockQuantity: p.stockQuantity,
    description: p.description ?? undefined,
    category: p.category ?? undefined,
    previewUrl: p.featuredMediumExternalId
      ? mediaUtils.generateSignedMediaUrl(p.featuredMediumExternalId, {
          resolution: 720,
          expireSeconds: 60 * 60 * 24,
        })
      : undefined,
  }));

  return {
    items,
    page,
    pageSize,
    total,
  };
}

/**
 * Fetches up to `limit` active products in the same category as `:id`,
 * excluding the product itself. Returns empty array if the product has
 * no category set.
 */
export async function fetchRelatedShopProducts(
  productId: string,
  limit = 3,
): Promise<ShopProduct[]> {
  const product = await dbClient.db.query.Products.findFirst({
    where: eq(schema.Products.id, productId),
    columns: { id: true, category: true },
  });

  if (!product || !product.category) return [];

  const rows = await dbClient.db
    .select({
      id: schema.Products.id,
      name: schema.Products.name,
      sku: schema.Products.sku,
      price: schema.Products.price,
      stockQuantity: schema.Products.stockQuantity,
      description: schema.Products.description,
      category: schema.Products.category,
      featuredMediumExternalId: schema.Media.externalId,
    })
    .from(schema.Products)
    .leftJoin(
      schema.ProductMedia,
      and(
        eq(schema.Products.id, schema.ProductMedia.productId),
        eq(schema.ProductMedia.isFeatured, true),
      ),
    )
    .leftJoin(schema.Media, eq(schema.ProductMedia.mediumId, schema.Media.id))
    .where(
      and(
        eq(schema.Products.isActive, true),
        eq(schema.Products.category, product.category),
        sql`${schema.Products.id} != ${productId}`,
      ),
    )
    .orderBy(desc(schema.Products.createdAt))
    .limit(limit);

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: parseFloat(p.price),
    stockQuantity: p.stockQuantity,
    description: p.description ?? undefined,
    category: p.category ?? undefined,
    previewUrl: p.featuredMediumExternalId
      ? mediaUtils.generateSignedMediaUrl(p.featuredMediumExternalId, {
          resolution: 720,
          expireSeconds: 60 * 60 * 24,
        })
      : undefined,
  }));
}

export async function fetchShopProductById(
  id: string,
): Promise<ShopProductDetail | null> {
  const product = await dbClient.db.query.Products.findFirst({
    where: eq(schema.Products.id, id),
  });

  if (!product) {
    return null;
  }

  const productMedia = await dbClient.db
    .select({
      id: schema.ProductMedia.id,
      caption: schema.ProductMedia.caption,
      isFeatured: schema.ProductMedia.isFeatured,
      medium: {
        externalId: schema.Media.externalId,
        type: schema.Media.type,
        width: schema.Media.width,
        height: schema.Media.height,
      },
    })
    .from(schema.ProductMedia)
    .innerJoin(schema.Media, eq(schema.ProductMedia.mediumId, schema.Media.id))
    .where(eq(schema.ProductMedia.productId, id))
    // Featured-first so frontends can take the first item as the hero image.
    .orderBy(desc(schema.ProductMedia.isFeatured));

  const media = productMedia.map((pm) => ({
    url: mediaUtils.generateSignedMediaUrl(pm.medium.externalId, {
      resolution: 1080,
      expireSeconds: 60 * 60 * 24,
    }),
    caption: pm.caption ?? undefined,
    isFeatured: pm.isFeatured,
    type: pm.medium.type as "PICTURE" | "VIDEO",
    width: pm.medium.width,
    height: pm.medium.height,
  }));

  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description ?? undefined,
    longDescription: product.longDescription ?? undefined,
    category: product.category ?? undefined,
    attributes:
      (product.attributes as ShopProductDetail["attributes"]) ?? undefined,
    stockQuantity: product.stockQuantity,
    price: parseFloat(product.price),
    media,
    createdAt: product.createdAt,
  };
}

type ProductAttributes = {
  features?: string[];
  sizes?: string[];
  colors?: string[];
};

export async function createProduct(data: {
  name: string;
  sku: string;
  description?: string;
  longDescription?: string;
  category?: string;
  attributes?: ProductAttributes;
  price: string;
  stockQuantity: number;
  isActive?: boolean;
}): Promise<string> {
  const [product] = await dbClient.db
    .insert(schema.Products)
    .values({
      name: data.name,
      sku: data.sku,
      description: data.description,
      longDescription: data.longDescription,
      category: data.category,
      attributes: data.attributes,
      price: data.price,
      stockQuantity: data.stockQuantity,
      isActive: data.isActive ?? true,
    })
    .returning({ id: schema.Products.id });

  return product.id;
}

export async function updateProduct(
  id: string,
  data: {
    name?: string;
    sku?: string;
    description?: string;
    longDescription?: string;
    category?: string;
    attributes?: ProductAttributes;
    price?: string;
    stockQuantity?: number;
    isActive?: boolean;
  },
): Promise<void> {
  const result = await dbClient.db
    .update(schema.Products)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(schema.Products.id, id))
    .returning({ id: schema.Products.id });

  if (result.length === 0) {
    throw new ApiError("Product not found", 404);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const result = await dbClient.db
    .delete(schema.Products)
    .where(eq(schema.Products.id, id))
    .returning({ id: schema.Products.id });

  if (result.length === 0) {
    throw new ApiError("Product not found", 404);
  }
}

// ─── Product media helpers (Phase 1.1) ──────────────────────────────────────

export async function fetchProductMedia(
  productId: string,
  query: { page: number; pageSize: number },
) {
  const { page, pageSize } = query;

  const [productMedia, total] = await Promise.all([
    dbClient.db
      .select({
        id: schema.ProductMedia.id,
        caption: schema.ProductMedia.caption,
        isFeatured: schema.ProductMedia.isFeatured,
        medium: {
          id: schema.Media.id,
          externalId: schema.Media.externalId,
          type: schema.Media.type,
          width: schema.Media.width,
          height: schema.Media.height,
          size: schema.Media.size,
          uploadedAt: schema.Media.uploadedAt,
        },
      })
      .from(schema.ProductMedia)
      .innerJoin(
        schema.Media,
        eq(schema.ProductMedia.mediumId, schema.Media.id),
      )
      .where(eq(schema.ProductMedia.productId, productId))
      .orderBy(desc(schema.ProductMedia.isFeatured))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbClient.db
      .select({ count: count() })
      .from(schema.ProductMedia)
      .where(eq(schema.ProductMedia.productId, productId))
      .then((res) => res[0].count),
  ]);

  const items = productMedia.map((m) => ({
    id: m.id,
    caption: m.caption ?? undefined,
    isFeatured: m.isFeatured,
    medium: {
      id: m.medium.id,
      type: m.medium.type,
      size: m.medium.size,
      uploadedAt: m.medium.uploadedAt,
      url: mediaUtils.generateSignedMediaUrl(m.medium.externalId, {
        resolution: 1080,
        expireSeconds: 60 * 60 * 24,
      }),
      dimensions: {
        width: m.medium.width,
        height: m.medium.height,
      },
    },
  }));

  return { items, total };
}

export async function updateProductMedium(
  productId: string,
  mediumId: string,
  data: { caption?: string; isFeatured?: boolean },
): Promise<void> {
  // If flagging this row featured, clear the flag on any other row first
  // (only one featured image per product).
  if (data.isFeatured === true) {
    await dbClient.db
      .update(schema.ProductMedia)
      .set({ isFeatured: false })
      .where(eq(schema.ProductMedia.productId, productId));
  }

  const [updated] = await dbClient.db
    .update(schema.ProductMedia)
    .set(data)
    .where(
      and(
        eq(schema.ProductMedia.productId, productId),
        eq(schema.ProductMedia.id, mediumId),
      ),
    )
    .returning({ id: schema.ProductMedia.id });

  if (!updated) {
    throw new ApiError("Product medium not found", 404);
  }
}

export async function removeProductMedium(
  productId: string,
  mediumId: string,
): Promise<void> {
  const [removed] = await dbClient.db
    .delete(schema.ProductMedia)
    .where(
      and(
        eq(schema.ProductMedia.productId, productId),
        eq(schema.ProductMedia.id, mediumId),
      ),
    )
    .returning({ mediumId: schema.ProductMedia.mediumId });

  if (!removed) {
    throw new ApiError("Product medium not found", 404);
  }

  // Best-effort cleanup of the underlying media row + ImageKit asset.
  // ProductMedia.medium_id has ON DELETE CASCADE so the row is technically
  // orphan-safe, but we want to free storage when nothing else references it.
  if (removed.mediumId) {
    try {
      const [media] = await dbClient.db
        .select({ externalId: schema.Media.externalId })
        .from(schema.Media)
        .where(eq(schema.Media.id, removed.mediumId))
        .limit(1);

      await dbClient.db
        .delete(schema.Media)
        .where(eq(schema.Media.id, removed.mediumId));

      if (media?.externalId) {
        mediaUtils.deleteMediumFile(media.externalId).catch((err) => {
          logger.error(
            err,
            `Failed to delete external media asset ${media.externalId}`,
          );
        });
      }
    } catch (err) {
      logger.warn(err, "Failed to remove orphan media row");
    }
  }
}
