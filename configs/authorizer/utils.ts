import { Request } from "express";
import { Role } from "./role";

type GuardFunction = (req: Request) => boolean | Promise<boolean>;

export const ADMIN = {
  REGULAR: new Role((role: string) => role === "ADMIN.REGULAR"),
  SUPER: new Role((role: string) => role === "ADMIN.SUPER"),
};

export const MEMBER = {
  PRESIDENT: Role.new("MEMBER.president", "MEMBER.president.*"),
  TREASURER: Role.new("MEMBER.treasurer"),
  chapterLead: (chapterId: string) =>
    new Role((role) => role === `MEMBER.lead.${chapterId}`),
  committeeChair: (committeeId: string) =>
    new Role((role) => role === `MEMBER.chair.${committeeId}`),
};

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
