/**
 * The root type for the JSONB column.
 * Represents either a single targeting rule or a complex logic tree.
 */
export type AudienceRule = AtomicRule | CompositeRule;

// ---------------------------------------------------------------------------
// Logic Composition
// ---------------------------------------------------------------------------

export type CompositeRule =
  | { op: "OR"; rules: AudienceRule[] } // Union: Matches if ANY rule matches
  | { op: "AND"; rules: AudienceRule[] } // Intersection: Matches if ALL rules match
  | { op: "NOT"; rule: AudienceRule }; // Exclusion: Matches if rule does NOT match

// ---------------------------------------------------------------------------
// Atomic Targets
// ---------------------------------------------------------------------------

export type AtomicRule =
  | AllConstituentsRule
  | SpecificUsersRule
  | MemberRule
  | VolunteerRule
  | AdminRule
  | ProfileRule
  | LeaderRule
  | DonorRule;

/**
 * Targets the general constituent base with broad property filters.
 * Often used as the "Everyone" rule.
 */
export type AllConstituentsRule = {
  kind: "CONSTITUENTS";
};

/**
 * Targets a manual list of specific constituent IDs.
 */
export type SpecificUsersRule = {
  kind: "SPECIFIC_USERS";
  constituentIds: string[];
};

/**
 * Targets members based on organizational scope, status, or held roles.
 */
export type MemberRule = {
  kind: "MEMBERS";
  scope?: {
    chapterId?: string;
    committeeId?: string;
  };
  /** @default "ACTIVE" */
  status?: "ACTIVE" | "PAST" | "ALL";
  /** e.g. ["PRESIDENT", "TREASURER"] */
  roles?: string[];
};

/**
 * Targets volunteers based on their engagement status.
 */
export type VolunteerRule = {
  kind: "VOLUNTEERS";
  status?: "ACTIVE" | "PAST" | "ALL";
};

/**
 * Targets users with specific administrative roles.
 */
export type AdminRule = {
  kind: "ADMINS";
  roles?: ("SUPER_ADMIN" | "REGULAR_ADMIN")[];
  status?: "ACTIVE" | "PAST" | "ALL";
};

/**
 * Targets users based on simple profiles (Directors, Auditors).
 */
export type ProfileRule = {
  kind: "PROFILES";
  profileType: "DIRECTOR" | "AUDITOR";
  status?: "ACTIVE" | "PAST" | "ALL";
};

/**
 * Targets "Leaders" as defined by the organization:
 * - Members with any assigned Title
 * - Admins with any assigned Role
 */
export type LeaderRule = {
  kind: "LEADERS";
  status?: "ACTIVE" | "PAST" | "ALL";
};

/**
 * Targets constituents based on financial contribution history.
 */
export type DonorRule = {
  kind: "DONORS";
  minTotalDonation?: number;
  currency?: string;
  period?: {
    start?: string;
    end?: string;
  };
};
