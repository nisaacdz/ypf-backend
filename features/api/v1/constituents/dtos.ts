import { Medium } from "@/shared/dtos";
import { Profile } from "@/shared/types";

export type YPFConstituent = {
  id: string; // constituent ID
  profilePhotoUrl?: string;
  fullName: string; // preferredName if there's one else `${firstName} ${lastName}`
  isActive: boolean;
  createdAt: Date;
  profiles: Profile[];
  roles: string[]; // title array, not alias array
};

export type YPFConstituentDetail = {
  id: string;
  publicId: string;
  profilePhoto?: Medium;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  occupation?: string;
  skills?: string[];
  country?: string;
  region?: string;
  city?: string;
  campus?: string;
  linkedinProfile?: string;
  twitterHandle?: string;
  previousVolunteerExperience?: string;
  profiles: {
    name: Profile;
    startedAt: Date;
    endedAt?: Date;
  }[]; // all profiles (even non-current ones)
  roles: {
    profile: Profile;
    title: string;
    startedAt: Date;
    endedAt?: Date;
  }[];
  committees: {
    id: string;
    name: string;
    alias?: string;
    /** alias of the title the user holds in this committee, e.g. "committeechair" */
    titleAlias?: string;
    featuredPhotoUrl?: string;
    chapterName?: string;
  }[];
  chapters: {
    id: string;
    name: string;
    country: string;
    /** alias of the title the user holds in this chapter, e.g. "chapterlead" */
    titleAlias?: string;
    featuredPhotoUrl?: string;
  }[];
};
