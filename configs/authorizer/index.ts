import { AuthenticatedUser } from "@/shared/validators";
import { Enforcer, newEnforcer } from "casbin";
import { MembershipType } from "@/db/schema/enums";
import { resolve } from "path";

const hasRole = (user: AuthenticatedUser, role: string): boolean => {
  return user.roles && user.roles.includes(role);
};

const hasMembership = (
  user: AuthenticatedUser,
  membership: (typeof MembershipType.enumValues)[number],
): boolean => {
  return user.memberships && user.memberships.includes(membership);
};

class Authorizer {
  private enforcerInstance: Enforcer | undefined;

  public async initialize(): Promise<void> {
    if (this.enforcerInstance) {
      console.log("Casbin policy enforcer already initialized. ✅");
      return;
    }

    const modelPath = resolve(__dirname, "./model.conf");
    const policyPath = resolve(__dirname, "./policy.csv");

    const enforcer = await newEnforcer(modelPath, policyPath);

    // Register our custom functions with the names used in the model matcher
    enforcer.addFunction("hasRole", hasRole);
    enforcer.addFunction("hasMembership", hasMembership);

    await enforcer.loadPolicy();
    this.enforcerInstance = enforcer;

    console.log("Casbin policy enforcer and rules loaded. 🛡️");
  }

  public async enforce(
    user: AuthenticatedUser,
    resource: string, // req.path
    action: string, // req.method
  ): Promise<boolean> {
    if (!this.enforcerInstance) {
      throw new Error(
        "Policy enforcer not initialized. Call authorizer.initialize() first.",
      );
    }
    // The 'user' object is passed as the subject (sub)
    return this.enforcerInstance.enforce(user, resource, action);
  }
}

const authorizer = new Authorizer();

export default authorizer;
