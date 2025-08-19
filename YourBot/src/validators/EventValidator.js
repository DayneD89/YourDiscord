/**
 * EventValidator - Handles validation logic for events
 * 
 * Ensures event data meets quality standards before storage and prevents system abuse.
 * Validates formats, timezones, and business rules to maintain data consistency.
 * 
 * Validation design rationale:
 * - Input validation prevents malformed events from corrupting the system
 * - Timezone handling ensures accurate scheduling across regions
 * - Future date requirements prevent confusion from past events
 * - Role validation ensures notification targeting works correctly
 */
class EventValidator {
    constructor(bot) {
        this.bot = bot;
    }

    /**
     * Validate event data including region, location, and date
     */
    validateEventData(eventData) {
        // Validate required fields
        if (!eventData.name || eventData.name.trim().length === 0) {
            return { valid: false, error: 'Event name is required' };
        }

        if (!eventData.region || eventData.region.trim().length === 0) {
            return { valid: false, error: 'Region is required' };
        }

        if (!eventData.eventDate) {
            return { valid: false, error: 'Event date is required' };
        }

        // Validate event name length
        if (eventData.name.length > 100) {
            return { valid: false, error: 'Event name must be 100 characters or less' };
        }

        // Validate and normalize date
        const dateValidation = this.validateEventDate(eventData.eventDate);
        if (!dateValidation.valid) {
            return dateValidation;
        }

        return { valid: true };
    }

    /**
     * Validate event date format and ensure it's in the future
     */
    validateEventDate(eventDateStr) {
        try {
            // Parse the date string and validate format
            const dateRegex = /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/;
            if (!dateRegex.test(eventDateStr.trim())) {
                return {
                    valid: false,
                    error: 'Invalid date format. Use YYYY-MM-DD HH:MM (e.g., 2024-08-25 18:00)'
                };
            }

            // Parse user input as UK local time and convert to UTC for storage
            // User enters time in UK timezone, we store as UTC for Discord/databases
            const [datePart, timePart] = eventDateStr.trim().split(' ');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hour, minute] = timePart.split(':').map(Number);
            
            // Create a Date object treating the input as UK time
            // Use a helper method to get proper UK timezone offset
            const eventDate = this.parseUKTimeToUTC(year, month - 1, day, hour, minute);
            
            // Check if date is valid
            if (isNaN(eventDate.getTime())) {
                return {
                    valid: false,
                    error: 'Invalid date. Please check the date and time are correct.'
                };
            }

            // Check if date is in the future (at least 5 minutes from now)
            // Compare UTC times since eventDate is now in UTC
            const nowUTC = new Date();
            const minFutureTime = new Date(nowUTC.getTime() + (5 * 60 * 1000)); // 5 minutes from now

            if (eventDate <= minFutureTime) {
                return {
                    valid: false,
                    error: 'Event date must be at least 5 minutes in the future'
                };
            }

            // Check if date is not too far in the future (1 year)
            const maxFutureTime = new Date(nowUTC.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year from now
            if (eventDate > maxFutureTime) {
                return {
                    valid: false,
                    error: 'Event date cannot be more than 1 year in the future'
                };
            }

            return { 
                valid: true, 
                date: eventDate.toISOString() 
            };

        } catch (error) {
            return {
                valid: false,
                error: 'Invalid date format. Use YYYY-MM-DD HH:MM (e.g., 2024-08-25 18:00)'
            };
        }
    }

    /**
     * Validate role exists and has permissions
     */
    validateRole(guild, roleName, roleType = 'role') {
        if (!roleName) {
            return { valid: false, error: `${roleType} is required` };
        }

        const role = this.findRoleByName(guild, roleName);
        if (!role) {
            return {
                valid: false,
                error: `${roleType} role "${roleName}" not found in server. Please check the role name and ensure it exists.`
            };
        }

        return { valid: true, role };
    }

    /**
     * Find role by name (case-insensitive)
     */
    findRoleByName(guild, roleName) {
        if (!guild || !roleName) return null;
        
        return guild.roles.cache.find(role => 
            role.name.toLowerCase() === roleName.toLowerCase()
        );
    }

    /**
     * Validate event link if provided
     */
    validateEventLink(link) {
        if (!link) return { valid: true }; // Link is optional

        try {
            const url = new URL(link);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return {
                    valid: false,
                    error: 'Event link must be a valid HTTP or HTTPS URL'
                };
            }
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: 'Invalid URL format for event link'
            };
        }
    }

    /**
     * Parse UK local time to UTC for consistent storage
     * 
     * Converts user-entered UK local time to UTC for database storage and Discord timestamps.
     * This ensures events are scheduled correctly regardless of server timezone or DST changes.
     * The conversion handles BST/GMT transitions automatically using JavaScript's timezone support.
     */
    parseUKTimeToUTC(year, month, day, hour, minute) {
        // Create a date string in ISO format but specify it as UK timezone
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
        
        // Create date assuming the input is UTC first
        const tempDate = new Date(dateStr + 'Z');
        
        // Get UK timezone offset for this specific date (handles BST/GMT automatically)
        const ukDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'Europe/London' }));
        const utcDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
        const offset = ukDate.getTime() - utcDate.getTime();
        
        // Subtract the offset to get the correct UTC time
        return new Date(tempDate.getTime() - offset);
    }

    /**
     * Validate event removal criteria
     */
    validateRemovalCriteria(criteria) {
        if (!criteria.name) {
            return { valid: false, error: 'Event name is required for removal' };
        }

        if (!criteria.region) {
            return { valid: false, error: 'Region is required for removal' };
        }

        if (!criteria.eventDate) {
            return { valid: false, error: 'Event date is required for removal' };
        }

        return { valid: true };
    }
}

module.exports = EventValidator;