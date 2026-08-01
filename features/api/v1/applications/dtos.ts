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
  // Null on applications submitted before the answer was recorded — that's
  // "unknown", not "no".
  willingToServe?: boolean;
  referralSource?: string;
  declinedReason?: string;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  // Consents captured at submission. Each timestamp is the moment the
  // applicant accepted that specific policy / declaration. All three are
  // required by the public form so they're effectively always set, but
  // we still mark them optional in the type for legacy rows that
  // pre-date the consents column.
  consents?: {
    termsAgreedAt?: string;
    privacyAgreedAt?: string;
    declarationAgreedAt?: string;
  };
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
    campus?: string;
    skills?: string[];
    previousVolunteerExperience?: string;
    // Demographics + identifiers the admin needs at review time.
    dateOfBirth?: string;
    gender?: "MALE" | "FEMALE" | "OTHER";
    nationalIdType?: string;
    // Social profiles, used for vetting.
    linkedinProfile?: string;
    twitterHandle?: string;
    // Emergency contact — required for safety on events / chapter
    // activities.
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    // Which YPF pillars (advocacy / education / mentorship / etc.) the
    // applicant wants to focus on. Drives committee assignment.
    missionPillars?: string[];
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
