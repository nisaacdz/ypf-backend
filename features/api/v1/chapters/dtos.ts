import { Medium } from "@/shared/dtos";

// exclude archivedAt non null from lists
export type YPFChapter = {
  id: string;
  name: string;
  country: string;
  featuredPhotoUrl?: string;
  memberCount: number;
  foundingDate: Date;
};

export type YPFChapterDetail = {
  id: string;
  name: string;
  country: string;
  description?: string;
  foundingDate: Date;
  // from chaptermedia table, filter isFeatured = true, sort by latest, limit to 5
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[]; // all featured ChapterMedia -- don't worry it won't be plenty -- average of 1.5 max of 5
  isActive: boolean; // true if archived at is null
  parentChapter?: {
    id: string;
    name: string;
  };
};
