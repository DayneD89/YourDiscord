const { ChannelType } = require('discord.js');
const ActionExecutor = require('./ActionExecutor');

// Handles Discord events and routes them to appropriate processors
// Manages both reaction role events and proposal system events
// Acts as the main entry point for all Discord interactions
class EventHandlers {
    constructor(bot) {
        this.bot = bot;
        this.actionExecutor = new ActionExecutor(bot);
    }

    async handleReactionAdd(reaction, user) {
        await this.processReaction(reaction, user, 'add');
    }

    async handleReactionRemove(reaction, user) {
        await this.processReaction(reaction, user, 'remove');
    }

    // Common reaction processing logic to avoid duplication
    async processReaction(reaction, user, type) {
        console.log(`[RAW REACTION EVENT] Reaction ${type}: ${reaction.emoji.name} by ${user.tag} on message ${reaction.message.id}`);
        
        // Ignore bot reactions to prevent infinite loops and unintended role assignments
        if (this.bot.getUserValidator().isBot(user)) {
            console.log('Ignoring bot reaction');
            return;
        }

        // Process reactions through both systems simultaneously for comprehensive handling
        // Legacy reaction role system for configured messages + new proposal system
        await Promise.all([
            this.handleReaction(reaction, user, type),
            this.handleProposalReaction(reaction, user, type)
        ]);
    }

    // Handle reactions specifically for the proposal/voting system
    // Manages support reactions in debate channels and voting reactions in vote channels
    async handleProposalReaction(reaction, user, type) {
        try {
            console.log(`handleProposalReaction: ${reaction.emoji.name} ${type} by ${user.tag} on message ${reaction.message.id}`);
            
            // Note: Partial fetching is already handled in the parallel call from processReaction
            // No need to duplicate the fetching logic here

            const message = reaction.message;
            const emoji = reaction.emoji.name;

            // Verify this reaction is in the correct Discord server
            // Prevents cross-server interference if bot serves multiple guilds
            if (message.guild?.id !== this.bot.getGuildId()) {
                console.log(`Wrong guild: ${message.guild?.id} vs ${this.bot.getGuildId()}`);
                return;
            }

            console.log(`Message channel: ${message.channel.id}`);
            
            const channelType = this.getProposalChannelType(message.channel.id);
            
            if (channelType) {
                console.log(`Message is in a monitored ${channelType} channel`);
                
                if (channelType === 'debate' && emoji === '✅') {
                    console.log('Processing support reaction in debate channel');
                    await this.handleSupportReaction(message);
                } else if (channelType === 'vote' && (emoji === '✅' || emoji === '❌')) {
                    console.log('Processing vote reaction in vote channel');
                    await this.handleVotingReaction(message, emoji, type);
                }
            } else {
                console.log(`Reaction not in monitored proposal channels. Channel: ${message.channel.id}, Emoji: ${emoji}`);
            }

        } catch (error) {
            console.error('Error handling proposal reaction:', error);
        }
    }

    // Helper method to determine what type of proposal channel this is
    getProposalChannelType(channelId) {
        const proposalConfig = this.bot.getProposalManager().proposalConfig;
        if (!proposalConfig) return null;

        for (const config of Object.values(proposalConfig)) {
            if (config.debateChannelId === channelId) return 'debate';
            if (config.voteChannelId === channelId) return 'vote';
            if (config.resolutionsChannelId === channelId) return 'resolutions';
        }
        return null;
    }

    // Process support reactions that could advance proposals to voting
    // Counts ✅ reactions and forwards to proposal manager for threshold checking
    async handleSupportReaction(message) {
        try {
            console.log(`handleSupportReaction called for message ${message.id} in channel ${message.channel.id}`);
            
            // Get the ✅ reaction object from Discord's cache
            const supportReaction = message.reactions.cache.get('✅');
            if (!supportReaction) {
                console.log('No ✅ reaction found on message');
                return;
            }

            // Calculate actual user support count by excluding the bot's own reaction
            // Bot automatically adds reactions to vote messages, so we subtract those
            const supportCount = Math.max(0, supportReaction.count - (supportReaction.me ? 1 : 0));
            
            console.log(`Support reaction count for message ${message.id}: ${supportCount} (total: ${supportReaction.count}, bot reacted: ${supportReaction.me})`);

            // Delegate to proposal manager for threshold evaluation and advancement logic
            await this.bot.getProposalManager().handleSupportReaction(message, supportCount);

        } catch (error) {
            console.error('Error handling support reaction:', error);
        }
    }

    async handleVotingReaction(message, emoji, type) {
        try {
            await this.bot.getProposalManager().handleVoteReaction(message, emoji, type === 'add');
        } catch (error) {
            console.error('Error handling voting reaction:', error);
        }
    }

    async handleReaction(reaction, user, type) {
        try {
            // Fetch partial reactions/messages in parallel for better performance
            const fetchPromises = [];
            if (reaction.partial) {
                fetchPromises.push(reaction.fetch());
            }
            if (reaction.message.partial) {
                fetchPromises.push(reaction.message.fetch());
            }
            
            if (fetchPromises.length > 0) {
                await Promise.all(fetchPromises);
            }

            const message = reaction.message;
            if (message.guild?.id !== this.bot.getGuildId()) {
                console.log(`Reaction on wrong guild: ${message.guild?.id} vs ${this.bot.getGuildId()}`);
                return;
            }

            const emoji = reaction.emoji.name;
            const messageId = message.id;
            const userId = user.id;

            console.log(`Reaction ${type}: ${emoji} on message ${messageId} by user ${userId} in guild ${message.guild.id}`);

            // Check what config we have
            const currentConfig = this.bot.getConfigManager().getConfig();

            // Find matching config
            const configItem = this.bot.getConfigManager().findConfig(messageId, emoji);
            if (!configItem) {
                console.log(`No config found for message ${messageId} with emoji ${emoji}`);
                console.log(`Available configs:`, currentConfig.map(c => `${c.from}:${c.action}`));
                return;
            }

            console.log(`Found matching config:`, configItem);

            const guild = message.guild;
            const member = await guild.members.fetch(userId);

            if (type === 'add' && configItem.to) {
                await this.actionExecutor.executeAction(configItem.to, member, guild);
            } else if (type === 'remove' && configItem.unto) {
                await this.actionExecutor.executeAction(configItem.unto, member, guild);
            }

        } catch (error) {
            console.error('Error handling reaction:', error);
        }
    }

    // Process all incoming messages for bot commands
    // Filters for command prefix and authorized channels before processing
    async handleMessage(message) {
        console.log(`Message received: "${message.content}" in channel ${message.channel.id} by ${message.author.tag}`);
        
        // Ignore messages from bots to prevent command loops and spam
        if (this.bot.getUserValidator().isBot(message.author)) {
            console.log('Ignoring bot message');
            return;
        }

        // Only process messages that start with command prefix
        // This prevents the bot from responding to normal conversation
        if (!message.content.startsWith('!')) {
            console.log('Message does not start with !, ignoring');
            return;
        }

        // Restrict command processing to designated command channels
        // This keeps bot interactions organized and prevents spam in other channels
        const isModeratorChannel = message.channel.id === this.bot.getCommandChannelId();
        const isMemberChannel = message.channel.id === this.bot.getMemberCommandChannelId();
        
        if (!isModeratorChannel && !isMemberChannel) {
            console.log(`Message not in command channels (mod: ${this.bot.getCommandChannelId()}, member: ${this.bot.getMemberCommandChannelId()}), ignoring`);
            return;
        }

        console.log(`Processing command from ${message.author.tag}: "${message.content}" in ${isModeratorChannel ? 'moderator' : 'member'} channel`);
        await this.bot.commandHandler.handleCommand(message, isModeratorChannel);
    }
}

module.exports = EventHandlers;