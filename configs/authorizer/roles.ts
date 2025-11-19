export class Role {
  constructor(public cmp: (role: string) => boolean) {}

  static new(...roles: string[]) {
    return new Role((role: string) => roles.includes(role));
  }

  static matches(pattern: RegExp) {
    return new Role((userRole: string) => pattern.test(userRole));
  }
}

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
  LEADER: Role.matches(/^MEMBER\..+$/),
};
