export class Role {
  constructor(public cmp: (role: string) => boolean) {}

  // static new(...roles: string[]) {
  //   return new Role((role: string) => roles.includes(role));
  // }

  static matches(pattern: RegExp) {
    return new Role((userRole: string) => pattern.test(userRole));
  }
}

export const ADMIN = {
  REGULAR: new Role((role: string) => role === "ADMIN.REGULAR"),
  SUPER: new Role((role: string) => role === "ADMIN.SUPER"),
};

export const MEMBER = {
  LEADER: Role.matches(/^MEMBER\..+$/),
  PRESIDENT: new Role((role) => role === "MEMBER.president"),
  TREASURER: new Role((role) => role === "MEMBER.treasurer"),
  CHAPTERLEAD: Role.matches(/^MEMBER\.lead\..+$/),
  COMMITTEECHAIR: Role.matches(/^MEMBER\.chair\..+$/),
  chapterLead: (chapterId: string) =>
    new Role((role) => role === `MEMBER.lead.${chapterId}`),
  committeeChair: (committeeId: string) =>
    new Role((role) => role === `MEMBER.chair.${committeeId}`),
};
