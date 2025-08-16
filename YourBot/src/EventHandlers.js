const { ChannelType } = require('discord.js');
const ActionExecutor = require('./ActionExecutor');

class EventHandlers {
    constructor(bot) {
        this.bot = bot;
        this.actionExecutor = new ActionExecutor(bot);
    }

    async handleReactionAdd(reaction, user) {
        console.log(`[RAW REACTION EVENT] Reaction added: ${reaction.emoji.name} by ${user.tag} on message ${reaction.message.id}`);
        
        if (this.bot.getUserValidator().isBot(user)) {
            console.log('Ignoring bot reaction');
            return;
        }

        // Handle both existing config-based reactions and new proposal system
        await Promise.all([
            this.handleReaction(reaction, user, 'add'),
            this.handleProposalReaction(reaction, user, 'add')
        ]);
    }

    async handleReactionRemove(reaction, user) {
        console.log(`[RAW REACTION EVENT] Reaction removed: ${reaction.emoji.name} by ${user.tag} on message ${reaction.message.id}`);
        
        if (this.bot.getUserValidator().isBot(user)) {
            console.log('Ignoring bot reaction');
            return;
        }

        await Promise.all([
            this.handleReaction(reaction, user, 'remove'),
            this.handleProposalReaction(reaction, user, 'remove')
        ]);
    }

    async handleProposalReaction(reaction, user, type) {
        try {
            console.log(`handleProposalReaction: ${reaction.emoji.name} ${type} by ${user.tag} on message ${reaction.message.id}`);
            
            // Fetch partial reactions/messages
            if (reaction.partial) {
                await reaction.fetch();
            }
            if (reaction.message.partial) {
                await reaction.message.fetch();
            }

            const message = reaction.message;
            const emoji = reaction.emoji.name;

            // Check if this is in the correct guild
            if (message.guild?.id !== this.bot.getGuildId()) {
                console.log(`Wrong guild: ${message.guild?.id} vs ${this.bot.getGuildId()}`);
                return;
            }

            console.log(`Message channel: ${message.channel.id}`);
            console.log(`Debate channel: ${this.bot.getDebateChannelId()}`);
            console.log(`Vote channel: ${this.bot.getVoteChannelId()}`);

            // Handle support reactions in debate channel
            if (message.channel.id === this.bot.getDebateChannelId() && emoji === '✅') {
                console.log('Processing support reaction in debate channel');
                await this.handleSupportReaction(message);
            }
            
            // Handle voting reactions in vote channel
            else if (message.channel.id === this.bot.getVoteChannelId() && (emoji === '✅' || emoji === '❌')) {
                console.log('Processing vote reaction in vote channel');
                await this.handleVotingReaction(message, emoji, type);
            }
            
            else {
                console.log(`Reaction not in monitored channels or wrong emoji. Channel: ${message.channel.id}, Emoji: ${emoji}`);
            }

        } catch (error) {
            console.error('Error handling proposal reaction:', error);
        }
    }

    async handleSupportReaction(message) {
        try {
            console.log(`handleSupportReaction called for message ${message.id} in channel ${message.channel.id}`);
            console.log(`Expected debate channel: ${this.bot.getDebateChannelId()}`);
            
            // Get the ✅ reaction
            const supportReaction = message.reactions.cache.get('✅');
            if (!supportReaction) {
                console.log('No ✅ reaction found on message');
                return;
            }

            // Count support reactions (excluding bot's own reaction)
            const supportCount = Math.max(0, supportReaction.count - (supportReaction.me ? 1 : 0));
            
            console.log(`Support reaction count for message ${message.id}: ${supportCount} (total: ${supportReaction.count}, bot reacted: ${supportReaction.me})`);

            // Always call the proposal manager, let it decide if it should process
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
            // Fetch partial reactions/messages
            if (reaction.partial) {
                await reaction.fetch();
            }
            if (reaction.message.partial) {
                await reaction.message.fetch();
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

            // DEBUG: Check what config we have
            const currentConfig = this.bot.getConfigManager().getConfig();
            console.log(`DEBUG: Current config has ${currentConfig.length} items:`, currentConfig);

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

    async handleMessage(message) {
        console.log(`Message received: "${message.content}" in channel ${message.channel.id} by ${message.author.tag}`);
        
        if (this.bot.getUserValidator().isBot(message.author)) {
            console.log('Ignoring bot message');
            return;
        }

        // Check if message is in the command channel
        if (message.channel.id !== this.bot.getCommandChannelId()) {
            console.log(`Message not in command channel (${this.bot.getCommandChannelId()}), ignoring`);
            return;
        }

        // Check if message starts with !
        if (!message.content.startsWith('!')) {
            console.log('Message does not start with !, ignoring');
            return;
        }

        console.log(`Processing command from ${message.author.tag}: "${message.content}"`);
        await this.bot.commandHandler.handleCommand(message);
    }
}

module.exports = EventHandlers;