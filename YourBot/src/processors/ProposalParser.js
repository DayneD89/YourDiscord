/**
 * ProposalParser - Proposal format validation and message generation
 * 
 * Handles the parsing and validation of proposal messages to ensure they follow
 * required formats for proper democratic processing.
 * 
 * Format enforcement rationale:
 * - Structured formats ensure proposals are clear and actionable
 * - Type-specific validation prevents proposals in wrong channels
 * - Consistent formatting enables automated processing and reduces ambiguity
 * - Withdrawal detection allows for removal of previously passed proposals
 * 
 * Supported formats:
 * - **Policy**: content (for policy proposals)
 * - **Moderator**: content (for staff changes)
 * - **Governance**: content (for system changes)
 * - **Withdraw**: reference (for proposal removals)
 */
class ProposalParser {
    constructor(proposalConfig) {
        this.proposalConfig = proposalConfig;
    }

    /**
     * Determine proposal type from channel context and content format
     * 
     * Validates that proposals are submitted in the correct channel with proper formatting.
     * Different proposal types have different channels and format requirements.
     * 
     * @param {string} channelId - Discord channel where proposal was submitted
     * @param {string} content - Raw proposal content to validate
     * @returns {Object|null} - {type, config, isWithdrawal} or null if invalid
     */
    getProposalType(channelId, content) {
        // Match channel to proposal type configuration
        for (const [type, config] of Object.entries(this.proposalConfig)) {
            if (config.debateChannelId === channelId) {
                // Validate that content follows required format for this proposal type
                // Format: **ProposalType**: content or **Withdraw**: content
                const formatRegex = new RegExp(`^\\*\\*(?:${config.formats.join('|')}|Withdraw)\\*\\*:`, 'i');
                if (formatRegex.test(content.trim())) {
                    // Detect withdrawal proposals which follow special processing
                    const isWithdrawal = /^\*\*Withdraw\*\*:/i.test(content.trim());
                    console.log(`Matched proposal type: ${type}${isWithdrawal ? ' (withdrawal)' : ''}`);
                    return { type, config, isWithdrawal };
                }
            }
        }
        console.log(`No matching proposal type found for channel ${channelId}`);
        return null;
    }

    isValidProposalFormat(channelId, content) {
        const proposalMatch = this.getProposalType(channelId, content);
        const isValid = proposalMatch !== null;
        console.log(`Checking proposal format for: "${content.substring(0, 50)}..." in channel ${channelId} - Valid: ${isValid}`);
        return isValid;
    }

    // Generate formatted vote message for proposals that advance to voting
    // Creates clear, standardized vote messages with instructions and deadlines
    createVoteMessage(originalMessage, proposalType, config, isWithdrawal = false) {
        const author = originalMessage.author;
        const proposalContent = originalMessage.content;
        const endTime = Date.now() + config.voteDuration;
        const withdrawalText = isWithdrawal ? 'WITHDRAWAL ' : '';
        
        // Create comprehensive vote message with all necessary information
        // Includes original proposal, voting instructions, and deadline
        return `🗳️ **${proposalType.toUpperCase()} ${withdrawalText}VOTING PHASE**

**Proposed by:** ${author.tag}
**Type:** ${proposalType}${isWithdrawal ? ' (withdrawal)' : ''}
**Original Proposal:**
${proposalContent}

**Instructions:**
${isWithdrawal ? 
    '✅ React with ✅ to SUPPORT withdrawing this resolution\n❌ React with ❌ to OPPOSE withdrawal (keep the resolution)' :
    '✅ React with ✅ to SUPPORT this proposal\n❌ React with ❌ to OPPOSE this proposal'
}

**Voting ends:** <t:${Math.floor(endTime / 1000)}:F>

React below to cast your vote!`;
    }

    extractOriginalResolution(resolutionContent) {
        // Extract the original proposal text from a resolution message
        const resolutionMatch = resolutionContent.match(/\*\*Resolution:\*\*\s*(.+?)(?:\n\*|$)/s);
        if (resolutionMatch) {
            return resolutionMatch[1].trim();
        }
        
        // Fallback: return the whole resolution content
        return resolutionContent;
    }
}

module.exports = ProposalParser;