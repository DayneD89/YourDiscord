class ActionExecutor {
    constructor(bot) {
        this.bot = bot;
    }

    async executeAction(action, member, guild) {
        console.log(`Executing action: ${action} for user: ${member.user.tag}`);

        // Parse the action
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

    async executeAddRole(roleName, member, guild) {
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

    findRole(roleName, guild) {
        // Check if it's a special role name with corresponding ID
        if (roleName === 'member' && this.bot.getMemberRoleId()) {
            return guild.roles.cache.get(this.bot.getMemberRoleId());
        }
        
        // Search by name
        return guild.roles.cache.find(r => r.name === roleName);
    }

    // Future: Add more action types here
    // executeTimeout(duration, member, guild) { ... }
    // executeKick(member, guild) { ... }
    // executeCustomAction(actionData, member, guild) { ... }
}

module.exports = ActionExecutor;