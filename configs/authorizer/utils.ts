import { Role, GuardFunction } from ".";
import { Request } from "express";

export const ADMIN = {
  REGULAR: { cmp: (role: string) => role === "ADMIN.REGULAR" },
  SUPER: { cmp: (role: string) => role === "ADMIN.SUPER" },
};

export class MEMBER {
  static PRESIDENT = Role.new("MEMBER.president", "MEMBER.president.*");
  static TREASURER = Role.new("MEMBER.treasurer");
  static chapterLead(chapterId: string) {
    return Role.new(`MEMBER.lead.${chapterId}`);
  }
  static committeeChair(committeeId: string) {
    return Role.new(`MEMBER.chair.${committeeId}`);
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
