import { ApplicationStatus } from "@/shared/utils";

export type YPFMembershipApplication = {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  trackingNumber: string;
  applicant: {
    id: string;
    publicId?: string;
    fullName: string;
    email?: string;
    phone?: string;
    profilePhotoUrl?: string;
    occupation?: string;
    skills?: string[];
  };
  preferredChapterName?: string;
  preferredCommitteeName?: string;
  onboarding?: {
    userId?: string;
    hasAccount: boolean;
    completed: boolean;
  };
};

export type YPFMembershipApplicationDetail = {
  id: string;
  status: ApplicationStatus;
  trackingNumber: string;
  commitmentStatement?: string;
  referralSource?: string;
  declinedReason?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  applicant: {
    id: string;
    publicId?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    occupation?: string;
    country?: string;
    region?: string;
    city?: string;
    campus?: string;
    skills?: string[];
    previousVolunteerExperience?: string;
    profilePhoto?: {
      url: string;
      dimensions: {
        width: number;
        height: number;
      };
      size: number;
    };
  };
  preferredChapter?: {
    id: string;
    name: string;
  };
  preferredCommittee?: {
    id: string;
    name: string;
  };
  cvDocument?: {
    id: string;
    url: string;
    downloadUrl: string;
  };
  nationalIdDocument?: {
    id: string;
    url: string;
    downloadUrl: string;
  };
  onboarding?: {
    userId?: string;
    hasAccount: boolean;
    completed: boolean;
  };
};

export type YPFVolunteerApplication = {
  id: string;
  trackingNumber: string;
  status: ApplicationStatus;
  createdAt: Date;
  applicant: {
    id: string;
    publicId?: string;
    fullName: string;
    email?: string;
    phone?: string;
    occupation?: string;
    skills?: string[];
  };
};

export type YPFVolunteerApplicationDetail = {
  id: string;
  trackingNumber: string;
  status: ApplicationStatus;
  reason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  applicant: {
    id: string;
    publicId?: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    occupation?: string;
    country?: string;
    region?: string;
    city?: string;
    skills?: string[];
  };
};
