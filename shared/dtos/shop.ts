import { orderStatus } from "@/db/schema/shop";

export type OrderStatus = (typeof orderStatus.enumValues)[number];

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: string;
  featuredPhotoUrl: string | null;
  stockQuantity: number;
  isActive: boolean;
};

export type ProductDetail = {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  price: string;
  stockQuantity: number;
  isActive: boolean;
  // The full gallery of images from the ProductPhotos table
  photos: {
    id: string;
    url: string;
    caption: string | null;
  }[];
};

export type OrderItem = {
  productId: string;
  productName: string;
  productSku: string;
  featuredPhotoUrl: string | null;
  quantity: number;
  priceAtPurchase: string;
};

export type Order = {
  id: string;
  totalAmount: string;
  status: OrderStatus;
  createdAt: string;
  itemCount: number;
};

export type OrderDetail = {
  id: string;
  totalAmount: string;
  status: OrderStatus;
  createdAt: string;
  deliveryAddress: {
    recipientName: string;
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  items: OrderItem[];
};