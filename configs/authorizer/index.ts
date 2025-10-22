import { Request } from "express";
import { Profile } from "@/shared/types";

export const ADMIN = {
  REGULAR: (role: string) => role === "ADMIN.REGULAR",
  SUPER: (role: string) => role === "ADMIN.SUPER",
};

export const MEMBER = {
  PRESIDENT: (role: string) => role === "MEMBER.president",
  chapterLead: (chapterId: string) => (role: string) =>
    role === `MEMBER.lead.${chapterId}`,
  committeeChair: (committeeId: string) => (role: string) =>
    role === `MEMBER.chair.${committeeId}`,
  TREASURER: (role: string) => role === "MEMBER.treasurer",
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
const hasRole = (roleFunction: (role: string) => boolean): GuardFunction => {
  return (req) => {
    if (!req.User) return false;
    return req.User.roles.some((role) => roleFunction(role));
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
