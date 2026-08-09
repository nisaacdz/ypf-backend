import { PostSection, PostStatus } from "@/shared/utils";

/**
 * Public editorial content — Annual Report, Our Research, Stories of
 * Transformation. Mirrored on the website in `ypf-africa/src/types/post.ts`.
 */

export type PostAuthor = {
  name: string;
  avatarUrl?: string;
};

export type YPFPost = {
  id: string;
  publicId: string;
  section: PostSection;
  slug: string;
  title: string;
  dek?: string;
  excerpt?: string;
  status: PostStatus;
  publishedAt?: Date;
  readingMinutes?: number;
  tags?: string[];
  reportYear?: number;
  coverUrl?: string;
  isFeatured: boolean;
  author?: PostAuthor;
  /** True when an annual-report PDF is attached (see `documentUrl` on detail). */
  hasDocument: boolean;
};

export type YPFPostDetail = YPFPost & {
  body?: string;
  seoTitle?: string;
  seoDescription?: string;
  /**
   * Relative API path that 302s to a freshly signed blob URL. Not the blob URL
   * itself — those expire, so they can't be embedded in a page.
   */
  documentUrl?: string;
  documentSize?: number;
  consentOnFile: boolean;
  createdAt: Date;
  updatedAt: Date;
};
