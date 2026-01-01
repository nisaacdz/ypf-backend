export type YPFMembershipApplication = {
  id: string;
  status: string;
  createdAt: Date;
  applicant: {
    id: string;
    fullName: string;
    email?: string;
  };
};

export type YPFMembershipApplicationDetail = {
  id: string;
  status: string;
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
    externalId: string;
    url?: string;
  };
};
