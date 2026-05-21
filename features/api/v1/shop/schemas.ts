import z from "zod";
import { MediumTypeEnum } from "@/db/schema/core";
import { PaginationQuery } from "@/shared/validators";

const ProductAttributesSchema = z
  .object({
    features: z.array(z.string()).optional(),
    sizes: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),
  })
  .strict();

export const CreateProductSchema = z.object({
  name: z
    .string()
    .min(3, { message: "Product name must be at least 3 characters long." })
    .max(255, { message: "Product name must not exceed 255 characters." }),

  sku: z
    .string()
    .min(3, { message: "SKU must be at least 3 characters long." })
    .max(50, { message: "SKU must not exceed 50 characters." })
    .regex(/^[a-zA-Z0-9-]+$/, {
      message: "SKU can only contain letters, numbers, and dashes.",
    }),

  description: z
    .string()
    .max(5000, { message: "Description is too long." })
    .optional(),

  longDescription: z
    .string()
    .max(20000, { message: "Long description is too long." })
    .optional(),

  category: z.string().max(120).optional(),

  attributes: ProductAttributesSchema.optional(),

  price: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: "Please enter a valid price (e.g., 49.99).",
  }),

  stockQuantity: z
    .number({ error: "Stock quantity must be a number." })
    .int({ message: "Stock quantity must be a whole number." })
    .min(0, { message: "Stock quantity cannot be negative." }),

  imageUrl: z
    .url({ message: "Please enter a valid URL for the featured image." })
    .optional(),

  isActive: z.boolean().optional().default(true),
});

export const UpdateProductSchema = CreateProductSchema.partial();

const OrderItemSchema = z.object({
  productId: z.uuid({ message: "Invalid product ID format." }),
  quantity: z.coerce
    .number({ error: "Quantity must be a number." })
    .int({ message: "Quantity must be a whole number." })
    .positive({ message: "You must order at least one of this item." }),
});

// Authenticated user order schema (no delivery address needed)
export const CreateOrderSchema = z.object({
  items: z
    .array(OrderItemSchema)
    .nonempty({ message: "Your shopping cart cannot be empty." }),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter code")
    .default("GHS"),
});

// Validate the items
export const ValidateOrderItemsSchema = z.object({
  items: z
    .array(OrderItemSchema)
    .nonempty({ message: "Your shopping cart cannot be empty." }),
});

// Plan §11 #2 — single-line shipping for v1, structured later.
const DeliveryAddressSchema = z.object({ raw: z.string().min(1).max(500) });

// Guest order initiation schema
export const InitiateGuestOrderSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  email: z.email({ message: "Invalid email address." }),
  phone: z.string().optional(),
  items: z
    .array(OrderItemSchema)
    .nonempty({ message: "Your shopping cart cannot be empty." }),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter code")
    .default("GHS"),
  deliveryAddress: DeliveryAddressSchema.optional(),
  note: z.string().max(500).optional(),
});

// Guest order completion schema
export const CompleteGuestOrderSchema = z.object({
  email: z.email({ message: "Invalid email address." }),
  otp: z.string().length(6, { message: "OTP must be 6 digits." }),
});

export const GetShopProductsQuerySchema = z.object({
  ...PaginationQuery.shape,
  onlyActive: z.coerce.boolean().default(true).optional(),
});

// ──────────────────────────────────────────────────────────────────────────
// Product media — mirrors the events media flow.
// ──────────────────────────────────────────────────────────────────────────

export const UploadProductMediumOptionsSchema = z.object({
  caption: z
    .string()
    .max(255, { message: "Caption must not exceed 255 characters." })
    .optional(),
  isFeatured: z.coerce.boolean().optional().default(false),
});

export const UploadProductFileSchema = z
  .object({
    size: z
      .number()
      .positive({ message: "File size must be a positive number." }),
    mimeType: z.enum(["image/png", "image/jpeg", "video/mp4", "video/avi"], {
      error: () => ({
        message: "Invalid file type. Only PNG, JPG, MP4, or AVI are allowed.",
      }),
    }),
  })
  .refine(
    (data) =>
      !data.mimeType.startsWith("image/") || data.size <= 50 * 1024 * 1024,
    { message: "Image size cannot exceed 50MB.", path: ["size"] },
  )
  .refine(
    (data) =>
      !data.mimeType.startsWith("video/") || data.size <= 250 * 1024 * 1024,
    { message: "Video size cannot exceed 250MB.", path: ["size"] },
  );

export const UpdateProductMediumSchema = z.object({
  caption: z
    .string()
    .max(255, { message: "Caption must not exceed 255 characters." })
    .optional(),
  isFeatured: z.coerce.boolean().optional(),
});

export const GetProductMediaQuerySchema = z.object({
  ...PaginationQuery.shape,
  mediaType: z
    .enum(MediumTypeEnum.enumValues, { message: "Invalid medium type." })
    .optional(),
});

// Audit C2 — admin order browsing. Supports status filter, free-text search
// across customer name/email, optional date range, and pagination. The
// existing `GET /shop/orders` is user-scoped (own orders only); this admin
// surface joins to Constituents + FinancialTransactions for fulfillment.
export const GetAdminOrdersQuerySchema = z.object({
  ...PaginationQuery.shape,
  status: z
    .enum(["PENDING", "COMPLETED", "CANCELLED"], {
      message: "Invalid order status.",
    })
    .optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const UpdateAdminOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
});
