const { PermissionFlagsBits } = require('discord.js');

// Validates user permissions and eligibility for bot actions
// Centralizes permission checking logic to ensure consistent security
// Prevents unauthorized users from accessing restricted bot features
class UserValidator {
    constructor() {
        // Future: Add mute tracking, timeout tracking, etc.
    }

    // Comprehensive eligibility check for bot actions
    // Validates membership status, timeout status, and bot detection
    // Provides detailed reasons for denials to aid in troubleshooting
    canAct(member, memberRoleId) {
        // Prevent bots from triggering actions to avoid automation loops
        if (member.user.bot) {
            return { canAct: false, reason: 'User is a bot' };
        }

        // Require member role for most bot interactions
        // This ensures only verified community members can use advanced features
        if (!member.roles.cache.has(memberRoleId)) {
            return { canAct: false, reason: 'User is not a member' };
        }

        // Respect Discord timeouts as a form of moderation
        // Timed out users shouldn't be able to bypass restrictions via bot actions
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

    // Determine if user has moderator privileges for bot commands
    // Checks both designated moderator role and Discord permissions
    // Allows flexibility in permission assignment while maintaining security
    canUseModerator(member, moderatorRoleId) {
        // Check for assigned moderator role
        const hasModerator = moderatorRoleId && member.roles.cache.has(moderatorRoleId);
        
        // Check for Discord manage roles permission as alternative
        // This allows server admins to use moderator commands without specific role
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