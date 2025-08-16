const { PermissionFlagsBits } = require('discord.js');

class UserValidator {
    constructor() {
        // Future: Add mute tracking, timeout tracking, etc.
    }

    /**
     * Check if a user can perform actions (not used yet, but ready for future use)
     * @param {GuildMember} member - Discord guild member
     * @param {string} memberRoleId - ID of the member role
     * @returns {Object} - { canAct: boolean, reason?: string }
     */
    canAct(member, memberRoleId) {
        // Check if user is a bot
        if (member.user.bot) {
            return { canAct: false, reason: 'User is a bot' };
        }

        // Check if user is a member (has the member role)
        if (!member.roles.cache.has(memberRoleId)) {
            return { canAct: false, reason: 'User is not a member' };
        }

        // Check if user is currently muted/timed out
        if (member.isCommunicationDisabled()) {
            return { canAct: false, reason: 'User is currently timed out' };
        }

        // Future checks can be added here:
        // - Custom mute role check
        // - Blacklist check
        // - Rate limiting check
        // - etc.

        return { canAct: true };
    }

    /**
     * Check if a user can use moderator commands
     * @param {GuildMember} member - Discord guild member
     * @param {string} moderatorRoleId - ID of the moderator role
     * @returns {boolean}
     */
    canUseModerator(member, moderatorRoleId) {
        // Check moderator role
        const hasModerator = moderatorRoleId && member.roles.cache.has(moderatorRoleId);
        
        // Check manage roles permission
        const hasPermissions = member.permissions.has(PermissionFlagsBits.ManageRoles);
        
        return hasModerator || hasPermissions;
    }

    /**
     * Check if user is a bot
     * @param {User} user - Discord user
     * @returns {boolean}
     */
    isBot(user) {
        return user.bot;
    }

    /**
     * Check if user has a specific role
     * @param {GuildMember} member - Discord guild member  
     * @param {string} roleId - Role ID to check
     * @returns {boolean}
     */
    hasRole(member, roleId) {
        return member.roles.cache.has(roleId);
    }
}

module.exports = UserValidator;