export class Role {
  constructor(public cmp: (role: string) => boolean) {}

  static new(...roles: string[]) {
    return new Role((role: string) => roles.includes(role));
  }
}
