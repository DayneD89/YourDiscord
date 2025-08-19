const DynamoProposalStorage = require('../storage/DynamoProposalStorage');
const ProposalParser = require('../processors/ProposalParser');
const WithdrawalProcessor = require('../processors/WithdrawalProcessor');
const ModeratorProcessor = require('../processors/ModeratorProcessor');

/**
 * ProposalManager - Democratic governance system coordinator
 * 
 * Orchestrates a comprehensive proposal and voting system that enables community self-governance.
 * Manages the complete lifecycle from proposal creation through voting to resolution.
 * 
 * System architecture rationale:
 * - Multi-stage process (debate → vote → resolution) ensures thorough consideration
 * - Support thresholds prevent spam while enabling legitimate proposals
 * - Automated voting monitors ensure timely resolution
 * - Type-specific configuration allows different governance rules for different proposal types
 * 
 * Supported proposal types:
 * - Policy: Community rules and guidelines
 * - Moderator: Staff role assignments/removals
 * - Governance: Changes to the governance system itself
 * - Withdrawal: Removal of previously passed proposals
 */
class ProposalManager {
    constructor(bot) {
        this.bot = bot;
        this.proposalConfig = null;                 // Configuration for different proposal types
        this.storage = new DynamoProposalStorage(); // DynamoDB-backed persistent storage
        this.parser = null;                         // Proposal format parser
        this.withdrawalProcessor = null;            // Handles proposal withdrawals
        this.moderatorProcessor = null;             // Handles moderator role changes
        
        // Timer references for cleanup
        this.votingMonitorTimer = null;
        this.initialVoteCheckTimer = null;
    }

    /**
     * Initialize the proposal system with runtime configuration
     * 
     * Sets up the complete governance infrastructure including storage, processors,
     * and automated monitoring systems.
     * 
     * @param {string} tableName - DynamoDB table for proposal storage
     * @param {string} guildId - Discord guild ID for data isolation
     * @param {Object} proposalConfig - Configuration for different proposal types
     */
    async initialize(tableName, guildId, proposalConfig) {
        // Configure proposal types with their specific governance rules
        // Different types enable different governance workflows and requirements
        this.proposalConfig = proposalConfig;
        this.parser = new ProposalParser(proposalConfig);
        this.withdrawalProcessor = new WithdrawalProcessor(this.bot, proposalConfig);
        this.moderatorProcessor = new ModeratorProcessor(this.bot, proposalConfig);
        
        console.log(`Proposal config loaded:`, JSON.stringify(proposalConfig, null, 2));
        
        // Initialize DynamoDB storage for proposal tracking
        await this.storage.initialize(tableName, guildId);
        
        // Start background monitoring for vote completion - skip only during Jest testing
        if (!process.env.JEST_WORKER_ID) {
            this.startVotingMonitor();
        }
    }

    // Process support reactions to determine if proposals should advance to voting
    // Tracks reaction thresholds and automatically moves proposals when requirements are met
    async handleSupportReaction(message, reactionCount) {
        try {
            const messageId = message.id;
            const channelId = message.channel.id;
            
            console.log(`handleSupportReaction called for message ${messageId} with ${reactionCount} reactions`);
            console.log(`Message content: "${message.content.substring(0, 100)}..."`);
            console.log(`Message channel: ${channelId}`);
            
            // Avoid processing proposals that are already in the system
            // Prevents duplicate tracking and processing conflicts
            const existingProposal = await this.storage.getProposal(messageId);
            if (existingProposal) {
                console.log(`Message ${messageId} already being tracked`);
                return;
            }

            // Parse proposal to determine type and requirements
            // Different proposal types have different channels and thresholds
            const proposalMatch = this.parser.getProposalType(channelId, message.content);
            if (!proposalMatch) {
                console.log(`Message ${messageId} is not a valid proposal for this channel`);
                return;
            }

            const { type, config, isWithdrawal } = proposalMatch;
            const requiredReactions = config.supportThreshold;

            // Advance proposal to voting phase when threshold is met
            // This automates the democratic process without manual intervention
            if (reactionCount >= requiredReactions) {
                console.log(`${type} ${isWithdrawal ? 'withdrawal ' : ''}proposal ${messageId} has reached ${reactionCount}/${requiredReactions} support reactions, moving to vote`);
                await this.moveToVote(message, type, config, isWithdrawal);
            } else {
                console.log(`${type} ${isWithdrawal ? 'withdrawal ' : ''}proposal ${messageId} has ${reactionCount}/${requiredReactions} reactions`);
            }
        } catch (error) {
            console.error('Error handling support reaction:', error);
        }
    }

    async moveToVote(originalMessage, proposalType, config, isWithdrawal = false) {
        try {
            const guild = originalMessage.guild;
            const voteChannelId = config.voteChannelId;
            const voteChannel = guild.channels.cache.get(voteChannelId);
            
            if (!voteChannel) {
                console.error(`Vote channel ${voteChannelId} not found for ${proposalType}`);
                return;
            }

            // If this is a withdrawal, try to parse the target resolution
            let targetResolution = null;
            if (isWithdrawal) {
                targetResolution = await this.withdrawalProcessor.parseWithdrawalTarget(originalMessage.content, proposalType, config);
                if (!targetResolution) {
                    console.error(`Could not find target resolution for withdrawal: ${originalMessage.content}`);
                    await originalMessage.reply('Could not find the target resolution to withdraw. Please ensure you have referenced a valid resolution.');
                    return;
                }
            }

            // Create vote message
            const voteContent = this.parser.createVoteMessage(originalMessage, proposalType, config, isWithdrawal);
            const voteMessage = await voteChannel.send(voteContent);

            // Add voting reactions
            await voteMessage.react('✅');
            await voteMessage.react('❌');

            // Store proposal data
            const proposalData = {
                original_message_id: originalMessage.id,
                original_channel_id: originalMessage.channel.id,
                vote_message_id: voteMessage.id,
                vote_channel_id: voteChannel.id,
                author_id: originalMessage.author.id,
                content: originalMessage.content,
                proposal_type: proposalType,
                is_withdrawal: isWithdrawal,
                target_resolution: targetResolution,
                status: 'voting',
                start_time: new Date().toISOString(),
                end_time: new Date(Date.now() + config.voteDuration).toISOString(),
                yes_votes: 0,
                no_votes: 0
            };

            await this.storage.addProposal(voteMessage.id, proposalData);

            // Reschedule vote checks since we added a new vote
            this.rescheduleVoteChecks();

            // Edit original message to indicate it's moved to vote
            try {
                const withdrawalText = isWithdrawal ? 'withdrawal ' : '';
                await originalMessage.edit(`${originalMessage.content}\n\n**This ${withdrawalText}proposal has been moved to voting in <#${voteChannelId}>**`);
            } catch (error) {
                console.error('Could not edit original message:', error);
            }

            console.log(`${proposalType} ${isWithdrawal ? 'withdrawal ' : ''}proposal moved to vote: ${voteMessage.id}`);
        } catch (error) {
            console.error('Error moving proposal to vote:', error);
        }
    }

    async handleVoteReaction(message, emoji, isAdd) {
        const messageId = message.id;
        const proposal = await this.storage.getProposal(messageId);
        
        if (!proposal || proposal.status !== 'voting') {
            return;
        }

        // Check if voting period has ended
        if (new Date() > new Date(proposal.end_time)) {
            console.log(`Voting has ended for proposal ${messageId}`);
            return;
        }

        // Update vote counts
        await this.updateVoteCounts(message, proposal);
    }

    async updateVoteCounts(message, proposal) {
        try {
            const yesReaction = message.reactions.cache.get('✅');
            const noReaction = message.reactions.cache.get('❌');
            
            // Count reactions (subtract 1 for bot's own reaction)
            const yesCount = yesReaction ? Math.max(0, yesReaction.count - 1) : 0;
            const noCount = noReaction ? Math.max(0, noReaction.count - 1) : 0;
            
            await this.storage.updateProposal(message.id, {
                yes_votes: yesCount,
                no_votes: noCount
            });
            
            console.log(`Vote counts updated for ${message.id}: Yes=${yesCount}, No=${noCount}`);
        } catch (error) {
            console.error('Error updating vote counts:', error);
        }
    }

    // Start dynamic vote monitoring system
    // Schedules vote end processing at exact times instead of constant polling
    startVotingMonitor() {
        console.log('Starting dynamic vote monitoring system...');
        
        // Initial check on startup to process any votes that ended while bot was offline
        this.initialVoteCheckTimer = setTimeout(() => {
            this.scheduleNextVoteCheck();
        }, 5000);

        console.log('Dynamic vote monitoring system started');
    }

    /**
     * Schedule the next vote check based on actual vote end times
     */
    async scheduleNextVoteCheck() {
        try {
            const activeVotes = await this.storage.getActiveVotes();

            if (activeVotes.length === 0) {
                console.log('🗳️ No active votes - scheduling check in 1 hour');
                this.nextVoteCheckTimeout = setTimeout(() => this.scheduleNextVoteCheck(), 60 * 60 * 1000);
                return;
            }

            const now = new Date();
            let nextVoteEndTime = null;
            let targetVote = null;

            // Find the next vote that will end or has already ended
            for (const vote of activeVotes) {
                const voteEndTime = new Date(vote.end_time);

                if (voteEndTime <= now) {
                    // Vote has already ended - process immediately
                    nextVoteEndTime = now;
                    targetVote = vote;
                    break;
                } else if (!nextVoteEndTime || voteEndTime < nextVoteEndTime) {
                    // Vote will end in the future - track earliest
                    nextVoteEndTime = voteEndTime;
                    targetVote = vote;
                }
            }

            if (nextVoteEndTime && targetVote) {
                const msUntilVoteEnd = Math.max(0, nextVoteEndTime.getTime() - Date.now());
                
                if (msUntilVoteEnd === 0) {
                    // Process ended vote now and reschedule
                    console.log(`🗳️ Processing ended vote immediately: ${targetVote.message_id}`);
                    await this.checkEndedVotes();
                    this.scheduleNextVoteCheck(); // Reschedule immediately
                } else {
                    // Schedule vote processing for exact end time
                    console.log(`🗳️ Next vote ends in ${Math.round(msUntilVoteEnd/1000)}s for: ${targetVote.message_id}`);
                    this.nextVoteCheckTimeout = setTimeout(() => {
                        this.checkEndedVotes().then(() => {
                            this.scheduleNextVoteCheck(); // Reschedule after processing
                        });
                    }, msUntilVoteEnd);
                }
            } else {
                // No active votes, check again in 1 hour
                console.log('🗳️ No upcoming vote ends - checking again in 1 hour');
                this.nextVoteCheckTimeout = setTimeout(() => this.scheduleNextVoteCheck(), 60 * 60 * 1000);
            }

        } catch (error) {
            console.error('Error scheduling next vote check:', error);
            // Fallback to checking again in 5 minutes
            this.nextVoteCheckTimeout = setTimeout(() => this.scheduleNextVoteCheck(), 5 * 60 * 1000);
        }
    }

    /**
     * Reschedule vote checks after new votes are created
     */
    rescheduleVoteChecks() {
        // Cancel current schedule and recalculate
        if (this.nextVoteCheckTimeout) {
            clearTimeout(this.nextVoteCheckTimeout);
            this.nextVoteCheckTimeout = null;
        }
        
        // Schedule immediately
        setImmediate(() => this.scheduleNextVoteCheck());
    }

    /**
     * Cleanup timers - call this during shutdown or in tests
     */
    cleanup() {
        if (this.nextVoteCheckTimeout) {
            clearTimeout(this.nextVoteCheckTimeout);
            this.nextVoteCheckTimeout = null;
        }
        if (this.initialVoteCheckTimer) {
            clearTimeout(this.initialVoteCheckTimer);
            this.initialVoteCheckTimer = null;
        }
        console.log('ProposalManager timers cleaned up');
    }

    // Check all active votes for expiration and process completed ones
    // Critical for maintaining democratic process integrity and timely results
    async checkEndedVotes() {
        try {
            const now = new Date();
            
            // Get all currently active votes and check their end times
            const activeVotes = await this.storage.getActiveVotes();
            
            // Filter ended votes first
            const endedVotes = activeVotes.filter(proposal => now > new Date(proposal.end_time));
            
            if (endedVotes.length === 0) {
                return;
            }
            
            console.log(`Found ${endedVotes.length} ended votes to process`);
            
            // Process all ended votes in parallel for better performance
            // Each vote processing is independent and can be done concurrently
            const results = await Promise.allSettled(
                endedVotes.map(proposal => {
                    console.log(`Processing ended vote: ${proposal.message_id} (${proposal.proposal_type})`);
                    return this.processEndedVote(proposal.message_id, proposal);
                })
            );
            
            // Log any failures for monitoring
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Failed to process ended vote ${endedVotes[index].message_id}:`, result.reason);
                }
            });
        } catch (error) {
            console.error('Error checking ended votes:', error);
        }
    }

    async processEndedVote(messageId, proposal) {
        try {
            const guild = this.bot.client.guilds.cache.get(this.bot.getGuildId());
            const voteChannel = guild.channels.cache.get(proposal.vote_channel_id);
            const voteMessage = await voteChannel.messages.fetch(messageId);
            
            // Update final vote counts and get updated proposal data
            // These operations can be optimized by combining the update and retrieval
            await this.updateVoteCounts(voteMessage, proposal);
            const updatedProposal = await this.storage.getProposal(messageId);
            const passed = updatedProposal.yes_votes > updatedProposal.no_votes;
            
            await this.storage.updateProposal(messageId, {
                status: passed ? 'passed' : 'failed',
                final_yes: updatedProposal.yes_votes,
                final_no: updatedProposal.no_votes,
                completed_at: new Date().toISOString()
            });
            
            // Update vote message to show results
            const resultEmoji = passed ? '✅' : '❌';
            const resultText = passed ? 'PASSED' : 'FAILED';
            const withdrawalText = updatedProposal.is_withdrawal ? 'withdrawal ' : '';
            
            const updatedContent = `${voteMessage.content}

**VOTING COMPLETED**
${resultEmoji} **${resultText}**
✅ Support: ${updatedProposal.yes_votes}
❌ Oppose: ${updatedProposal.no_votes}

${passed ? 
    (updatedProposal.is_withdrawal ? 
        'The target resolution has been withdrawn.' : 
        'This proposal has been moved to resolutions.') : 
    ''}`;

            // Update vote message and get final proposal data in parallel if needed
            const messageUpdatePromise = voteMessage.edit(updatedContent);
            
            // Handle passed proposals
            if (passed) {
                // Wait for message update to complete, then process the passed proposal
                await messageUpdatePromise;
                const finalProposal = await this.storage.getProposal(messageId);
                if (finalProposal.is_withdrawal) {
                    await this.withdrawalProcessor.processWithdrawal(finalProposal, guild);
                } else if (finalProposal.proposal_type === 'moderator') {
                    // Process moderator role changes directly
                    const success = await this.moderatorProcessor.processModeratorAction(finalProposal, guild);
                    if (success) {
                        console.log(`✅ Moderator action processed successfully for ${messageId}`);
                    } else {
                        console.error(`❌ Failed to process moderator action for ${messageId}`);
                    }
                } else {
                    await this.moveToResolutions(finalProposal, guild);
                }
            } else {
                // For failed proposals, just wait for the message update to complete
                await messageUpdatePromise;
            }
            
            console.log(`Processed ended ${withdrawalText}vote ${messageId}: ${resultText}`);
            
        } catch (error) {
            console.error(`Error processing ended vote ${messageId}:`, error);
        }
    }

    // Move passed proposals to their resolutions channel as official policy
    // Creates permanent record of community decisions for reference and enforcement
    async moveToResolutions(proposal, guild) {
        try {
            // Find the appropriate resolutions channel for this proposal type
            // Different types may have different resolution channels for organization
            const proposalTypeConfig = this.proposalConfig[proposal.proposal_type];
            const resolutionsChannelId = proposalTypeConfig.resolutionsChannelId;
            const resolutionsChannel = guild.channels.cache.get(resolutionsChannelId);
            
            if (!resolutionsChannel) {
                console.error(`Resolutions channel ${resolutionsChannelId} not found for ${proposal.proposal_type}`);
                return;
            }

            const resolutionContent = `**PASSED ${proposal.proposal_type.toUpperCase()} RESOLUTION**

**Proposed by:** <@${proposal.author_id}>
**Type:** ${proposal.proposal_type}
**Passed on:** <t:${Math.floor(Date.parse(proposal.completed_at) / 1000)}:F>
**Final Vote:** ✅ ${proposal.final_yes} - ❌ ${proposal.final_no}

**Resolution:**
${proposal.content}

*This resolution is now active ${proposal.proposal_type} policy.*`;

            await resolutionsChannel.send(resolutionContent);
            console.log(`${proposal.proposal_type} resolution moved to ${resolutionsChannelId}`);
            
        } catch (error) {
            console.error('Error moving to resolutions:', error);
        }
    }

    // Delegate methods to storage
    getProposal(messageId) {
        return this.storage.getProposal(messageId);
    }

    getAllProposals() {
        return this.storage.getAllProposals();
    }

    async getActiveVotes() {
        try {
            return await this.storage.getActiveVotes();
        } catch (error) {
            console.error('Error getting active votes:', error);
            return [];
        }
    }

    getProposalsByType(type) {
        return this.storage.getProposalsByType(type);
    }

    // Find pending proposals (messages with support reactions but not yet in voting)
    // Scans debate channels for valid proposals that haven't reached vote threshold
    async getPendingProposals() {
        try {
            const guild = this.bot.client.guilds.cache.get(this.bot.getGuildId());
            if (!guild) {
                console.error('Guild not found for pending proposals search');
                return [];
            }

            const pendingProposals = [];

            // Check each proposal type's debate channel
            for (const [type, config] of Object.entries(this.proposalConfig)) {
                const channel = guild.channels.cache.get(config.debateChannelId);
                if (!channel) {
                    console.log(`Debate channel ${config.debateChannelId} not found for ${type}`);
                    continue;
                }

                try {
                    // Fetch recent messages from the debate channel
                    const messages = await channel.messages.fetch({ limit: 50 });
                    
                    for (const [messageId, message] of messages) {
                        // Skip if message is already tracked in DynamoDB (already voting/completed)
                        const existingProposal = await this.storage.getProposal(messageId);
                        if (existingProposal) {
                            continue;
                        }

                        // Check if message is a valid proposal format
                        const proposalMatch = this.parser.getProposalType(channel.id, message.content);
                        if (!proposalMatch) {
                            continue;
                        }

                        // Count support reactions (✅)
                        const supportReaction = message.reactions.cache.get('✅');
                        if (supportReaction) {
                            const supportCount = Math.max(0, supportReaction.count - (supportReaction.me ? 1 : 0));
                            
                            // Only include proposals with support reactions that haven't reached threshold yet
                            if (supportCount > 0 && supportCount < proposalMatch.config.supportThreshold) {
                                pendingProposals.push({
                                    messageId: messageId,
                                    channelId: channel.id,
                                    content: message.content,
                                    author: message.author,
                                    createdAt: message.createdAt,
                                    supportCount: supportCount,
                                    requiredSupport: proposalMatch.config.supportThreshold,
                                    proposalType: proposalMatch.type,
                                    isWithdrawal: proposalMatch.isWithdrawal
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error scanning channel ${config.debateChannelId} for pending proposals:`, error);
                }
            }

            // Sort by support count (descending) to show most supported first
            pendingProposals.sort((a, b) => b.supportCount - a.supportCount);
            
            console.log(`Found ${pendingProposals.length} pending proposals`);
            return pendingProposals;

        } catch (error) {
            console.error('Error getting pending proposals:', error);
            return [];
        }
    }

    startVotingMonitor() {
        // Check for ended votes every minute
        this.votingMonitorInterval = setInterval(() => {
            this.checkEndedVotes();
        }, 60000); // 1 minute
        console.log('Voting monitor started');
    }

    stopVotingMonitor() {
        if (this.votingMonitorInterval) {
            clearInterval(this.votingMonitorInterval);
            this.votingMonitorInterval = null;
            console.log('Voting monitor stopped');
        }
    }
}

module.exports = ProposalManager;