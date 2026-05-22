import { Medium } from "@/shared/dtos";

export type YPFCommittee = {
  id: string;
  name: string;
  alias: string;
  description?: string;
  featuredPhotoUrl?: string;
  chapterName?: string;
  memberCount: number;
  /** Active committeechair's `members.id`, or `null` if no chair is assigned. */
  chairMemberId: string | null;
};

export type YPFCommitteeDetail = {
  id: string;
  name: string;
  description?: string;
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
  chapter?: {
    id: string;
    name: string;
  };
  isActive: boolean; // if committe is active and committe?.chapter is active
  createdAt: Date;
};
