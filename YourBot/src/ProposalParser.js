class ProposalParser {
    constructor(proposalConfig) {
        this.proposalConfig = proposalConfig;
    }

    getProposalType(channelId, content) {
        // Find which proposal type this channel/content matches
        for (const [type, config] of Object.entries(this.proposalConfig)) {
            if (config.debateChannelId === channelId) {
                // Check if content matches the required format for this type
                const formatRegex = new RegExp(`^\\*\\*(?:${config.formats.join('|')}|Withdraw)\\*\\*:`, 'i');
                if (formatRegex.test(content.trim())) {
                    // Check if this is a withdrawal proposal
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

    createVoteMessage(originalMessage, proposalType, config, isWithdrawal = false) {
        const author = originalMessage.author;
        const proposalContent = originalMessage.content;
        const endTime = Date.now() + config.voteDuration;
        const withdrawalText = isWithdrawal ? 'WITHDRAWAL ' : '';
        
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