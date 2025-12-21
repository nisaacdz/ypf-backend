import { DocumentType, MediumType } from "../utils";

export * from "./shop";

export type Paginated<T> = {
  items: T[];
  pageSize: number; // the page size used
  page: number; // the current page
  total: number; // total number of items
};

export type Notification = {
  id: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
};

export type Medium = {
  url: string; // sdk-generated url
  type: MediumType; // "PICTURE" | "VIDEO"
  dimensions: {
    width: number;
    height: number;
  };
  size: number;
  uploadedAt: Date;
  uploadedBy?: string; // fullName of uploader
};

export type Document = {
  url: string; // sdk-generated url
  type: DocumentType;
  size: number;
  uploadedAt: Date;
  uploadedBy?: string; // fullName of uploader
};
