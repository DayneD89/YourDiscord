/**
 * EventNotificationManager - Handles Discord message formatting and channel notifications
 * 
 * Manages event notifications to appropriate regional and local Discord channels,
 * ensuring community members are informed about relevant events in their areas.
 * 
 * Design rationale:
 * - Targeted notifications: Events are sent to region/location channels to reduce noise
 * - Rich formatting: Uses Discord embeds and structured formatting for better readability
 * - Channel auto-discovery: Automatically finds appropriate channels based on naming conventions
 * - Timezone awareness: All times are displayed in UK timezone for consistency
 * - Multiple notification types: Supports creation, reminder, and cancellation notifications
 * - Error resilience: Gracefully handles missing channels or notification failures
 */
class EventNotificationManager {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Send event notification to appropriate channels
     */
    async sendEventNotification(guild, event, regionRole, locationRole) {
        try {
            // Find regional channel
            const regionChannelName = `regional-${event.region.toLowerCase().replace(/\s+/g, '-')}`;
            const regionChannel = guild.channels.cache.find(channel => 
                channel.name === regionChannelName && channel.type === 0 // Text channel
            );

            console.log(`🔍 Looking for regional channel: ${regionChannelName} - Found: ${regionChannel ? regionChannel.name : 'NOT FOUND'}`);

            // Find local channel if location specified
            let locationChannel = null;
            if (event.location) {
                const locationChannelName = `local-${event.location.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`;
                locationChannel = guild.channels.cache.find(channel => 
                    channel.name === locationChannelName && channel.type === 0
                );
                
                console.log(`🔍 Looking for location channel: ${locationChannelName} - Found: ${locationChannel ? locationChannel.name : 'NOT FOUND'}`);
                
                // Debug: show all available local channels
                const localChannels = guild.channels.cache.filter(ch => ch.name.startsWith('local-')).map(ch => ch.name);
                console.log(`🔍 Available local channels: ${localChannels.join(', ')}`);
            }

            const eventMessage = this.formatEventMessage(event);

            // Send to regional channel
            if (regionChannel) {
                await regionChannel.send({
                    content: `${regionRole} - New event in your region!`,
                    embeds: [{
                        title: '🎉 New Regional Event',
                        description: eventMessage,
                        color: 0x00ff00,
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            // Send to location channel if exists
            if (locationChannel && locationRole) {
                await locationChannel.send({
                    content: `${locationRole} - New event in your area!`,
                    embeds: [{
                        title: '🎉 New Local Event',
                        description: eventMessage,
                        color: 0x00ff00,
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            console.log(`Event notification sent for: ${event.name}`);

        } catch (error) {
            console.error('Error sending event notification:', error);
        }
    }

    /**
     * Send event reminder to channels
     */
    async sendEventReminder(event, reminderType, intervalMs, isAfterCreation = false) {
        try {
            const guild = this.bot.client.guilds.cache.get(event.guild_id);
            if (!guild) {
                console.error(`Guild ${event.guild_id} not found for reminder`);
                return;
            }

            // Find channels
            const regionChannelName = `regional-${event.region.toLowerCase().replace(/\s+/g, '-')}`;
            const regionChannel = guild.channels.cache.find(channel => 
                channel.name === regionChannelName && channel.type === 0
            );

            let locationChannel = null;
            if (event.location) {
                const locationChannelName = `local-${event.location.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`;
                locationChannel = guild.channels.cache.find(channel => 
                    channel.name === locationChannelName && channel.type === 0
                );
            }

            const eventDate = new Date(event.event_date);
            const now = new Date();
            const timeUntil = this.getTimeUntilEvent(eventDate, now);

            let reminderTitle;
            let reminderColor;
            
            if (reminderType === 'week') {
                reminderTitle = '📅 Event Reminder - One Week';
                reminderColor = 0xffff00; // Yellow
            } else if (reminderType === 'day') {
                reminderTitle = '⏰ Event Reminder - Tomorrow';
                reminderColor = 0xff9900; // Orange
            } else if (reminderType === 'soon') {
                reminderTitle = '🚨 Event Starting Soon';
                reminderColor = 0xff0000; // Red
            } else {
                reminderTitle = '📅 Event Reminder';
                reminderColor = 0x0099ff; // Blue
            }

            const reminderMessage = this.formatReminderMessage(event, timeUntil, isAfterCreation);

            // Send to regional channel
            if (regionChannel) {
                await regionChannel.send({
                    embeds: [{
                        title: reminderTitle,
                        description: reminderMessage,
                        color: reminderColor,
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            // Send to location channel if exists
            if (locationChannel) {
                await locationChannel.send({
                    embeds: [{
                        title: reminderTitle,
                        description: reminderMessage,
                        color: reminderColor,
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            console.log(`${reminderType} reminder sent for event: ${event.name}`);

        } catch (error) {
            console.error(`Error sending ${reminderType} reminder:`, error);
        }
    }

    /**
     * Format event message for notifications
     */
    formatEventMessage(event) {
        const eventDate = new Date(event.event_date);
        
        // Use consistent date/time formatting to avoid cross-platform issues
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Europe/London'
        };
        
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/London'
        };
        
        const datePart = eventDate.toLocaleDateString('en-GB', dateOptions);
        const timePart = eventDate.toLocaleTimeString('en-GB', timeOptions);
        const formattedDate = `${datePart} at ${timePart}`;

        return `🎉 **New Event Added!**\n\n` +
            `**${event.name}**\n` +
            `📅 **Date:** ${formattedDate}\n` +
            `📍 **Region:** ${event.region}\n` +
            `${event.location ? `🏘️ **Location:** ${event.location}\n` : ''}` +
            `${event.description ? `📝 **Description:** ${event.description}\n` : ''}` +
            `${event.link ? `🔗 **Link:** <${event.link}>\n` : ''}` +
            `👤 **Organized by:** <@${event.created_by}>\n\n` +
            `💬 React with ✅ if you're interested in attending!`;
    }

    /**
     * Format reminder message for events
     */
    formatReminderMessage(event, timeUntil, isAfterCreation) {
        const eventDate = new Date(event.event_date);
        
        // Use consistent date/time formatting to avoid cross-platform issues
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Europe/London'
        };
        
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/London'
        };
        
        const datePart = eventDate.toLocaleDateString('en-GB', dateOptions);
        const timePart = eventDate.toLocaleTimeString('en-GB', timeOptions);
        const formattedDate = `${datePart} at ${timePart}`;

        let timeText = timeUntil;
        if (isAfterCreation) {
            timeText = `Starting in ${timeUntil}`;
        }

        return `**${event.name}**\n` +
            `📅 **Date:** ${formattedDate}\n` +
            `⏰ **${timeText}**\n` +
            `📍 **Region:** ${event.region}\n` +
            `${event.location ? `🏘️ **Location:** ${event.location}\n` : ''}` +
            `${event.description ? `📝 **Description:** ${event.description}\n` : ''}` +
            `${event.link ? `🔗 **Link:** <${event.link}>\n` : ''}` +
            `👤 **Organized by:** <@${event.created_by}>`;
    }

    /**
     * Calculate time until event in human-readable format
     */
    getTimeUntilEvent(eventDate, now = new Date()) {
        const timeDiff = eventDate.getTime() - now.getTime();
        
        if (timeDiff <= 0) {
            return 'Event has started';
        }

        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) {
            return `${days} day${days !== 1 ? 's' : ''}${hours > 0 ? ` and ${hours} hour${hours !== 1 ? 's' : ''}` : ''}`;
        } else if (hours > 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? ` and ${minutes} minute${minutes !== 1 ? 's' : ''}` : ''}`;
        } else {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }
    }

    /**
     * Send event cancellation notification
     */
    async sendCancellationNotification(guild, event) {
        try {
            // Find regional channel
            const regionChannelName = `regional-${event.region.toLowerCase().replace(/\s+/g, '-')}`;
            const regionChannel = guild.channels.cache.find(channel => 
                channel.name === regionChannelName && channel.type === 0
            );

            // Find local channel if location specified
            let locationChannel = null;
            if (event.location) {
                const locationChannelName = `local-${event.location.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`;
                locationChannel = guild.channels.cache.find(channel => 
                    channel.name === locationChannelName && channel.type === 0
                );
            }

            const cancellationMessage = this.formatCancellationMessage(event);

            // Send to regional channel
            if (regionChannel) {
                await regionChannel.send({
                    embeds: [{
                        title: '❌ Event Cancelled',
                        description: cancellationMessage,
                        color: 0xff0000, // Red
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            // Send to location channel if exists
            if (locationChannel) {
                await locationChannel.send({
                    embeds: [{
                        title: '❌ Event Cancelled',
                        description: cancellationMessage,
                        color: 0xff0000, // Red
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            console.log(`Cancellation notification sent for: ${event.name}`);

        } catch (error) {
            console.error('Error sending cancellation notification:', error);
        }
    }

    /**
     * Format cancellation message
     */
    formatCancellationMessage(event) {
        const eventDate = new Date(event.event_date);
        
        // Use consistent date/time formatting to avoid cross-platform issues
        const dateOptions = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Europe/London'
        };
        
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/London'
        };
        
        const datePart = eventDate.toLocaleDateString('en-GB', dateOptions);
        const timePart = eventDate.toLocaleTimeString('en-GB', timeOptions);
        const formattedDate = `${datePart} at ${timePart}`;

        return `**${event.name}**\n` +
            `📅 **Was scheduled for:** ${formattedDate}\n` +
            `📍 **Region:** ${event.region}\n` +
            `${event.location ? `🏘️ **Location:** ${event.location}\n` : ''}` +
            `👤 **Organized by:** <@${event.created_by}>\n\n` +
            `❌ **This event has been cancelled.**`;
    }
}

module.exports = EventNotificationManager;