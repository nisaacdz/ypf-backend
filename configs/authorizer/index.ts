import { Request } from "express";
import { Profile } from "@/shared/types";
import { Role } from "./roles";
export * from "./roles";

export type GuardFunction = (req: Request) => boolean | Promise<boolean>;

export class Visitors {
  /** Allows any access, authenticated or not. */
  static ALL = () => true;

  /** Requires a user to be authenticated. */
  static AUTHENTICATED = (req: Request) => !!req.User;

  /**
   * Checks if the authenticated user has at least one of
   * the specified profiles (e.g., "ADMIN", "MEMBER").
   */
  static hasProfile(...types: Profile[]) {
    return (req: Request) => {
      if (!req.User) return false;
      return req.User.profiles.some((p) => types.includes(p));
    };
  }

  /**
   * Checks if the authenticated user has at least one of
   * the specified static roles (e.g., "MEMBER.president").
   */
  static hasRole(...roles: (Role | ((req: Request) => Role))[]) {
    return (req: Request) => {
      if (!req.User) return false;
      return req.User.roles.some((r) =>
        roles.some((exp) =>
          typeof exp === "object" ? exp.cmp(r) : exp(req).cmp(r),
        ),
      );
    };
  }
}

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
