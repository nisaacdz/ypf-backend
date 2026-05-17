import { Medium } from "@/shared/dtos";

export type ProductAttributes = {
  features?: string[];
  sizes?: string[];
  colors?: string[];
};

export type ShopProduct = {
  id: string;
  name: string;
  sku: string;
  previewUrl?: string;
  stockQuantity: number;
  price: number;
  description?: string;
  category?: string;
};

export type ShopProductDetail = {
  id: string;
  name: string;
  sku: string;
  description?: string;
  longDescription?: string;
  category?: string;
  attributes?: ProductAttributes;
  stockQuantity: number;
  price: number;
  /**
   * All product media, ordered with featured-first.
   * Each item has the signed CDN url plus dimensions/type metadata.
   */
  media: Array<{
    url: string;
    caption?: string;
    isFeatured: boolean;
    type: "PICTURE" | "VIDEO";
    width: number;
    height: number;
  }>;
  createdAt: Date;
};
