import { Medium } from "@/shared/dtos";

export type ShopProduct = {
  id: string;
  name: string;
  sku: string;
  previewUrl?: string;
  stockQuantity: number;
  price: number;
};

export type ShopProductDetail = {
  id: string;
  name: string;
  sku: string;
  description?: string;
  stockQuantity: number;
  price: number;
  gallery: Medium[]; // all productmedia
  createdAt: Date;
};
