import { AuthenticatedUser } from "@/shared/validators";
import { Enforcer, newEnforcer } from "casbin";
import { resolve } from "path";

const hasRole = (userRolesStr: string, policyRole: string): boolean => {
  try {
    const userRoles: string[] = JSON.parse(userRolesStr);
    return Array.isArray(userRoles) && userRoles.includes(policyRole);
  } catch (e) {
    return false;
  }
};

class PolicyConfig {
  private enforcerInstance: Enforcer | undefined;

  public async initialize(): Promise<void> {
    if (this.enforcerInstance) {
      console.log("Casbin policy enforcer already initialized. ✅");
      return;
    }

    const modelPath = resolve(__dirname, "./model.conf");
    const policyPath = resolve(__dirname, "./policy.csv");

    const enforcer = await newEnforcer(modelPath, policyPath);

    enforcer.addFunction("hasRole", hasRole);

    await enforcer.loadPolicy();
    this.enforcerInstance = enforcer;

    console.log("Casbin policy enforcer and rules loaded. 🛡️");
  }

  public async enforce(
    user: AuthenticatedUser,
    resource: string,
    action: string,
  ): Promise<boolean> {
    if (!this.enforcerInstance) {
      throw new Error(
        "Policy enforcer not initialized. Call policyConfig.initialize() first.",
      );
    }
    return this.enforcerInstance.enforce(user, resource, action);
  }
}

const policyConfig = new PolicyConfig();

export default policyConfig;
