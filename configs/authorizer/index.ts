import { Request } from "express";
import { Profile } from "@/shared/types";

export const ADMIN = {
  REGULAR: "ADMIN.REGULAR",
  SUPER: "ADMIN.SUPER",
};

export const MEMBER = {
  PRESIDENT: "MEMBER.president",
  chapterLead: (chapterId: string) => `MEMBER.lead.${chapterId}`,
  committeeChair: (committeeId: string) => `MEMBER.chair.${committeeId}`,
  TREASURER: "MEMBER.treasurer",
};

export type GuardFunction = (req: Request) => boolean | Promise<boolean>;

export const anyOf = (...guards: GuardFunction[]) => {
  return async (req: Request) => {
    for (const guard of guards) {
      if (await guard(req)) return true;
    }
    return false;
  };
};

export const allOf = (...guards: GuardFunction[]) => {
  return async (req: Request) => {
    for (const guard of guards) {
      if (!(await guard(req))) return false;
    }
    return true;
  };
};

/**
 * Check if user has ANY of the specified profiles
 */
const hasProfile = (...types: Profile[]) => {
  return (req: Request) => {
    if (!req.User) return false;
    return req.User.profiles.some((p) => types.includes(p));
  };
};

/**
 * Check if user has ANY of the specified roles
 */
type RoleType = string | ((req: Request) => string | Promise<string>);
const hasRole = (...roles: RoleType[]) => {
  return (req: Request) => {
    if (!req.User) return false;
    return req.User.roles.some((r) =>
      roles.some((exp) =>
        typeof exp === "string" ? exp === r : exp(req) === r,
      ),
    );
  };
};

const Visitors = {
  /** Allows any access, authenticated or not. */
  ALL: () => true,

  /** Requires a user to be authenticated. */
  authenticated: (req: Request) => req.User !== null,

  /**
   * Checks if the authenticated user has at least one of
   * the specified profiles (e.g., "ADMIN", "MEMBER").
   */
  hasProfile,

  /**
   * Checks if the authenticated user has at least one of
   * the specified static roles (e.g., "MEMBER.president").
   */
  hasRole,
};

export { Visitors };
