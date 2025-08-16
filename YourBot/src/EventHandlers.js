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
        
        await this.handleReaction(reaction, user, 'add');
    }

    async handleReactionRemove(reaction, user) {
        console.log(`[RAW REACTION EVENT] Reaction removed: ${reaction.emoji.name} by ${user.tag} on message ${reaction.message.id}`);
        
        if (this.bot.getUserValidator().isBot(user)) {
            console.log('Ignoring bot reaction');
            return;
        }
        
        await this.handleReaction(reaction, user, 'remove');
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