import { Request } from "express";
import { MembershipType as MembershipTypeEnum } from "@/db/schema/enums";

export const ROLES = {
  PRESIDENT: "role_president",
  SECRETARY: "role_secretary",
  FINANCIAL_SECRETARY: "role_financial_secretary",
  EVENT_COORDINATOR: "event_coordinator",
  CHAPTER_LEADER: "chapter_leader",
  COMMITTEE_CHAIR: "committee_chair",
};

export type GuardFunction = (req: Request) => boolean | Promise<boolean>;

/**
 * Check if user has ANY of the specified memberships
 */
const hasMembership = (
  ...types: (typeof MembershipTypeEnum.enumValues)[number][]
): GuardFunction => {
  return (req) => {
    if (!req.User) return false;
    return req.User.memberships.some((m) => types.includes(m));
  };
};

/**
 * Check if user has a specific role (optionally scoped)
 */
const hasRole = (roleName: string, requireScope?: string): GuardFunction => {
  return (req) => {
    if (!req.User) return false;
    return req.User.roles.some((role) => {
      if (role.name !== roleName) return false;
      if (!requireScope) return true;
      return role.scope === "*" || role.scope === requireScope;
    });
  };
};

/**
 * Combine multiple guards with OR logic
 */
export const anyOf = (...guards: GuardFunction[]): GuardFunction => {
  return async (req) => {
    for (const guard of guards) {
      if (await guard(req)) return true;
    }
    return false;
  };
};

/**
 * Combine multiple guards with AND logic
 */
export const allOf = (...guards: GuardFunction[]): GuardFunction => {
  return async (req) => {
    for (const guard of guards) {
      if (!(await guard(req))) return false;
    }
    return true;
  };
};

const Guards = {
  ALL: () => true,

  authenticated: (req: Request) => req.User !== null,

  hasMembership,

  hasRole,
};

export { Guards };
