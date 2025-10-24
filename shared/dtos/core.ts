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

export type Chapter = {
  id: string;
  name: string;
  featuredPhotoUrl?: string;
  location: string;
  memberCount: number;
  foundingDate: string;
  isActive: boolean;
};

export type ChapterDetail = {
  id: string;
  name: string;
  country: string;
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
  description?: string;
  foundingDate: string;
  isActive: boolean;
  parentChapter?: {
    id: string;
    name: string;
  };
};

export type Committee = {
  id: string;
  name: string;
  featuredPhotoUrl?: string;
  chapterName?: string;
  memberCount: number;
};

export type CommitteeDetail = {
  id: string;
  name: string;
  description?: string;
  featuredMedia?: {
    caption?: string;
    medium: Medium;
  }[];
  chapter: {
    id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: Date;
};
