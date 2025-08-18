const EventStorage = require('./EventStorage');

/**
 * EventManager - Handles event creation, notifications, and reminders
 */
class EventManager {
    constructor(bot) {
        this.bot = bot;
        this.storage = new EventStorage(process.env.EVENTS_TABLE || this.bot.getEventsTable());
        
        // Get environment-specific reminder intervals from bot configuration
        this.reminderIntervals = this.bot.getReminderIntervals();
        if (!this.reminderIntervals) {
            throw new Error('Reminder intervals not configured in bot');
        }
        
        // Start reminder checker (runs every hour)
        this.startReminderChecker();
        
        console.log(`EventManager initialized with intervals: ${this.reminderIntervals.weekReminder/60000}min, ${this.reminderIntervals.dayReminder/60000}min`);
    }

    /**
     * Create a new event with validation and role objects
     */
    async createEvent(guildId, eventData, createdBy, regionRole = null, locationRole = null) {
        try {
            // Validate event data
            const validation = this.validateEventData(eventData);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Get guild
            const guild = this.bot.client.guilds.cache.get(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }

            // If roles weren't passed, try to find them by name (fallback for backward compatibility)
            if (!regionRole) {
                regionRole = this.findRoleByName(guild, eventData.region);
                if (!regionRole) {
                    throw new Error(`Region role "${eventData.region}" not found`);
                }
            }

            if (!locationRole && eventData.location) {
                locationRole = this.findRoleByName(guild, eventData.location);
            }

            // Create event in database
            const event = await this.storage.createEvent(guildId, {
                ...eventData,
                createdBy: createdBy.id
            });

            // Send notification to region and location channels
            await this.sendEventNotification(guild, event, regionRole, locationRole);

            return event;

        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    }

    /**
     * Validate event data
     */
    validateEventData(eventData) {
        if (!eventData.name || eventData.name.trim().length === 0) {
            return { valid: false, error: 'Event name is required' };
        }

        if (!eventData.region) {
            return { valid: false, error: 'Region is required' };
        }

        if (!eventData.eventDate) {
            return { valid: false, error: 'Event date is required' };
        }

        // Validate date format and ensure it's in the future
        const eventDate = new Date(eventData.eventDate);
        if (isNaN(eventDate.getTime())) {
            return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD HH:MM format' };
        }

        if (eventDate <= new Date()) {
            return { valid: false, error: 'Event date must be in the future' };
        }

        return { valid: true };
    }

    /**
     * Find role by name (case insensitive)
     */
    findRoleByName(guild, roleName) {
        return guild.roles.cache.find(role => 
            role.name.toLowerCase() === roleName.toLowerCase()
        );
    }

    /**
     * Convert milliseconds to human readable time text
     */
    formatIntervalTime(intervalMs, isAfterCreation = false) {
        const absInterval = Math.abs(intervalMs);
        
        // Convert to different units
        const seconds = Math.floor(absInterval / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        // Format based on largest unit
        let timeText = '';
        if (days > 0) {
            timeText = `${days} day${days !== 1 ? 's' : ''}`;
        } else if (hours > 0) {
            timeText = `${hours} hour${hours !== 1 ? 's' : ''}`;
        } else if (minutes > 0) {
            timeText = `${minutes} min${minutes !== 1 ? 's' : ''}`;
        } else {
            timeText = `${seconds} sec${seconds !== 1 ? 's' : ''}`;
        }
        
        // Add context for when the reminder is sent
        if (isAfterCreation) {
            return `${timeText} after creation`;
        } else {
            return `${timeText} before event`;
        }
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

            const eventDate = new Date(event.event_date);
            const formattedDate = eventDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const eventMessage = `🎉 **New Event Added!**\n\n` +
                `**${event.name}**\n` +
                `📅 **Date:** ${formattedDate}\n` +
                `📍 **Region:** ${event.region}\n` +
                `${event.location ? `🏘️ **Location:** ${event.location}\n` : ''}` +
                `${event.description ? `📝 **Description:** ${event.description}\n` : ''}` +
                `${event.link ? `🔗 **Link:** <${event.link}>\n` : ''}` +
                `👤 **Organized by:** <@${event.created_by}>\n\n` +
                `💬 React with ✅ if you're interested in attending!`;

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
     * Start the reminder checker system
     */
    startReminderChecker() {
        // Check frequency based on environment - more frequent in dev for testing
        const isDevMode = this.reminderIntervals.weekReminder < 0; // Negative means dev mode
        const checkInterval = isDevMode ? 30 * 1000 : 60 * 60 * 1000; // 30 seconds in dev, 1 hour in prod
        
        console.log(`Starting reminder checker - checking every ${checkInterval/1000}s (${isDevMode ? 'dev' : 'prod'} mode)`);
        
        setInterval(() => {
            this.checkReminders();
        }, checkInterval);

        // Initial check on startup  
        setTimeout(() => {
            this.checkReminders();
        }, isDevMode ? 10000 : 30000); // 10 seconds in dev, 30 seconds in prod

        console.log('Reminder checker started');
    }

    /**
     * Check for events that need reminders
     */
    async checkReminders() {
        try {
            const guildId = this.bot.getGuildId();
            const upcomingEvents = await this.storage.getUpcomingEvents(guildId);

            for (const event of upcomingEvents) {
                await this.processEventReminder(event);
            }

        } catch (error) {
            console.error('Error checking reminders:', error);
        }
    }

    /**
     * Process reminder for a specific event
     */
    async processEventReminder(event) {
        try {
            const now = new Date();
            const eventDate = new Date(event.event_date);
            const createdDate = new Date(event.created_at);
            const timeSinceCreation = now.getTime() - createdDate.getTime();
            const timeUntilEvent = eventDate.getTime() - now.getTime();

            let shouldSendReminder = false;
            let reminderType = '';
            let newStatus = event.reminder_status;

            // Check if we're using "after creation" reminders (negative intervals) or "before event" reminders (positive)
            const isAfterCreationMode = this.reminderIntervals.weekReminder < 0;

            // Debug logging for troubleshooting
            console.log(`🔍 Reminder check for event ${event.name}:`);
            console.log(`  - Event date: ${eventDate.toISOString()}`);
            console.log(`  - Time until event: ${Math.floor(timeUntilEvent / (60 * 1000))} minutes`);
            console.log(`  - Time since creation: ${Math.floor(timeSinceCreation / (60 * 1000))} minutes`);
            console.log(`  - Current status: ${event.reminder_status}`);
            console.log(`  - Mode: ${isAfterCreationMode ? 'After creation' : 'Before event'}`);
            console.log(`  - Week reminder interval: ${this.reminderIntervals.weekReminder}ms`);
            console.log(`  - Day reminder interval: ${this.reminderIntervals.dayReminder}ms`);

            let reminderIntervalMs = 0;

            if (isAfterCreationMode) {
                // Development mode: Send reminders X minutes AFTER event creation
                const weekReminderTime = Math.abs(this.reminderIntervals.weekReminder);  // 2 minutes
                const dayReminderTime = Math.abs(this.reminderIntervals.dayReminder);    // 1 minute
                
                // First reminder: X minutes after creation
                if (timeSinceCreation >= weekReminderTime && event.reminder_status === 'pending') {
                    shouldSendReminder = true;
                    reminderType = 'first';
                    reminderIntervalMs = this.reminderIntervals.weekReminder; // Keep negative for after-creation formatting
                    newStatus = 'week_sent';
                }
                // Second reminder: X minutes after first reminder 
                else if (timeSinceCreation >= (weekReminderTime + dayReminderTime) && event.reminder_status === 'week_sent') {
                    shouldSendReminder = true;
                    reminderType = 'second';
                    reminderIntervalMs = this.reminderIntervals.dayReminder; // Keep negative for after-creation formatting  
                    newStatus = 'day_sent';
                }
            } else {
                // Production mode: Send reminders X time BEFORE event date
                // Week reminder: Send when time remaining is less than or equal to week reminder threshold
                if (timeUntilEvent <= this.reminderIntervals.weekReminder && timeUntilEvent > this.reminderIntervals.dayReminder && event.reminder_status === 'pending') {
                    shouldSendReminder = true;
                    reminderType = 'first';
                    reminderIntervalMs = this.reminderIntervals.weekReminder;
                    newStatus = 'week_sent';
                }
                // Day reminder: Send when time remaining is less than or equal to day reminder threshold
                else if (timeUntilEvent <= this.reminderIntervals.dayReminder && timeUntilEvent > 0 && event.reminder_status === 'week_sent') {
                    shouldSendReminder = true;
                    reminderType = 'second';
                    reminderIntervalMs = this.reminderIntervals.dayReminder;
                    newStatus = 'day_sent';
                }
            }

            if (shouldSendReminder) {
                const reminderText = this.formatIntervalTime(reminderIntervalMs, isAfterCreationMode);
                console.log(`📅 Sending ${reminderType} reminder (${reminderText}) for event: ${event.name}`);
                await this.sendEventReminder(event, reminderType, reminderIntervalMs, isAfterCreationMode);
                await this.storage.updateReminderStatus(event.guild_id, event.event_id, newStatus);
            }

        } catch (error) {
            console.error(`Error processing reminder for event ${event.event_id}:`, error);
        }
    }

    /**
     * Send event reminder
     */
    async sendEventReminder(event, reminderType, intervalMs, isAfterCreation = false) {
        try {
            const guild = this.bot.client.guilds.cache.get(event.guild_id);
            if (!guild) return;

            // Find channels and roles
            const regionRole = this.findRoleByName(guild, event.region);
            const locationRole = event.location ? this.findRoleByName(guild, event.location) : null;

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
                
                console.log(`🔍 [REMINDER] Looking for location channel: ${locationChannelName} - Found: ${locationChannel ? locationChannel.name : 'NOT FOUND'}`);
            }

            const eventDate = new Date(event.event_date);
            const formattedDate = eventDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Generate reminder text using actual configured intervals
            const intervalText = this.formatIntervalTime(intervalMs, isAfterCreation);
            
            let reminderEmoji = '📅';
            let reminderText = intervalText;
            
            // Choose emoji based on reminder type and timing
            if (reminderType === 'first') {
                reminderEmoji = isAfterCreation ? '🧪' : '📅';
            } else if (reminderType === 'second') {
                reminderEmoji = isAfterCreation ? '🔬' : '⏰';
            }
            
            // For production mode, use more descriptive emojis based on time
            if (!isAfterCreation) {
                const absInterval = Math.abs(intervalMs);
                if (absInterval >= 24 * 60 * 60 * 1000) { // 1+ days
                    reminderEmoji = '📅';
                } else if (absInterval >= 60 * 60 * 1000) { // 1+ hours  
                    reminderEmoji = '⏰';
                } else { // Less than 1 hour
                    reminderEmoji = '🔔';
                }
            }

            const reminderMessage = `${reminderEmoji} **Event Reminder - ${reminderText}**\n\n` +
                `**${event.name}**\n` +
                `📅 **Date:** ${formattedDate}\n` +
                `📍 **Region:** ${event.region}\n` +
                `${event.location ? `🏘️ **Location:** ${event.location}\n` : ''}` +
                `${event.description ? `📝 **Description:** ${event.description}\n` : ''}` +
                `${event.link ? `🔗 **Link:** <${event.link}>\n` : ''}` +
                `👤 **Organized by:** <@${event.created_by}>`;

            // Send to regional channel
            if (regionChannel && regionRole) {
                await regionChannel.send({
                    content: `${regionRole} - Event reminder!`,
                    embeds: [{
                        title: `${reminderEmoji} Event Reminder`,
                        description: reminderMessage,
                        color: reminderType === '24-hour' ? 0xff4500 : 0xffd700,
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            // Send to location channel
            if (locationChannel && locationRole) {
                await locationChannel.send({
                    content: `${locationRole} - Event reminder!`,
                    embeds: [{
                        title: `${reminderEmoji} Event Reminder`,
                        description: reminderMessage,
                        color: reminderType === '24-hour' ? 0xff4500 : 0xffd700,
                        timestamp: new Date().toISOString()
                    }]
                });
            }

            console.log(`${reminderType} reminder sent for event: ${event.name}`);

        } catch (error) {
            console.error('Error sending event reminder:', error);
        }
    }

    /**
     * Get events for a region
     */
    async getEventsByRegion(guildId, region) {
        return await this.storage.getEventsByRegion(guildId, region);
    }

    /**
     * Get next 3 upcoming events for a region
     */
    async getUpcomingEventsByRegion(guildId, region) {
        return await this.storage.getUpcomingEventsByRegion(guildId, region, 3);
    }

    /**
     * Get next 3 upcoming events for a location
     */
    async getUpcomingEventsByLocation(guildId, location) {
        return await this.storage.getUpcomingEventsByLocation(guildId, location, 3);
    }

    /**
     * Delete an event
     */
    async deleteEvent(guildId, eventId) {
        return await this.storage.deleteEvent(guildId, eventId);
    }
}

module.exports = EventManager;