import { NextFunction, Request, Response } from "express";
import { AuthenticatedUser } from "@/shared/types";
import { MembershipType as MembershipTypeEnum } from "@/db/schema/enums";

export const ROLES = {
  PRESIDENT: "role_president",
  SECRETARY: "role_secretary",
  FINANCIAL_SECRETARY: "role_financial_secretary",
  EVENT_COORDINATOR: "event_coordinator",
  CHAPTER_LEADER: "chapter_leader",
  COMMITTEE_CHAIR: "committee_chair",
};

export type GuardFunction = (
  user: AuthenticatedUser | null,
  req: Request,
) => boolean | Promise<boolean>;

/**
 * Check if user has ANY of the specified memberships
 */
const hasMembership = (
  ...types: (typeof MembershipTypeEnum.enumValues)[number][]
): GuardFunction => {
  return (user) => {
    if (!user) return false;
    return user.memberships.some((m) => types.includes(m));
  };
};

/**
 * Check if user has a specific role (optionally scoped)
 */
const hasRole = (roleName: string, requireScope?: string): GuardFunction => {
  return (user) => {
    if (!user) return false;
    return user.roles.some((role) => {
      if (role.name !== roleName) return false;
      if (!requireScope) return true;
      return role.scope === "*" || role.scope === requireScope;
    });
  };
};

/**
 * Check if user is accessing their own resource
 */
const isSelf: GuardFunction = (user, req) => {
  if (!user) return false;
  const resourceId = req.params.id || req.params.constituentId;
  return user.constituentId === resourceId;
};

/**
 * Combine multiple guards with OR logic
 */
export const anyOf = (...guards: GuardFunction[]): GuardFunction => {
  return async (user, req) => {
    for (const guard of guards) {
      if (await guard(user, req)) return true;
    }
    return false;
  };
};

/**
 * Combine multiple guards with AND logic
 */
export const allOf = (...guards: GuardFunction[]): GuardFunction => {
  return async (user, req) => {
    for (const guard of guards) {
      if (!(await guard(user, req))) return false;
    }
    return true;
  };
};

const Guards = {
  public: () => true,

  authenticated: (user: AuthenticatedUser | null) => user !== null,

  hasMembership: hasMembership,

  isMemberOrVolunteer: hasMembership("MEMBER", "VOLUNTEER"),
  isStaff: anyOf(
    hasMembership("SUPER_USER"),
    hasRole("role_president"),
    hasRole("role_secretary"),
    hasRole("role_financial_secretary"),
  ),

  hasRole,

  isSelf,

  anyOf,
  allOf,
};

/**
 * Create authorization middleware from a guard function
 */
export const authorize = (guard: GuardFunction | boolean) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.User || null;

      const hasAccess =
        typeof guard === "boolean" ? guard : await guard(user, req);

      if (hasAccess) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: "You don't have permission to access this resource",
      });
    } catch (error) {
      return next(error);
    }
  };
};

export { Guards };
