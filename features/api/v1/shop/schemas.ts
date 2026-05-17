import z from "zod";
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
