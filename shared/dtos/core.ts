import { MediumType } from "@/shared/dtos";

export type Medium = {
  url: string; // sdk-generated url
  type: MediumType; // "PICTURE" | "VIDEO"
  dimensions: {
    width: number;
    height: number;
  };
  sizeInBytes: number;
  uploadedAt: Date;
  uploadedBy?: string; // fullName of uploader
};

export type YPFMember = {
  id: string; // constituent ID
  profilePhotoUrl?: string;
  fullName: string;
  isActive: boolean;
  joinedAt?: Date;
  title?: string; // name of most significant title
};

export type MemberDetail = {
  id: string; // constituent ID
  firstName: string;
  lastName: string;
  salutation?: string;
  profilePhoto?: Medium; // excludes uploadedBy
  contactInfos: {
    type: "EMAIL" | "PHONE" | "WHATSAPP";
    value: string;
  }[]; // primary contact
  titles: {
    name: string; // eg. president
    scope?: { type: "chapter" | "committee"; name: string; id: string }; // undefined if global
    _level: number;
    startedAt: Date;
    endedAt?: Date;
  }[]; // current titles
  joinedAt: Date;
  isActive: boolean;
};

// exclude archivedAt non null from lists
export type YPFChapter = {
  id: string;
  name: string;
  country: string;
  featuredPhotoUrl?: string;
  memberCount: number;
  foundingDate: Date;
};

export type DetailedChapter = {
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

export type YPFCommittee = {
  id: string;
  name: string;
  description?: string;
  featuredPhotoUrl?: string;
  chapterName?: string;
  memberCount: number;
};

export type DetailedCommittee = {
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
