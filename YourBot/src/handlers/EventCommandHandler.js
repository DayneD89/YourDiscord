/**
 * EventCommandHandler - Handles all event-related Discord commands
 * 
 * Manages the community event system including creation, deletion, listing, and bulk operations.
 * Integrates with the EventManager for business logic and provides user-friendly Discord interfaces.
 * 
 * Design rationale:
 * - Unified interface: Both members and moderators can use most event commands to encourage participation
 * - Permission layers: Destructive operations (remove, clear) require moderator privileges
 * - Rich formatting: Event listings and responses use Discord embeds and formatting for better UX
 * - Input validation: All user inputs are validated before processing to prevent errors and abuse
 * - Notification integration: Events automatically notify relevant regional/location channels
 */
class EventCommandHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async handleModeratorCommand(message, member, content) {
        if (content.startsWith('!addevent ')) {
            await this.handleAddEvent(message, content.substring(10));
        } else if (content.startsWith('!removeevent ')) {
            await this.handleRemoveEvent(message, content.substring(13));
        } else if (content === '!events') {
            await this.handleListEvents(message);
        } else if (content.startsWith('!events ')) {
            await this.handleListEventsByLocation(message, content.substring(8));
        } else if (content === '!clearevents') {
            await this.handleClearEvents(message);
        }
    }

    async handleMemberCommand(message, member, content) {
        if (content.startsWith('!addevent ')) {
            await this.handleAddEvent(message, content.substring(10));
        } else if (content.startsWith('!removeevent ')) {
            await this.handleRemoveEvent(message, content.substring(13));
        } else if (content === '!events') {
            await this.handleListEvents(message);
        } else if (content.startsWith('!events ')) {
            await this.handleListEventsByLocation(message, content.substring(8));
        } else if (content === '!clearevents') {
            await this.handleClearEvents(message);
        }
    }

    async handleAddEvent(message, eventArgs) {
        try {
            // Parse command arguments: !addevent @RegionRole @LocationRole <name> | <date> | <link>
            // Format: !addevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00 | https://example.com/event
            
            if (!eventArgs.trim()) {
                await message.reply('❌ **Event command format:**\n`!addevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM | <link>`\n\n**Examples:**\n`!addevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00 | https://facebook.com/events/123`\n`!addevent @Wales @Cardiff "Rally" | 2024-08-30 14:00 | https://eventbrite.com/tickets/456`\n\n**Notes:**\n- Use @LocationRole for town/city, or omit if region-wide\n- Link is optional but recommended\n- Roles must exist in the server');
                return;
            }

            // Split by pipes to get main parts
            const parts = eventArgs.split('|').map(part => part.trim());
            if (parts.length < 2) {
                await message.reply('❌ **Invalid format.** Use: `!addevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM | <link>`');
                return;
            }

            const eventDetailsStr = parts[0];
            const dateStr = parts[1];
            const eventLink = parts[2] || '';

            // Parse role mentions and event name
            const roleMentions = eventDetailsStr.match(/<@&(\d+)>/g) || [];
            if (roleMentions.length === 0) {
                await message.reply('❌ **Missing role mentions.** You must mention at least one region role.\n\n**Format:** `@RegionRole @LocationRole "Event Name"`\n**Example:** `@London @CentralLondon "Community Meeting"`');
                return;
            }

            // Extract event name (everything after the last role mention)
            const nameMatch = eventDetailsStr.match(/.*>[\s]*(.+)$/);
            if (!nameMatch) {
                await message.reply('❌ **Missing event name.** Add the event name after the role mentions.\n\n**Example:** `@London @CentralLondon "Community Meeting"`');
                return;
            }

            const eventName = nameMatch[1].replace(/^["']|["']$/g, '').trim();
            if (!eventName) {
                await message.reply('❌ **Event name cannot be empty.**');
                return;
            }

            // Validate and resolve roles
            const guild = message.guild;
            const mentionedRoles = roleMentions.map(mention => {
                const roleId = mention.match(/<@&(\d+)>/)[1];
                return guild.roles.cache.get(roleId);
            }).filter(role => role !== undefined);

            if (mentionedRoles.length !== roleMentions.length) {
                await message.reply('❌ **Some mentioned roles do not exist in this server.** Please use valid role mentions.');
                return;
            }

            // Determine region and location from roles
            // First role is treated as region, second (if exists) as location
            const regionRole = mentionedRoles[0];
            const locationRole = mentionedRoles.length > 1 ? mentionedRoles[1] : null;

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/;
            if (!dateRegex.test(dateStr)) {
                await message.reply('❌ **Invalid date format.** Use: `YYYY-MM-DD HH:MM`\n\n**Example:** `2024-08-25 18:00`');
                return;
            }

            // Validate link if provided
            if (eventLink && !this.isValidUrl(eventLink)) {
                await message.reply('❌ **Invalid link format.** Please provide a valid URL starting with http:// or https://\n\n**Example:** `https://facebook.com/events/123456`');
                return;
            }

            // Create event object
            const eventData = {
                name: eventName,
                region: regionRole.name,
                location: locationRole ? locationRole.name : null,
                eventDate: dateStr.trim(),
                link: eventLink || null
            };

            // Create event using EventManager with role objects
            const eventManager = this.bot.getEventManager();
            const event = await eventManager.createEvent(message.guild.id, eventData, message.author, regionRole, locationRole);

            await message.reply(`✅ **Event created successfully!**\n\n**${event.name}**\n📅 **Date:** ${dateStr}\n📍 **Region:** ${regionRole} ${locationRole ? `\n🏘️ **Location:** ${locationRole}` : ''}${event.link ? `\n🔗 **Link:** <${event.link}>` : ''}\n\n🎉 Notifications have been sent to the appropriate channels!\n\n💡 **To remove this event later:** \`!removeevent ${regionRole} ${locationRole ? `${locationRole} ` : ''}"${event.name}" | ${dateStr}\``);

        } catch (error) {
            console.error('Error handling add event command:', error);
            
            // Provide specific error messages for common issues
            if (error.message.includes('Region role')) {
                await message.reply(`❌ **Region validation error:** ${error.message}`);
            } else if (error.message.includes('Location role')) {
                await message.reply(`❌ **Location validation error:** ${error.message}`);
            } else if (error.message.includes('date')) {
                await message.reply('❌ **Date error.** Make sure the date is in the future and uses format `YYYY-MM-DD HH:MM`');
            } else {
                await message.reply('❌ An error occurred while creating the event. Please check the command format and try again.');
            }
        }
    }

    async handleRemoveEvent(message, eventArgs) {
        try {
            if (!eventArgs.trim()) {
                await message.reply('❌ **Event remove command format:**\n`!removeevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM`\n\n**Examples:**\n`!removeevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00`\n`!removeevent @Wales @Cardiff "Rally" | 2024-08-30 14:00`\n\n**Notes:**\n- Use same format as when you created the event\n- @LocationRole is optional if event is region-wide\n- Must match exactly (including date and time)');
                return;
            }

            // Parse arguments using same logic as handleAddEvent
            const parts = eventArgs.split('|').map(part => part.trim());
            if (parts.length < 2) {
                await message.reply('❌ **Invalid format.** Use pipe `|` to separate event details from date.\n\n**Format:** `@RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM`');
                return;
            }

            const eventDetailsStr = parts[0];
            const dateStr = parts[1];

            // Parse role mentions and event name
            const roleMentions = eventDetailsStr.match(/<@&(\d+)>/g) || [];
            if (roleMentions.length === 0) {
                await message.reply('❌ **Missing role mentions.** You must mention at least one region role.\n\n**Format:** `@RegionRole @LocationRole "Event Name"`');
                return;
            }

            const nameMatch = eventDetailsStr.match(/.*>[\s]*(.+)$/);
            if (!nameMatch) {
                await message.reply('❌ **Missing event name.** Add the event name after the role mentions.');
                return;
            }

            const eventName = nameMatch[1].replace(/^["']|["']$/g, '').trim();
            if (!eventName) {
                await message.reply('❌ **Event name cannot be empty.**');
                return;
            }

            // Validate and resolve roles
            const guild = message.guild;
            const mentionedRoles = roleMentions.map(mention => {
                const roleId = mention.match(/<@&(\d+)>/)[1];
                return guild.roles.cache.get(roleId);
            }).filter(role => role !== undefined);

            if (mentionedRoles.length !== roleMentions.length) {
                await message.reply('❌ **Some mentioned roles do not exist in this server.** Please use valid role mentions.');
                return;
            }

            const regionRole = mentionedRoles[0];
            const locationRole = mentionedRoles.length > 1 ? mentionedRoles[1] : null;

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/;
            if (!dateRegex.test(dateStr)) {
                await message.reply('❌ **Invalid date format.** Use: `YYYY-MM-DD HH:MM`');
                return;
            }

            // Create event search criteria
            const eventCriteria = {
                name: eventName,
                region: regionRole.name,
                location: locationRole ? locationRole.name : null,
                eventDate: dateStr.trim()
            };

            // Remove event using EventManager
            const eventManager = this.bot.getEventManager();
            const result = await eventManager.removeEvent(message.guild.id, eventCriteria, message.author);

            if (result.success) {
                await message.reply(`✅ **Event removed successfully!**\n\n**${eventName}**\n📅 **Date:** ${dateStr}\n📍 **Region:** ${regionRole.name}${locationRole ? `\n🏘️ **Location:** ${locationRole.name}` : ''}\n\n🗑️ Event notifications have been sent to notify affected users.`);
            } else {
                await message.reply(`❌ **Could not find event to remove.**\n\n**Searched for:**\n- **Name:** ${eventName}\n- **Region:** ${regionRole.name}${locationRole ? `\n- **Location:** ${locationRole.name}` : ''}\n- **Date:** ${dateStr}\n\n💡 **Tip:** Make sure the details match exactly as when the event was created. Use \`!events\` to see existing events.`);
            }

        } catch (error) {
            console.error('Error handling remove event command:', error);
            await message.reply('❌ An error occurred while removing the event. Please try again.');
        }
    }

    async handleListEvents(message) {
        try {
            const eventManager = this.bot.getEventManager();
            const events = await eventManager.getUpcomingEvents(message.guild.id);

            if (!events || events.length === 0) {
                await message.reply('📅 **No upcoming events scheduled.**\n\n💡 Use `!addevent` to create new events!');
                return;
            }

            let eventsDisplay = `📅 **Upcoming Events** (${events.length}):\n\n`;

            events.forEach((event, index) => {
                const eventDate = new Date(event.event_date);
                const formattedDate = eventDate.toLocaleString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/London'
                });

                eventsDisplay += `**${index + 1}.** 🎪 **${event.name}**\n`;
                eventsDisplay += `   📅 ${formattedDate}\n`;
                eventsDisplay += `   📍 ${event.region}${event.location ? ` - ${event.location}` : ''}\n`;
                if (event.link) {
                    eventsDisplay += `   🔗 <${event.link}>\n`;
                }
                eventsDisplay += `   👤 Created by: <@${event.created_by}>\n\n`;
            });

            eventsDisplay += `💡 **Use \`!events @LocationRole\` to see events for a specific location**`;

            await message.reply(eventsDisplay);

        } catch (error) {
            console.error('Error listing events:', error);
            await message.reply('❌ An error occurred while retrieving events.');
        }
    }

    async handleListEventsByLocation(message, locationArgs) {
        try {
            const locationArgs_clean = locationArgs.trim();
            
            // Parse role mention from location argument
            const roleMatch = locationArgs_clean.match(/<@&(\d+)>/);
            if (!roleMatch) {
                await message.reply('❌ **Please mention a location role.** \n\n**Format:** `!events @LocationRole`\n**Example:** `!events @London`');
                return;
            }

            const roleId = roleMatch[1];
            const guild = message.guild;
            const locationRole = guild.roles.cache.get(roleId);

            if (!locationRole) {
                await message.reply('❌ **Location role not found.** Please use a valid role mention.');
                return;
            }

            const eventManager = this.bot.getEventManager();
            const events = await eventManager.getUpcomingEventsByLocation(message.guild.id, locationRole.name);

            if (!events || events.length === 0) {
                await message.reply(`📅 **No upcoming events found for ${locationRole.name}.**\n\n💡 Use \`!addevent\` to create new events!`);
                return;
            }

            let eventsDisplay = `📅 **Upcoming Events in ${locationRole.name}** (${events.length}):\n\n`;

            events.forEach((event, index) => {
                const eventDate = new Date(event.event_date);
                const formattedDate = eventDate.toLocaleString('en-GB', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/London'
                });

                eventsDisplay += `**${index + 1}.** 🎪 **${event.name}**\n`;
                eventsDisplay += `   📅 ${formattedDate}\n`;
                eventsDisplay += `   📍 ${event.region}${event.location ? ` - ${event.location}` : ''}\n`;
                if (event.link) {
                    eventsDisplay += `   🔗 <${event.link}>\n`;
                }
                eventsDisplay += `   👤 Created by: <@${event.created_by}>\n\n`;
            });

            eventsDisplay += `💡 **Use \`!events\` to see all upcoming events**`;

            await message.reply(eventsDisplay);

        } catch (error) {
            console.error('Error listing events by location:', error);
            await message.reply('❌ An error occurred while retrieving events for the specified location.');
        }
    }

    async handleClearEvents(message) {
        try {
            const eventManager = this.bot.getEventManager();
            const events = await eventManager.getUpcomingEvents(message.guild.id);

            if (!events || events.length === 0) {
                await message.reply('📅 **No upcoming events to clear.**');
                return;
            }

            // Only moderators can clear events
            const member = message.guild.members.cache.get(message.author.id);
            const isModerator = this.bot.getUserValidator().canUseModerator(member, this.bot.getModeratorRoleId());

            if (!isModerator) {
                await message.reply('❌ **Only moderators can clear all events.** Use `!removeevent` to remove specific events.');
                return;
            }

            const clearedCount = await eventManager.clearAllEvents(message.guild.id, message.author);
            
            if (clearedCount > 0) {
                await message.reply(`✅ **Successfully cleared ${clearedCount} upcoming event${clearedCount !== 1 ? 's' : ''}.**\n\n🗑️ All affected users have been notified of the cancellations.`);
            } else {
                await message.reply('📅 **No events were cleared.** There may have been an error or the events were already removed.');
            }

        } catch (error) {
            console.error('Error clearing events:', error);
            await message.reply('❌ An error occurred while clearing events.');
        }
    }

    // Utility methods
    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }
}

module.exports = EventCommandHandler;