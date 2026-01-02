import { MembershipApplicationStatus } from "@/shared/utils";

export type YPFMembershipApplication = {
  id: string;
  status: MembershipApplicationStatus;
  createdAt: Date;
  trackingNumber: string;
  applicant: {
    id: string;
    fullName: string;
    email?: string;
    phone?: string;
    profilePhotoUrl?: string;
    occupation?: string;
    skills?: string[];
  };
  preferredChapterName?: string;
  preferredCommitteeName?: string;
};

export type YPFMembershipApplicationDetail = {
  id: string;
  status: MembershipApplicationStatus;
  trackingNumber: string;
  commitmentStatement?: string;
  referralSource?: string;
  declinedReason?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  applicant: {
    id: string;
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
  };
  nationalIdDocument?: {
    id: string;
    url: string;
  };
};
