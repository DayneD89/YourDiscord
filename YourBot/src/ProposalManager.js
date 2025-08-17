const DynamoProposalStorage = require('./DynamoProposalStorage');
const ProposalParser = require('./ProposalParser');
const WithdrawalProcessor = require('./WithdrawalProcessor');
const ModeratorProcessor = require('./ModeratorProcessor');

// Manages the democratic proposal and voting system
// Coordinates proposal parsing, storage, voting, and resolution processing
// Enables community self-governance through structured proposals and voting
class ProposalManager {
    constructor(bot) {
        this.bot = bot;
        this.proposalConfig = null;                 // Configuration for different proposal types
        this.storage = new DynamoProposalStorage(); // DynamoDB-backed persistent storage
        this.parser = null;                         // Proposal format parser
        this.withdrawalProcessor = null;            // Handles proposal withdrawals
        this.moderatorProcessor = null;             // Handles moderator role changes
    }

    async initialize(tableName, guildId, proposalConfig) {
        // Setup proposal system with configuration for different proposal types
        // Each type has its own channels, thresholds, and voting duration
        this.proposalConfig = proposalConfig;
        this.parser = new ProposalParser(proposalConfig);
        this.withdrawalProcessor = new WithdrawalProcessor(this.bot, proposalConfig);
        this.moderatorProcessor = new ModeratorProcessor(this.bot, proposalConfig);
        
        console.log(`Proposal config loaded:`, JSON.stringify(proposalConfig, null, 2));
        
        // Initialize DynamoDB storage for proposal tracking
        await this.storage.initialize(tableName, guildId);
        
        // Start background monitoring for vote completion
        this.startVotingMonitor();
    }

    // Process support reactions to determine if proposals should advance to voting
    // Tracks reaction thresholds and automatically moves proposals when requirements are met
    async handleSupportReaction(message, reactionCount) {
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

    // Start background monitoring for vote completion
    // Ensures votes are processed promptly when their time expires
    startVotingMonitor() {
        // Regular interval checking for ended votes
        // More frequent checking ensures timely vote resolution
        setInterval(async () => {
            await this.checkEndedVotes();
        }, 60 * 1000);

        // Initial check on startup to process any votes that ended while bot was offline
        setTimeout(() => this.checkEndedVotes(), 5000);
    }

    // Check all active votes for expiration and process completed ones
    // Critical for maintaining democratic process integrity and timely results
    async checkEndedVotes() {
        const now = new Date();
        console.log('Checking for ended votes...');
        
        // Get all currently active votes and check their end times
        const activeVotes = await this.storage.getActiveVotes();
        for (const proposal of activeVotes) {
            if (now > new Date(proposal.end_time)) {
                console.log(`Processing ended vote: ${proposal.message_id} (${proposal.proposal_type})`);
                await this.processEndedVote(proposal.message_id, proposal);
            }
        }
    }

    async processEndedVote(messageId, proposal) {
        try {
            const guild = this.bot.client.guilds.cache.get(this.bot.getGuildId());
            const voteChannel = guild.channels.cache.get(proposal.vote_channel_id);
            const voteMessage = await voteChannel.messages.fetch(messageId);
            
            // Update final vote counts
            await this.updateVoteCounts(voteMessage, proposal);
            
            // Get updated proposal data
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

            await voteMessage.edit(updatedContent);
            
            // Handle passed proposals
            if (passed) {
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

    getActiveVotes() {
        return this.storage.getActiveVotes();
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
                            
                            // Only include proposals with at least 1 support reaction
                            if (supportCount > 0) {
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
}

module.exports = ProposalManager;