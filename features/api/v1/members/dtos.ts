export type YPFMember = {
  id: string; // Member.id (membership record)
  constituentId: string; // Constituent.id
  publicId: string; // Constituent.publicId (e.g., YPFC-XXXX)
  email?: string;
  profilePhotoUrl?: string;
  fullName: string; // preferredName ?? `${firstName} ${lastName}`
  title?: string; // most significant active title (e.g., "President")
  chapter?: {
    id: string;
    name: string;
  };
  committee?: {
    id: string;
    name: string;
  };
  country?: string;
  campus?: string;

  startedAt?: Date; // membership start date

  // Current-period dues snapshot. Computed against the latest global Dues
  // row (chapterId IS NULL). Both fields are absent when no dues period is
  // active (e.g. the policy hasn't generated a row for this month yet).
  dues?: {
    paid: boolean;
    amount: number;
    amountPaid: number;
    currency: string;
    periodStart: Date;
    periodEnd: Date;
  };
};

export type YPFMemberDetail = {
  id: string; // Member.id
  constituentId: string; // Constituent.id
  publicId: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  salutation?: string;

  profilePhoto?: {
    url: string;
    dimensions: { width: number; height: number };
  };

  // Professional info (safe to share between members)
  occupation?: string;
  skills?: string[];

  // Location
  country?: string;
  region?: string;
  city?: string;
  campus?: string;

  // Contact info (intentionally public)
  orgEmail?: string;
  whatsapp?: string;

  // Social links (intentionally public)
  linkedinProfile?: string;
  twitterHandle?: string;

  // Organizational affiliation
  titles: {
    id: string; // MemberTitlesAssignment.id
    name: string;
    scope?: { type: "chapter" | "committee"; id: string; name: string };
    startedAt: Date;
    endedAt?: Date;
  }[];

  chapters: {
    id: string;
    name: string;
    country: string;
    startedAt: Date;
    endedAt?: Date;
  }[];

  committees: {
    id: string;
    name: string;
    chapterName?: string;
    startedAt: Date;
    endedAt?: Date;
  }[];

  // Membership info
  startedAt?: Date; // global membership start
  endedAt?: Date; // if membership ended

  // Onboarding status (true if no User record exists for this constituent)
  notOnboarded?: boolean;
};

export type MemberRole = {
  id: string;
  title: string;
  alias: string;
  _level: number;
  scope?: { type: "chapter" | "committee"; id: string; name: string };
};
