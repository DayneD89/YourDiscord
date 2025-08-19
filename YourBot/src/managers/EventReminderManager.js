/**
 * EventReminderManager - Handles reminder scheduling and timing logic
 * 
 * Implements a dynamic scheduling system that calculates exact reminder times
 * instead of constantly polling for events. This approach significantly reduces
 * resource usage while ensuring precise timing for event notifications.
 * 
 * Architecture benefits:
 * - Dynamic scheduling eliminates wasteful constant polling
 * - Precise timing ensures reminders are sent exactly when needed
 * - Automatic rescheduling when new events are added
 * - Graceful handling of system restarts and clock changes
 */
class EventReminderManager {
    constructor(bot, storage) {
        this.bot = bot;
        this.storage = storage;
        
        // Get environment-specific reminder intervals from bot configuration
        this.reminderIntervals = this.bot.getReminderIntervals();
        if (!this.reminderIntervals) {
            throw new Error('Reminder intervals not configured in bot');
        }
        
        // Timer references for cleanup
        this.reminderTimer = null;
        this.initialCheckTimer = null;
        this.nextReminderTimeout = null;
        
        console.log(`EventReminderManager initialized with intervals: ${this.reminderIntervals.weekReminder/60000}min, ${this.reminderIntervals.dayReminder/60000}min`);
    }

    /**
     * Start the dynamic reminder system - schedules next reminder precisely
     */
    startReminderChecker() {
        console.log('Starting dynamic reminder system...');
        
        // Delay initial check to allow bot components to fully initialize
        // This prevents race conditions during startup where dependencies might not be ready
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
                reminderType = 'week';
                reminderIntervalMs = this.reminderIntervals.weekReminder;
                newStatus = 'week_sent';
            } else if (event.reminder_status === 'week_sent') {
                // Send second reminder
                reminderType = 'day';
                reminderIntervalMs = this.reminderIntervals.dayReminder;
                newStatus = 'day_sent';
            } else {
                // Already sent all reminders
                return;
            }

            console.log(`📅 Sending ${reminderType} reminder for event: ${event.name}`);
            
            // Send reminder through notification manager
            await this.bot.eventManager.notificationManager.sendEventReminder(event, reminderType, reminderIntervalMs, false);
            await this.storage.updateReminderStatus(event.guild_id, event.event_id, newStatus);

        } catch (error) {
            console.error(`Error processing reminder for event ${event.event_id}:`, error);
        }
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
        console.log('EventReminderManager timers cleaned up');
    }
}

module.exports = EventReminderManager;