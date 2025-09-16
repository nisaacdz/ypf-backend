import { Enforcer, newEnforcer } from 'casbin';
import { resolve } from 'path';

/**
 * Custom function to check if a user's roles array (passed as a JSON string)
 * contains the role required by the policy.
 * @param userRolesStr - A JSON string representing an array of user roles.
 * @param policyRole - The role required by the policy.
 * @returns True if the user has the required role, false otherwise.
 */
const hasRole = (userRolesStr: string, policyRole: string): boolean => {
    try {
        const userRoles: string[] = JSON.parse(userRolesStr);
        return userRoles.includes(policyRole);
    } catch (e) {
        return false;
    }
};

class CasbinService {
    private enforcerInstance: Enforcer | undefined;

    public async initialize(): Promise<void> {
        if (this.enforcerInstance) {
            console.log('Casbin enforcer already initialized. ✅');
            return;
        }

        const modelPath = resolve('src/config/model.conf');
        const policyPath = resolve('src/config/policy.csv');

        const enforcer = await newEnforcer(modelPath, policyPath);
        enforcer.addFunction('hasRole', hasRole);

        await enforcer.loadPolicy();
        this.enforcerInstance = enforcer;
        
        console.log('Casbin enforcer and policies loaded. 🛡️');
    }

    /**
     * Returns the initialized Casbin enforcer instance.
     * @throws Error if the enforcer has not been initialized.
     * @returns The Casbin Enforcer.
     */
    public get enforcer(): Enforcer {
        if (!this.enforcerInstance) {
            throw new Error('Enforcer not initialized. Call initialize() first.');
        }
        return this.enforcerInstance;
    }
}

export const casbinService = new CasbinService();