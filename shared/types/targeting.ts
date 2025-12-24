export interface TargetingFilter {
  // 1. Organizational Scope (OR logic within arrays)
  chapterIds?: string[];
  committeeIds?: string[];

  // 2. Role / Status Filters (AND logic between categories)
  /** e.g. ["PRESIDENT", "TREASURER"] */
  roles?: string[];
  constituentTypes?: ("MEMBER" | "VOLUNTEER" | "ADMIN")[];

  // 3. Status
  status?: "ACTIVE" | "PAST" | "ALL";
}
