export class Role {
  constructor(public cmp: (role: string) => boolean) {}

  static new(expectedRole: string) {
    return new Role((role) => role === expectedRole);
  }

  static matches(pattern: RegExp) {
    return new Role((userRole: string) => pattern.test(userRole));
  }
}

export const ADMIN = {
  REGULAR: Role.new("ADMIN.REGULAR_ADMIN"),
  SUPER: Role.new("ADMIN.SUPER_ADMIN"),
};

export const MEMBER = {
  LEADER: Role.matches(/^MEMBER\..+$/),
  PRESIDENT: Role.new("MEMBER.president"),
  TREASURER: Role.new("MEMBER.treasurer"),
  CHAPTERLEAD: Role.matches(/^MEMBER\.lead\..+$/),
  CHAPTERHEAD: Role.matches(/^MEMBER\.chapterhead\..+$/),
  COMMITTEECHAIR: Role.matches(/^MEMBER\.committeechair\..+$/),
  COMMITTEEMEMBER: Role.matches(/^MEMBER\.committeemember\..+$/),
  chapterLead: (chapterId: string) =>
    Role.new(`MEMBER.chapterlead.${chapterId}`),
  chapterHead: (chapterId: string) =>
    Role.new(`MEMBER.chapterhead.${chapterId}`),
  committeeChair: (committeeId: string) =>
    Role.new(`MEMBER.committeechair.${committeeId}`),
  committeeMember: (committeeId: string) =>
    Role.new(`MEMBER.committeemember.${committeeId}`),
};
