const EventStorage = require('../storage/EventStorage');
const EventValidator = require('../validators/EventValidator');
const EventNotificationManager = require('./EventNotificationManager');
const EventReminderManager = require('./EventReminderManager');

/**
 * EventManager - Community event coordination and management system
 * 
 * Orchestrates a comprehensive event management system that enables community members
 * to create, manage, and track local and regional events.
 * 
 * System design rationale:
 * - Role-based organization (region/location) enables targeted notifications
 * - Automated reminder system ensures events don't get forgotten
 * - Validation prevents invalid or poorly formatted events
 * - Persistent storage enables event history and analytics
 * 
 * Features:
 * - Event creation with role-based targeting
 * - Automated reminder notifications (week/day/soon)
 * - Event removal and cancellation management
 * - Regional and location-based filtering
 * - Integration with Discord role system for notifications
 */
class EventManager {
    constructor(bot) {
        this.bot = bot;
        this.storage = new EventStorage(process.env.EVENTS_TABLE || this.bot.getEventsTable());
        
        // Initialize specialized components
        this.validator = new EventValidator(bot);
        this.notificationManager = new EventNotificationManager(bot);
        this.reminderManager = new EventReminderManager(bot, this.storage);
        
        // Start reminder checker (runs every hour) - skip only during Jest testing
        if (!process.env.JEST_WORKER_ID) {
            this.reminderManager.startReminderChecker();
        }
        
        console.log(`EventManager initialized with specialized components`);
    }

    /**
     * Create a new community event with comprehensive validation
     * 
     * Validates event data, stores in database, and sends notifications to appropriate
     * regional and location-based channels.
     * 
     * @param {string} guildId - Discord guild ID
     * @param {Object} eventData - Event details (name, region, location, date, link)
     * @param {Object} createdBy - Discord user who created the event
     * @param {Object} regionRole - Discord role for regional notifications
     * @param {Object} locationRole - Discord role for location-specific notifications
     * @returns {Object} - Created event with database ID
     */
    async createEvent(guildId, eventData, createdBy, regionRole = null, locationRole = null) {
        try {
            // Validate event data
            const validation = this.validator.validateEventData(eventData);
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
                regionRole = this.validator.findRoleByName(guild, eventData.region);
                if (!regionRole) {
                    throw new Error(`Region role "${eventData.region}" not found`);
                }
            }

            if (!locationRole && eventData.location) {
                locationRole = this.validator.findRoleByName(guild, eventData.location);
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
            await this.notificationManager.sendEventNotification(guild, event, regionRole, locationRole);

            // Reschedule reminders to include this new event
            this.reminderManager.rescheduleReminders();

            return event;

        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }
    }






    /**
     * Cleanup timers - call this during shutdown or in tests
     */
    cleanup() {
        this.reminderManager.cleanup();
        console.log('EventManager cleaned up');
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

    /**
     * Get all upcoming events for a guild
     */
    async getUpcomingEvents(guildId) {
        return await this.storage.getUpcomingEvents(guildId);
    }

    /**
     * Remove an event by criteria
     */
    async removeEvent(guildId, eventCriteria, removedBy) {
        try {
            const result = await this.storage.removeEventByCriteria(guildId, eventCriteria);
            
            if (result.success && result.event) {
                // Get guild for notifications
                const guild = this.bot.client.guilds.cache.get(guildId);
                if (guild) {
                    // Send cancellation notification
                    await this.notificationManager.sendCancellationNotification(guild, result.event);
                }
                
                // Reschedule reminders
                this.reminderManager.rescheduleReminders();
            }
            
            return result;
        } catch (error) {
            console.error('Error removing event:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clear all events for a guild
     */
    async clearAllEvents(guildId, removedBy) {
        try {
            const events = await this.storage.getUpcomingEvents(guildId);
            let clearedCount = 0;
            
            for (const event of events) {
                const result = await this.storage.deleteEvent(guildId, event.event_id);
                if (result) {
                    clearedCount++;
                    
                    // Get guild for notifications
                    const guild = this.bot.client.guilds.cache.get(guildId);
                    if (guild) {
                        // Send cancellation notification
                        await this.notificationManager.sendCancellationNotification(guild, event);
                    }
                }
            }
            
            // Reschedule reminders
            this.reminderManager.rescheduleReminders();
            
            return clearedCount;
        } catch (error) {
            console.error('Error clearing events:', error);
            return 0;
        }
    }
}

module.exports = EventManager;