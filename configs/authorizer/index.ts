import { Request } from "express";
import { Profile } from "@/shared/types";

export const ADMIN = {
  REGULAR: (role: string) => role === "ADMIN.REGULAR",
  SUPER: (role: string) => role === "ADMIN.SUPER",
};

export const MEMBER = {
  PRESIDENT: "MEMBER.president",
  chapterLead: (chapterId: string) => `MEMBER.lead.${chapterId}`,
  committeeChair: (committeeId: string) => `MEMBER.chair.${committeeId}`,
  TREASURER: "MEMBER.treasurer",
};

export type GuardFunction = (req: Request) => boolean | Promise<boolean>;

/**
 * Check if user has ANY of the specified profiles
 */
const hasProfile = (...types: Profile[]): GuardFunction => {
  return (req) => {
    if (!req.User) return false;
    return req.User.profiles.some((m) => types.includes(m));
  };
};

/**
 * Check if user has a specific role (optionally scoped)
 */
const hasRole = (
  ...roles: (string | ((req: Request) => string))[]
): GuardFunction => {
  return (req) => {
    if (!req.User) return false;
    return req.User.roles.some((role) => {
      let result = false;
      for (const r of roles) {
        if (typeof r === "string") {
          result = r == role;
        } else {
          result = role == r(req);
        }
        if (result) {
          break;
        }
      }

      return result;
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

const Visitors = {
  ALL: () => true,

  authenticated: (req: Request) => req.User !== null,

  hasProfile,

  hasRole,
};

export { Visitors };
