/**
 * ModeratorProcessor - Processes moderator-related proposals (add/remove moderator roles)
 * 
 * Handles the democratic process for changing server moderation staff through community proposals.
 * When moderator proposals pass community voting, this processor executes the role changes.
 * 
 * Design rationale:
 * - Democratic moderator selection ensures community input on server leadership
 * - Automatic role assignment prevents manual errors and ensures timely changes
 * - Validation prevents invalid users from being assigned moderator privileges
 * - Comprehensive logging provides audit trail for moderator changes
 */
class ModeratorProcessor {
    constructor(bot, proposalConfig) {
        this.bot = bot;
        this.proposalConfig = proposalConfig;
    }

    /**
     * Parse moderator proposal to extract target user and action type
     * Format: **Add Moderator**: @user or **Remove Moderator**: @user
     * 
     * This parsing ensures only properly formatted proposals can affect moderator status,
     * preventing accidental or malformed role changes.
     */
    parseModeratorProposal(content) {
        console.log(`Parsing moderator proposal: ${content}`);
        
        // Check for add moderator format
        const addMatch = content.match(/^\*\*Add Moderator\*\*:\s*(.+)$/i);
        if (addMatch) {
            const targetText = addMatch[1].trim();
            const userId = this.extractUserId(targetText);
            if (userId) {
                return {
                    action: 'add',
                    userId: userId,
                    targetText: targetText
                };
            }
        }
        
        // Check for remove moderator format
        const removeMatch = content.match(/^\*\*Remove Moderator\*\*:\s*(.+)$/i);
        if (removeMatch) {
            const targetText = removeMatch[1].trim();
            const userId = this.extractUserId(targetText);
            if (userId) {
                return {
                    action: 'remove',
                    userId: userId,
                    targetText: targetText
                };
            }
        }
        
        console.log('No valid moderator action found in proposal');
        return null;
    }

    // Extract user ID from various mention formats
    // Supports: @username, <@123456>, <@!123456>, or raw user ID
    extractUserId(text) {
        // Discord mention format: <@123456> or <@!123456>
        const mentionMatch = text.match(/<@!?(\d{17,19})>/);
        if (mentionMatch) {
            return mentionMatch[1];
        }
        
        // Raw user ID (17-19 digits)
        const idMatch = text.match(/^\d{17,19}$/);
        if (idMatch) {
            return text;
        }
        
        console.log(`Could not extract user ID from: ${text}`);
        return null;
    }

    // Process passed moderator proposal by applying role change
    // Adds or removes moderator role as specified in the proposal
    async processModeratorAction(proposal, guild) {
        try {
            console.log(`Processing moderator action for proposal: ${proposal.message_id}`);
            
            const moderatorAction = this.parseModeratorProposal(proposal.content);
            if (!moderatorAction) {
                console.error('Could not parse moderator action from proposal content');
                return false;
            }
            
            const { action, userId, targetText } = moderatorAction;
            console.log(`Moderator action: ${action} for user ${userId}`);
            
            // Get guild member
            const targetMember = await guild.members.fetch(userId).catch(() => null);
            if (!targetMember) {
                console.error(`Could not find member with ID ${userId} in guild`);
                return false;
            }
            
            // Get moderator role
            const moderatorRoleId = this.bot.getModeratorRoleId();
            const moderatorRole = guild.roles.cache.get(moderatorRoleId);
            if (!moderatorRole) {
                console.error(`Could not find moderator role with ID ${moderatorRoleId}`);
                return false;
            }
            
            // Apply role change
            if (action === 'add') {
                if (targetMember.roles.cache.has(moderatorRoleId)) {
                    console.log(`User ${targetMember.displayName} already has moderator role`);
                    return true; // Not an error, just already has role
                }
                
                await targetMember.roles.add(moderatorRole);
                console.log(`✅ Added moderator role to ${targetMember.displayName}`);
                
            } else if (action === 'remove') {
                if (!targetMember.roles.cache.has(moderatorRoleId)) {
                    console.log(`User ${targetMember.displayName} does not have moderator role`);
                    return true; // Not an error, just doesn't have role
                }
                
                await targetMember.roles.remove(moderatorRole);
                console.log(`✅ Removed moderator role from ${targetMember.displayName}`);
            }
            
            return true;
            
        } catch (error) {
            console.error('Error processing moderator action:', error);
            return false;
        }
    }

    // Generate human-readable summary of moderator action
    // Used for vote messages and resolution displays
    getActionSummary(content) {
        const moderatorAction = this.parseModeratorProposal(content);
        if (!moderatorAction) {
            return 'Unknown moderator action';
        }
        
        const { action, targetText } = moderatorAction;
        if (action === 'add') {
            return `Add ${targetText} as moderator`;
        } else if (action === 'remove') {
            return `Remove ${targetText} from moderator role`;
        }
        
        return 'Unknown moderator action';
    }
}

module.exports = ModeratorProcessor;