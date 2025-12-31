export type YPFApplication = {
  id: string;
  status: string;
  declinedReason?: string;
  createdAt: Date;
  approvedAt?: Date;
  commitmentStatement?: string;
  applicant: {
    id: string;
    fullName: string;
    email?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    country?: string;
    region?: string;
    city?: string;
    campus?: string;
    nationalIdType: string;
  };
  preferredChapter?: {
    id: string;
    name: string;
  };
  preferredCommittee?: {
    id: string;
    name: string;
  };
  profilePhoto?: {
    id: string;
    url: string;
    type: string;
  };
  nationalIdDocument?: {
    id: string;
    url: string;
    type: string;
  };
  cvDocument?: {
    id: string;
    url: string;
    type: string;
  };
};

export type YPFApplicationDetail = {
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
    nationalIdType: string;
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
    url: string;
    type: string;
  };
  profilePhoto?: {
    id: string;
    externalId: string;
    url: string;
    type: string;
  };
  nationalIdDocument?: {
    id: string;
    externalId: string;
    url: string;
    type: string;
  };
};
