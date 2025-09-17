import { Enforcer, newEnforcer } from "casbin";
import { resolve } from "path";

/**
 * Custom Casbin function. Checks if a JSON string array of user roles
 * contains the single role required by a policy rule.
 * @param userRolesStr The user's roles, passed from the enforcer as a JSON string.
 * @param policyRole The role defined in the policy.csv file.
 * @returns boolean
 */
const hasRole = (userRolesStr: string, policyRole: string): boolean => {
  try {
    const userRoles: string[] = JSON.parse(userRolesStr);
    // Ensure it's an array before checking
    return Array.isArray(userRoles) && userRoles.includes(policyRole);
  } catch (e) {
    // In case of invalid JSON, deny access.
    return false;
  }
};

/**
 * Manages the Casbin enforcer instance for the application.
 * Follows a singleton pattern to ensure policy is loaded only once.
 */
class PolicyConfig {
  private enforcerInstance: Enforcer | undefined;

  /**
   * Initializes the Casbin enforcer by loading the model and policy files.
   * This must be called at application startup.
   */
  public async initialize(): Promise<void> {
    if (this.enforcerInstance) {
      console.log("Casbin policy enforcer already initialized. ✅");
      return;
    }

    const modelPath = resolve(__dirname, "./model.conf");
    const policyPath = resolve(__dirname, "./policy.csv");

    const enforcer = await newEnforcer(modelPath, policyPath);

    // Register our custom 'hasRole' function so it can be used in the model matcher.
    enforcer.addFunction("hasRole", hasRole);

    await enforcer.loadPolicy();
    this.enforcerInstance = enforcer;

    console.log("Casbin policy enforcer and rules loaded. 🛡️");
  }

  /**
   * Provides access to the initialized Casbin enforcer.
   * @throws Error if the enforcer has not been initialized via `initialize()`.
   * @returns The singleton Enforcer instance.
   */
  public get enforcer(): Enforcer {
    if (!this.enforcerInstance) {
      throw new Error(
        "Policy enforcer not initialized. Call policyConfig.initialize() first.",
      );
    }
    return this.enforcerInstance;
  }
}

const policyConfig = new PolicyConfig();

export default policyConfig;
