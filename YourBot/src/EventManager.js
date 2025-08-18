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
        
        // Timer references for cleanup
        this.reminderTimer = null;
        this.initialCheckTimer = null;
        this.nextReminderTimeout = null;
        
        // Start reminder checker (runs every hour) - skip only during Jest testing
        if (!process.env.JEST_WORKER_ID) {
            this.startReminderChecker();
        }
        
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

            // Convert date to ISO string for consistent storage (assuming British time)
            const eventDate = new Date(eventData.eventDate);
            const eventDataWithISODate = {
                ...eventData,
                eventDate: eventDate.toISOString(),
                createdBy: createdBy.id
            };

            // Create event in database
            const event = await this.storage.createEvent(guildId, eventDataWithISODate);

            // Send notification to region and location channels
            await this.sendEventNotification(guild, event, regionRole, locationRole);

            // Reschedule reminders to include this new event
            this.rescheduleReminders();

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
     * Start the dynamic reminder system - schedules next reminder precisely
     */
    startReminderChecker() {
        console.log('Starting dynamic reminder system...');
        
        // Initial check on startup  
        this.initialCheckTimer = setTimeout(() => {
            this.scheduleNextReminder();
        }, 10000); // 10 seconds startup delay

        console.log('Dynamic reminder system started');
    }

    /**
     * Schedule the next reminder based on actual event timing
     */
    async scheduleNextReminder() {
        try {
            const guildId = this.bot.getGuildId();
            const upcomingEvents = await this.storage.getUpcomingEvents(guildId);

            if (upcomingEvents.length === 0) {
                console.log('🔔 No upcoming events - scheduling check in 1 hour');
                this.nextReminderTimeout = setTimeout(() => this.scheduleNextReminder(), 60 * 60 * 1000);
                return;
            }

            let nextReminderTime = null;
            let targetEvent = null;

            // Find the next reminder that needs to be sent
            for (const event of upcomingEvents) {
                const eventDate = new Date(event.event_date);
                const createdDate = new Date(event.created_at);
                const now = new Date();

                // Check when this event's reminders should be sent
                const weekReminderTime = new Date(eventDate.getTime() - this.reminderIntervals.weekReminder);
                const dayReminderTime = new Date(eventDate.getTime() - this.reminderIntervals.dayReminder);

                if (event.reminder_status === 'pending' && now >= weekReminderTime) {
                    // Week reminder is due now
                    nextReminderTime = now;
                    targetEvent = event;
                    break;
                } else if (event.reminder_status === 'week_sent' && now >= dayReminderTime) {
                    // Day reminder is due now
                    nextReminderTime = now;
                    targetEvent = event;
                    break;
                } else if (event.reminder_status === 'pending' && weekReminderTime > now) {
                    // Week reminder is due in the future
                    if (!nextReminderTime || weekReminderTime < nextReminderTime) {
                        nextReminderTime = weekReminderTime;
                        targetEvent = event;
                    }
                } else if (event.reminder_status === 'week_sent' && dayReminderTime > now) {
                    // Day reminder is due in the future
                    if (!nextReminderTime || dayReminderTime < nextReminderTime) {
                        nextReminderTime = dayReminderTime;
                        targetEvent = event;
                    }
                }
            }

            if (nextReminderTime && targetEvent) {
                const msUntilReminder = Math.max(0, nextReminderTime.getTime() - Date.now());
                
                if (msUntilReminder === 0) {
                    // Send reminder now and reschedule
                    console.log(`🔔 Sending immediate reminder for: ${targetEvent.name}`);
                    await this.processEventReminder(targetEvent);
                    this.scheduleNextReminder(); // Reschedule immediately
                } else {
                    // Schedule reminder for exact time
                    console.log(`🔔 Next reminder scheduled in ${Math.round(msUntilReminder/1000)}s for: ${targetEvent.name}`);
                    this.nextReminderTimeout = setTimeout(() => {
                        this.processEventReminder(targetEvent).then(() => {
                            this.scheduleNextReminder(); // Reschedule after sending
                        });
                    }, msUntilReminder);
                }
            } else {
                // No upcoming reminders, check again in 1 hour
                console.log('🔔 No upcoming reminders - checking again in 1 hour');
                this.nextReminderTimeout = setTimeout(() => this.scheduleNextReminder(), 60 * 60 * 1000);
            }

        } catch (error) {
            console.error('Error scheduling next reminder:', error);
            // Fallback to checking again in 5 minutes
            this.nextReminderTimeout = setTimeout(() => this.scheduleNextReminder(), 5 * 60 * 1000);
        }
    }

    /**
     * Cleanup timers - call this during shutdown or in tests
     */
    cleanup() {
        if (this.reminderTimer) {
            clearInterval(this.reminderTimer);
            this.reminderTimer = null;
        }
        if (this.initialCheckTimer) {
            clearTimeout(this.initialCheckTimer);
            this.initialCheckTimer = null;
        }
        if (this.nextReminderTimeout) {
            clearTimeout(this.nextReminderTimeout);
            this.nextReminderTimeout = null;
        }
        console.log('EventManager timers cleaned up');
    }

    /**
     * Reschedule reminders after new events are added
     */
    rescheduleReminders() {
        // Cancel current schedule and recalculate
        if (this.nextReminderTimeout) {
            clearTimeout(this.nextReminderTimeout);
            this.nextReminderTimeout = null;
        }
        
        // Schedule immediately
        setImmediate(() => this.scheduleNextReminder());
    }


    /**
     * Process reminder for a specific event (called by dynamic scheduler)
     */
    async processEventReminder(event) {
        try {
            const now = new Date();
            const eventDate = new Date(event.event_date);
            const timeUntilEvent = eventDate.getTime() - now.getTime();

            let reminderType = '';
            let newStatus = event.reminder_status;
            let reminderIntervalMs = 0;

            // Determine which reminder to send based on current status
            if (event.reminder_status === 'pending') {
                // Send first reminder
                reminderType = 'first';
                reminderIntervalMs = this.reminderIntervals.weekReminder;
                newStatus = 'week_sent';
            } else if (event.reminder_status === 'week_sent') {
                // Send second reminder
                reminderType = 'second';
                reminderIntervalMs = this.reminderIntervals.dayReminder;
                newStatus = 'day_sent';
            } else {
                // Already sent all reminders
                return;
            }

            const reminderText = this.formatIntervalTime(reminderIntervalMs, false);
            console.log(`📅 Sending ${reminderType} reminder (${reminderText}) for event: ${event.name}`);
            
            await this.sendEventReminder(event, reminderType, reminderIntervalMs, false);
            await this.storage.updateReminderStatus(event.guild_id, event.event_id, newStatus);

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