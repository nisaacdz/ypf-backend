/* eslint-disable @typescript-eslint/no-explicit-any */
import { Enforcer, newEnforcer } from "casbin";
import { resolve } from "path";
import { AuthenticatedUser } from "@/shared/types";
import { MembershipType } from "@/db/schema/enums";

/**
 * Extracts a scope ID (like a chapter or committee ID) from a URL path.
 * @param path The URL path, e.g., "/chapters/uuid-123/members".
 * @returns The scope ID ("uuid-123") or null if not a scoped path.
 */
const extractScopeFromPath = (path: string): string | null => {
  const parts = path.split("/");
  if ((parts[1] === "chapters" || parts[1] === "committees") && parts[2]) {
    // Return the :id part of the path
    return parts[2];
  }
  return null;
};

/**
 * The core authorization logic, registered as a custom function with Casbin.
 * This function understands your AuthenticatedUser object structure.
 *
 * @param user The authenticated user object from the JWT.
 * @param policySubject The subject from the matching policy rule (e.g., 'role_chapter_head', 'MEMBER', 'SELF').
 * @param resourcePath The path of the resource being accessed (e.g., '/chapters/uuid-123').
 * @returns {boolean} True if the user is authorized, false otherwise.
 */
const customMatcher = (
  user: AuthenticatedUser,
  policySubject: string,
  resourcePath: string,
): boolean => {
  // 1. Ownership Check: Handle 'SELF' policies
  if (policySubject === "SELF") {
    const pathParts = resourcePath.split("/");
    if (pathParts[1] === "constituents" && pathParts[2]) {
      const resourceId = pathParts[2];
      return user.constituentId === resourceId;
    }
    return false; // 'SELF' policies only apply to constituent paths
  }

  // 2. Membership Check: Handle policies based on membership type (e.g., 'MEMBER', 'DONOR')
  if (Object.values(MembershipType.enumValues).includes(policySubject as any)) {
    return user.memberships.includes(policySubject as any);
  }

  // 3. Role-based Check: Handle policies for specific roles with scopes
  const resourceScope = extractScopeFromPath(resourcePath);

  for (const userRole of user.roles) {
    if (userRole.name === policySubject) {
      // User has the role defined in the policy. Now check if the scope matches.
      // Access is granted if:
      // a) The user's role is global (scope: '*').
      // b) The resource is scoped and its scope matches the user's role scope.
      if (
        userRole.scope === "*" ||
        (resourceScope && userRole.scope === resourceScope)
      ) {
        return true;
      }
    }
  }

  return false;
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

    // Register our powerful custom function with the name used in the model matcher
    enforcer.addFunction("customMatcher", customMatcher);

    this.enforcerInstance = enforcer;
    console.log("Casbin policy enforcer and rules loaded. 🛡️");
  }

  public async enforce(
    user: AuthenticatedUser | null,
    resource: string,
    action: string,
  ): Promise<boolean> {
    if (!this.enforcerInstance) {
      throw new Error(
        "Policy enforcer not initialized. Call authorizer.initialize() first.",
      );
    }
    return this.enforcerInstance.enforce(user, resource, action);
  }
}

const authorizer = new Authorizer();
export default authorizer;
