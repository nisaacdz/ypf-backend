import { MembershipType, MediumType } from "@/shared/dtos";

export type Medium = {
  url: string; // sdk-generated url
  type: MediumType;
  dimensions: {
    width: number;
    height: number;
  };
  sizeInBytes: number;
  uploadedAt: string;
  uploadedBy?: string; // fullName of uploader
};

export type Member = {
  id: string; // constituent ID
  profilePhotoUrl?: string;
  fullName: string;
  isActive: boolean;
  joinedAt: string;
  role?: string; // name of highest level role
};

export type MemberDetail = {
  id: string;
  firstName: string;
  lastName: string;
  salutation?: string;
  profilePhoto?: Medium;
  contactInfo: {
    type: "EMAIL" | "PHONE" | "WHATSAPP"; // CORRECTED: Added WHATSAPP to match schema enum
    value: string;
    isPrimary: boolean;
  }[];
  roles: {
    name: string;
    scope: {
      type: "global" | "chapter" | "committee";
      id: string | null; // id of chapter or committee
      name: string | null; // name of chapter, name of committee or null
    };
    _level: number; // for ordering the roles
    startedAt: string;
    endedAt?: string;
  }[];
  memberships: {
    type: MembershipType;
    startedAt: string;
    endedAt?: string;
  }[];
  joinedAt: string;
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
  createdAt: string;
};

export type Project = {
  id: string;
  title: string;
  abstract: string;
  startDate: string;
  endDate: string;
  locationInfo: string;
  featuredPhotoUrl?: string;
  chapterName?: string;
};

export type ProjectDetail = {
  id: string;
  title: string;
  abstract: string;
  description: string;
  goals: string[];
  startedAt: string;
  endedAt: string;
  locationInfo: string;
  featuredPhotos: Medium[]; // limited to 5
  chapter: {
    id: string;
    name: string;
  };
};
