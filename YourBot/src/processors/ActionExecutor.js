/**
 * ActionExecutor - Safe execution of Discord role-based actions
 * 
 * Handles the secure execution of role assignments and removals triggered by reactions.
 * Provides validation, parsing, and safe execution of configured actions.
 * 
 * Security design rationale:
 * - Action string parsing prevents code injection while allowing flexibility
 * - User eligibility validation ensures only authorized members get roles
 * - Role validation prevents assignment of non-existent or restricted roles
 * - Comprehensive error handling prevents partial state or security bypasses
 * 
 * Supported action formats:
 * - AddRole(user_id,'role_name') - Assigns a role to the reacting user
 * - RemoveRole(user_id,'role_name') - Removes a role from the reacting user
 */
class ActionExecutor {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Execute a configured action safely with validation
     * 
     * Parses action strings and delegates to appropriate handlers while ensuring
     * security and validity of all operations.
     * 
     * @param {string} action - Action string to parse and execute
     * @param {GuildMember} member - Discord member to apply action to
     * @param {Guild} guild - Discord guild context
     * @returns {boolean} - True if action succeeded, false otherwise
     */
    async executeAction(action, member, guild) {
        console.log(`Executing action: ${action} for user: ${member.user.tag}`);

        // Parse action string using regex to extract role names
        // This allows flexible configuration while maintaining security
        const addRoleMatch = action.match(/AddRole\(user_id,'(.+?)'\)/);
        const removeRoleMatch = action.match(/RemoveRole\(user_id,'(.+?)'\)/);

        try {
            if (addRoleMatch) {
                await this.executeAddRole(addRoleMatch[1], member, guild);
            } else if (removeRoleMatch) {
                await this.executeRemoveRole(removeRoleMatch[1], member, guild);
            } else {
                console.log(`Unknown action: ${action}`);
            }
        } catch (error) {
            console.error('Error executing action:', error);
        }
    }

    // Add a role to a user with eligibility validation
    // Prevents unauthorized role assignments and duplicate role additions
    async executeAddRole(roleName, member, guild) {
        const role = this.findRole(roleName, guild);
        
        if (!role) {
            console.log(`Role not found: ${roleName}`);
            return;
        }

        // Validate user eligibility for non-member roles
        // Member role can be assigned to anyone, but other roles require validation
        if (roleName !== 'member') {
            const validation = this.bot.getUserValidator().canAct(member, this.bot.getMemberRoleId());
            if (!validation.canAct) {
                console.log(`User ${member.user.tag} cannot act: ${validation.reason}`);
                return;
            }
        }

        // Check if user already has the role to avoid unnecessary Discord API calls
        if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            console.log(`✅ Added role ${role.name} to ${member.user.tag}`);
        } else {
            console.log(`User ${member.user.tag} already has role ${role.name}`);
        }
    }

    async executeRemoveRole(roleName, member, guild) {
        const role = this.findRole(roleName, guild);
        
        if (!role) {
            console.log(`Role not found: ${roleName}`);
            return;
        }

        // For non-member role actions, check if user can act
        if (roleName !== 'member') {
            const validation = this.bot.getUserValidator().canAct(member, this.bot.getMemberRoleId());
            if (!validation.canAct) {
                console.log(`User ${member.user.tag} cannot act: ${validation.reason}`);
                return;
            }
        }

        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            console.log(`❌ Removed role ${role.name} from ${member.user.tag}`);
        } else {
            console.log(`User ${member.user.tag} doesn't have role ${role.name}`);
        }
    }

    // Find Discord role by name with special handling for configured roles
    // Prioritizes role IDs from configuration over name-based lookup for reliability
    findRole(roleName, guild) {
        // Use configured role ID for special roles to avoid name conflicts
        // Role names can change, but IDs remain constant
        if (roleName === 'member' && this.bot.getMemberRoleId()) {
            return guild.roles.cache.get(this.bot.getMemberRoleId());
        }
        
        // Fall back to name-based search for custom roles
        return guild.roles.cache.find(r => r.name === roleName);
    }

    // Future: Add more action types here
    // executeTimeout(duration, member, guild) { ... }
    // executeKick(member, guild) { ... }
    // executeCustomAction(actionData, member, guild) { ... }
}

module.exports = ActionExecutor;