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

        try {
            // Process reactions through both systems simultaneously for comprehensive handling
            // Legacy reaction role system for configured messages + new proposal system
            await Promise.all([
                this.handleReaction(reaction, user, type),
                this.handleProposalReaction(reaction, user, type)
            ]);
        } catch (error) {
            console.error('Error processing reaction:', error);
        }
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

        // Restrict command processing to designated command channels or regional/local channels for !events
        const isModeratorChannel = message.channel.id === this.bot.getCommandChannelId();
        const isMemberChannel = message.channel.id === this.bot.getMemberCommandChannelId();
        const isEventsCommand = message.content.startsWith('!events');
        const isRegionalOrLocalChannel = this.isRegionalOrLocalChannel(message.channel.name);
        
        if (!isModeratorChannel && !isMemberChannel && !(isEventsCommand && isRegionalOrLocalChannel)) {
            console.log(`Message not in authorized channels for this command, ignoring`);
            return;
        }

        // Handle !events command in regional/local channels specially
        if (isEventsCommand && isRegionalOrLocalChannel) {
            console.log(`Processing !events command from ${message.author.tag} in ${message.channel.name}`);
            await this.handleEventsCommand(message);
            return;
        }

        console.log(`Processing command from ${message.author.tag}: "${message.content}" in ${isModeratorChannel ? 'moderator' : 'member'} channel`);
        await this.bot.commandHandler.handleCommand(message, isModeratorChannel);
    }

    /**
     * Check if a channel name follows regional or local naming pattern
     */
    isRegionalOrLocalChannel(channelName) {
        if (!channelName || typeof channelName !== 'string') {
            return false;
        }
        return channelName.startsWith('regional-') || channelName.startsWith('local-');
    }

    /**
     * Handle !events command in regional/local channels
     */
    async handleEventsCommand(message) {
        try {
            // Check if user has member role
            const guild = message.guild;
            const member = guild.members.cache.get(message.author.id);
            
            if (!member) {
                await message.reply('❌ Could not find your membership in this server.');
                return;
            }

            const isMember = this.bot.getUserValidator().hasRole(member, this.bot.getMemberRoleId());
            if (!isMember) {
                await message.reply('❌ You need the member role to use this command.');
                return;
            }

            // Check if user is a moderator for enhanced display
            const isModerator = this.bot.getUserValidator().canUseModerator(member, this.bot.getModeratorRoleId());

            const channelName = message.channel.name;
            let events = [];
            let areaName = '';
            let areaType = '';

            if (channelName.startsWith('regional-')) {
                // Extract region name from channel name: regional-north-east -> North East
                areaName = channelName.substring(9).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                areaType = 'regional';
                events = await this.bot.getEventManager().getUpcomingEventsByRegion(guild.id, areaName);
            } else if (channelName.startsWith('local-')) {
                // Extract location name from channel name: local-blyth-ashington-morpeth -> Blyth/Ashington/Morpeth  
                areaName = channelName.substring(6).replace(/-/g, '/').replace(/\b\w/g, l => l.toUpperCase());
                areaType = 'local';
                events = await this.bot.getEventManager().getUpcomingEventsByLocation(guild.id, areaName);
            }

            console.log(`🔍 Found ${events.length} upcoming events for ${areaType} area: ${areaName}`);

            if (events.length === 0) {
                await message.reply(`📅 **No upcoming events found for ${areaName}**\n\nCheck back later or suggest new events with \`!addevent\` in a moderator channel!`);
                return;
            }

            // Format events list
            let eventsDisplay = `📅 **Upcoming Events in ${areaName}** (Next ${events.length}):\n\n`;
            
            events.forEach((event, index) => {
                const eventDate = new Date(event.event_date);
                const formattedDate = eventDate.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const timeUntil = this.getTimeUntilEvent(eventDate);
                
                eventsDisplay += `**${index + 1}.** 🎉 **${event.name}**\n`;
                eventsDisplay += `   📅 ${formattedDate} (${timeUntil})\n`;
                eventsDisplay += `   📍 ${event.region}${event.location ? ` → ${event.location}` : ''}\n`;
                if (event.link) {
                    eventsDisplay += `   🔗 <${event.link}>\n`;
                }
                eventsDisplay += `   👤 <@${event.created_by}>\n`;
                
                // Show event ID to moderators only
                if (isModerator) {
                    eventsDisplay += `   🆔 \`${event.event_id}\`\n`;
                }
                eventsDisplay += `\n`;
            });

            eventsDisplay += `💡 **Want to add an event?** Ask a moderator to use \`!addevent\` in their bot channel!`;

            await message.reply(eventsDisplay);

        } catch (error) {
            console.error('Error handling !events command:', error);
            await message.reply('❌ An error occurred while fetching events.');
        }
    }

    /**
     * Get human-readable time until/since event
     */
    getTimeUntilEvent(eventDate) {
        const now = new Date();
        const timeDiff = eventDate.getTime() - now.getTime();
        
        if (timeDiff <= 0) {
            // Event has started - show how long ago
            const timeSinceStart = Math.abs(timeDiff);
            const hoursSince = Math.floor(timeSinceStart / (1000 * 60 * 60));
            const minutesSince = Math.floor((timeSinceStart % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hoursSince >= 1) {
                return `started ${hoursSince}h ago`;
            } else if (minutesSince >= 1) {
                return `started ${minutesSince}m ago`;
            } else {
                return 'just started';
            }
        }
        
        // Event hasn't started yet
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) return `in ${days} day${days !== 1 ? 's' : ''}`;
        if (hours > 0) return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
        return 'very soon';
    }
}

module.exports = EventHandlers;