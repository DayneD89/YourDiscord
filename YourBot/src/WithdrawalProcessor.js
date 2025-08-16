class WithdrawalProcessor {
    constructor(bot, proposalConfig) {
        this.bot = bot;
        this.proposalConfig = proposalConfig;
    }

    async parseWithdrawalTarget(content, proposalType, config) {
        try {
            // Extract the resolution reference from the withdrawal proposal
            // Expected format: **Withdraw**: [Resolution description/link]
            const withdrawMatch = content.match(/\*\*Withdraw\*\*:\s*(.+)/i);
            if (!withdrawMatch) {
                console.log('No withdrawal content found');
                return null;
            }

            const withdrawalContent = withdrawMatch[1].trim();
            console.log(`Looking for resolution to withdraw: "${withdrawalContent}"`);

            // Search for the resolution in the resolutions channel
            const guild = this.bot.client.guilds.cache.get(this.bot.getGuildId());
            const resolutionsChannelId = config.resolutionsChannelId;
            const resolutionsChannel = guild.channels.cache.get(resolutionsChannelId);

            if (!resolutionsChannel) {
                console.error(`Resolutions channel ${resolutionsChannelId} not found`);
                return null;
            }

            // Fetch recent messages to find the target resolution
            const messages = await resolutionsChannel.messages.fetch({ limit: 100 });
            
            for (const [messageId, message] of messages) {
                // Skip if not a resolution message
                if (!message.content.includes('PASSED') || !message.content.includes('RESOLUTION')) {
                    continue;
                }

                // Check if this resolution matches the withdrawal request
                if (this.isMatchingResolution(message.content, withdrawalContent)) {
                    console.log(`Found matching resolution: ${messageId}`);
                    return {
                        messageId: messageId,
                        channelId: resolutionsChannelId,
                        content: message.content,
                        originalContent: this.extractOriginalResolution(message.content)
                    };
                }
            }

            console.log('No matching resolution found');
            return null;

        } catch (error) {
            console.error('Error parsing withdrawal target:', error);
            return null;
        }
    }

    isMatchingResolution(resolutionContent, withdrawalTarget) {
        // Try multiple matching strategies
        
        // 1. Check if withdrawal target is contained in resolution
        if (resolutionContent.toLowerCase().includes(withdrawalTarget.toLowerCase())) {
            return true;
        }

        // 2. Extract the actual policy text from the resolution and compare
        const policyMatch = resolutionContent.match(/\*\*(?:Policy|Governance|Resolution)\*\*:\s*(.+?)(?:\n|$)/i);
        if (policyMatch) {
            const policyText = policyMatch[1].trim();
            if (policyText.toLowerCase().includes(withdrawalTarget.toLowerCase()) ||
                withdrawalTarget.toLowerCase().includes(policyText.toLowerCase())) {
                return true;
            }
        }

        // 3. Check for keyword overlap (for partial matches)
        const withdrawalWords = withdrawalTarget.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const resolutionWords = resolutionContent.toLowerCase().split(/\s+/);
        const matchCount = withdrawalWords.filter(word => resolutionWords.some(rw => rw.includes(word))).length;
        
        // If most keywords match, consider it a match
        if (withdrawalWords.length > 0 && matchCount / withdrawalWords.length >= 0.6) {
            return true;
        }

        return false;
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

    async processWithdrawal(proposal, guild) {
        try {
            if (!proposal.targetResolution) {
                console.error('No target resolution found for withdrawal');
                return;
            }

            // Delete the original resolution message
            const resolutionsChannel = guild.channels.cache.get(proposal.targetResolution.channelId);
            if (resolutionsChannel) {
                try {
                    const targetMessage = await resolutionsChannel.messages.fetch(proposal.targetResolution.messageId);
                    await targetMessage.delete();
                    console.log(`Deleted resolution message ${proposal.targetResolution.messageId}`);
                } catch (error) {
                    console.error('Could not delete target resolution:', error);
                }
            }

            // Post withdrawal notification in resolutions channel
            const proposalTypeConfig = this.proposalConfig[proposal.proposalType];
            const resolutionsChannelId = proposalTypeConfig.resolutionsChannelId;
            const resolutionsChannelForNotification = guild.channels.cache.get(resolutionsChannelId);
            
            if (resolutionsChannelForNotification) {
                const withdrawalContent = `🗑️ **WITHDRAWN ${proposal.proposalType.toUpperCase()} RESOLUTION**

**Withdrawn by:** <@${proposal.authorId}>
**Withdrawn on:** <t:${Math.floor(Date.parse(proposal.completedAt) / 1000)}:F>
**Final Vote:** ✅ ${proposal.finalYes} - ❌ ${proposal.finalNo}

**Original Resolution (now withdrawn):**
${proposal.targetResolution.originalContent}

**Withdrawal Proposal:**
${proposal.content}

*This resolution has been officially withdrawn and is no longer active policy.*`;

                await resolutionsChannelForNotification.send(withdrawalContent);
                console.log(`Withdrawal notification posted to ${resolutionsChannelId}`);
            }
            
        } catch (error) {
            console.error('Error processing withdrawal:', error);
        }
    }
}

module.exports = WithdrawalProcessor;