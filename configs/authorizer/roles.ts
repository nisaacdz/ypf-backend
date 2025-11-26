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
  COMMITTEECHAIR: Role.matches(/^MEMBER\.chair\..+$/),
  chapterLead: (chapterId: string) => Role.new(`MEMBER.lead.${chapterId}`),
  committeeChair: (committeeId: string) =>
    Role.new(`MEMBER.chair.${committeeId}`),
};
