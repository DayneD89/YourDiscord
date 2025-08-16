const AWS = require('aws-sdk');

class ProposalManager {
    constructor(bot) {
        this.bot = bot;
        this.s3 = new AWS.S3();
        this.proposals = new Map(); // messageId -> proposal data
        this.bucketName = null;
        this.proposalsKey = null;
    }

    async initialize(bucketName, guildId) {
        this.bucketName = bucketName || process.env.S3_BUCKET || 'your-default-bucket';
        this.proposalsKey = `bot/proposals-${guildId}.json`;
        console.log(`Proposals S3 Key: ${this.proposalsKey}`);
        await this.loadProposals();
        
        // Start the voting monitor
        this.startVotingMonitor();
    }

    async loadProposals() {
        try {
            console.log('Loading proposals from S3...');
            const response = await this.s3.getObject({
                Bucket: this.bucketName,
                Key: this.proposalsKey
            }).promise();
            
            const proposalsData = JSON.parse(response.Body.toString());
            this.proposals = new Map(Object.entries(proposalsData));
            console.log(`✅ Loaded ${this.proposals.size} proposals from S3`);
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                console.log('No existing proposals found in S3');
                this.proposals = new Map();
            } else {
                console.error('Error loading proposals from S3:', error);
                this.proposals = new Map();
            }
        }
    }

    async saveProposals() {
        try {
            console.log('Saving proposals to S3...');
            const proposalsData = Object.fromEntries(this.proposals);
            
            await this.s3.putObject({
                Bucket: this.bucketName,
                Key: this.proposalsKey,
                Body: JSON.stringify(proposalsData, null, 2),
                ContentType: 'application/json',
                Metadata: {
                    'last-updated': new Date().toISOString()
                }
            }).promise();
            
            console.log(`Proposals saved to S3: ${this.proposals.size} items`);
        } catch (error) {
            console.error('Error saving proposals to S3:', error);
            throw error;
        }
    }

    isValidProposalFormat(content) {
        // Check if message starts with proposal format
        const proposalRegex = /^\*\*(?:Policy|Server Change|Member Policy)\*\*:/i;
        return proposalRegex.test(content.trim());
    }

    async handleSupportReaction(message, reactionCount) {
        const messageId = message.id;
        
        // Check if this is already being tracked
        if (this.proposals.has(messageId)) {
            console.log(`Message ${messageId} already being tracked`);
            return;
        }

        // Validate proposal format
        if (!this.isValidProposalFormat(message.content)) {
            console.log(`Message ${messageId} is not in valid proposal format`);
            return;
        }

        // Check if we have 5 support reactions
        if (reactionCount >= 5) {
            console.log(`✅ Proposal ${messageId} has reached 5 support reactions, moving to vote`);
            await this.moveToVote(message);
        }
    }

    async moveToVote(originalMessage) {
        try {
            const guild = originalMessage.guild;
            const voteChannelId = this.bot.getVoteChannelId();
            const voteChannel = guild.channels.cache.get(voteChannelId);
            
            if (!voteChannel) {
                console.error(`Vote channel ${voteChannelId} not found`);
                return;
            }

            // Create vote message
            const voteContent = this.createVoteMessage(originalMessage);
            const voteMessage = await voteChannel.send(voteContent);

            // Add voting reactions
            await voteMessage.react('✅'); // Yes
            await voteMessage.react('❌'); // No

            // Store proposal data
            const proposalData = {
                originalMessageId: originalMessage.id,
                originalChannelId: originalMessage.channel.id,
                voteMessageId: voteMessage.id,
                voteChannelId: voteChannel.id,
                authorId: originalMessage.author.id,
                content: originalMessage.content,
                status: 'voting',
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                yesVotes: 0,
                noVotes: 0
            };

            this.proposals.set(voteMessage.id, proposalData);
            await this.saveProposals();

            // Edit original message to indicate it's moved to vote
            try {
                await originalMessage.edit(`${originalMessage.content}\n\n🗳️ **This proposal has been moved to voting in <#${voteChannelId}>**`);
            } catch (error) {
                console.error('Could not edit original message:', error);
            }

            console.log(`Proposal moved to vote: ${voteMessage.id}`);
        } catch (error) {
            console.error('Error moving proposal to vote:', error);
        }
    }

    createVoteMessage(originalMessage) {
        const author = originalMessage.author;
        const proposalContent = originalMessage.content;
        
        return `🗳️ **VOTING PHASE** - 7 Days Remaining

**Proposed by:** ${author.tag}
**Original Proposal:**
${proposalContent}

**Instructions:**
✅ React with ✅ to SUPPORT this proposal
❌ React with ❌ to OPPOSE this proposal

**Voting ends:** <t:${Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000)}:F>

React below to cast your vote!`;
    }

    async handleVoteReaction(message, emoji, isAdd) {
        const messageId = message.id;
        const proposal = this.proposals.get(messageId);
        
        if (!proposal || proposal.status !== 'voting') {
            return;
        }

        // Check if voting period has ended
        if (new Date() > new Date(proposal.endTime)) {
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
            
            proposal.yesVotes = yesCount;
            proposal.noVotes = noCount;
            
            await this.saveProposals();
            
            console.log(`Vote counts updated for ${message.id}: Yes=${yesCount}, No=${noCount}`);
        } catch (error) {
            console.error('Error updating vote counts:', error);
        }
    }

    startVotingMonitor() {
        // Check for ended votes every hour
        setInterval(async () => {
            await this.checkEndedVotes();
        }, 60 * 60 * 1000); // 1 hour

        // Also check on startup
        setTimeout(() => this.checkEndedVotes(), 5000);
    }

    async checkEndedVotes() {
        const now = new Date();
        console.log('🔍 Checking for ended votes...');
        
        for (const [messageId, proposal] of this.proposals) {
            if (proposal.status === 'voting' && now > new Date(proposal.endTime)) {
                console.log(`⏰ Processing ended vote: ${messageId}`);
                await this.processEndedVote(messageId, proposal);
            }
        }
    }

    async processEndedVote(messageId, proposal) {
        try {
            const guild = this.bot.client.guilds.cache.get(this.bot.getGuildId());
            const voteChannel = guild.channels.cache.get(proposal.voteChannelId);
            const voteMessage = await voteChannel.messages.fetch(messageId);
            
            // Update final vote counts
            await this.updateVoteCounts(voteMessage, proposal);
            
            const passed = proposal.yesVotes > proposal.noVotes;
            proposal.status = passed ? 'passed' : 'failed';
            proposal.finalYes = proposal.yesVotes;
            proposal.finalNo = proposal.noVotes;
            proposal.completedAt = new Date().toISOString();
            
            // Update vote message to show results
            const resultEmoji = passed ? '✅' : '❌';
            const resultText = passed ? 'PASSED' : 'FAILED';
            
            const updatedContent = `${voteMessage.content}

**VOTING COMPLETED**
${resultEmoji} **${resultText}**
✅ Support: ${proposal.finalYes}
❌ Oppose: ${proposal.finalNo}

${passed ? '📋 This proposal has been moved to resolutions.' : ''}`;

            await voteMessage.edit(updatedContent);
            
            // If passed, move to resolutions channel
            if (passed) {
                await this.moveToResolutions(proposal, guild);
            }
            
            await this.saveProposals();
            console.log(`✅ Processed ended vote ${messageId}: ${resultText}`);
            
        } catch (error) {
            console.error(`Error processing ended vote ${messageId}:`, error);
        }
    }

    async moveToResolutions(proposal, guild) {
        try {
            const resolutionsChannelId = this.bot.getResolutionsChannelId();
            const resolutionsChannel = guild.channels.cache.get(resolutionsChannelId);
            
            if (!resolutionsChannel) {
                console.error(`Resolutions channel ${resolutionsChannelId} not found`);
                return;
            }

            const resolutionContent = `📋 **PASSED RESOLUTION**

**Proposed by:** <@${proposal.authorId}>
**Passed on:** <t:${Math.floor(Date.parse(proposal.completedAt) / 1000)}:F>
**Final Vote:** ✅ ${proposal.finalYes} - ❌ ${proposal.finalNo}

**Resolution:**
${proposal.content}

*This resolution is now active policy.*`;

            await resolutionsChannel.send(resolutionContent);
            console.log(`Resolution moved to ${resolutionsChannelId}`);
            
        } catch (error) {
            console.error('Error moving to resolutions:', error);
        }
    }

    getProposal(messageId) {
        return this.proposals.get(messageId);
    }

    getAllProposals() {
        return Array.from(this.proposals.values());
    }

    getActiveVotes() {
        return Array.from(this.proposals.values()).filter(p => p.status === 'voting');
    }
}

module.exports = ProposalManager;