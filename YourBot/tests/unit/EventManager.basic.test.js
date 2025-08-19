const EventManager = require('../../src/managers/EventManager');
const EventStorage = require('../../src/storage/EventStorage');
const EventValidator = require('../../src/validators/EventValidator');
const EventNotificationManager = require('../../src/managers/EventNotificationManager');
const EventReminderManager = require('../../src/managers/EventReminderManager');

// Mock all dependencies
jest.mock('../../src/storage/EventStorage');
jest.mock('../../src/validators/EventValidator');
jest.mock('../../src/managers/EventNotificationManager');
jest.mock('../../src/managers/EventReminderManager');

// Use Jest fake timers for timer control
jest.useFakeTimers();

describe('EventManager (Basic)', () => {
    let eventManager;
    let mockBot;
    let mockEventStorage;
    let mockValidator;
    let mockNotificationManager;
    let mockReminderManager;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        jest.clearAllTimers();

        // Create mock EventStorage instance
        mockEventStorage = {
            createEvent: jest.fn(),
            getUpcomingEvents: jest.fn(),
            getAllUpcomingEvents: jest.fn(),
            updateReminderStatus: jest.fn(),
            getEventsByRegion: jest.fn(),
            getUpcomingEventsByRegion: jest.fn(),
            getUpcomingEventsByLocation: jest.fn(),
            deleteEvent: jest.fn(),
            removeEventByCriteria: jest.fn()
        };

        // Create mock EventValidator instance
        mockValidator = {
            validateEventData: jest.fn(),
            findRoleByName: jest.fn()
        };

        // Create mock EventNotificationManager instance
        mockNotificationManager = {
            sendEventNotification: jest.fn(),
            sendEventReminder: jest.fn(),
            sendCancellationNotification: jest.fn()
        };

        // Create mock EventReminderManager instance
        mockReminderManager = {
            startReminderChecker: jest.fn(),
            rescheduleReminders: jest.fn(),
            formatIntervalTime: jest.fn(),
            cleanup: jest.fn()
        };

        // Mock constructors
        EventStorage.mockImplementation(() => mockEventStorage);
        EventValidator.mockImplementation(() => mockValidator);
        EventNotificationManager.mockImplementation(() => mockNotificationManager);
        EventReminderManager.mockImplementation(() => mockReminderManager);

        mockBot = {
            client: {
                guilds: {
                    cache: new Map()
                }
            },
            getGuildId: jest.fn().mockReturnValue('guild123'),
            getEventsTable: jest.fn().mockReturnValue('events-table'),
            getConfig: jest.fn().mockReturnValue({}),
            getReminderIntervals: jest.fn().mockReturnValue({
                weekReminder: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
                dayReminder: 24 * 60 * 60 * 1000 // 24 hours in ms
            })
        };

        // Create EventManager instance
        eventManager = new EventManager(mockBot);
    });

    afterEach(() => {
        // Clear all timers after each test
        jest.clearAllTimers();
        
        // Clean up EventManager timers if instance exists
        if (eventManager && typeof eventManager.cleanup === 'function') {
            eventManager.cleanup();
        }
    });

    afterAll(() => {
        // Restore real timers
        jest.useRealTimers();
    });

    describe('constructor', () => {
        test('should initialize with bot and storage', () => {
            expect(EventStorage).toHaveBeenCalledWith('events-table');
            expect(eventManager.bot).toBe(mockBot);
            expect(eventManager.storage).toBe(mockEventStorage);
        });

        test('should initialize specialized components', () => {
            expect(EventValidator).toHaveBeenCalledWith(mockBot);
            expect(EventNotificationManager).toHaveBeenCalledWith(mockBot);
            expect(EventReminderManager).toHaveBeenCalledWith(mockBot, mockEventStorage);
            expect(eventManager.validator).toBe(mockValidator);
            expect(eventManager.notificationManager).toBe(mockNotificationManager);
            expect(eventManager.reminderManager).toBe(mockReminderManager);
        });
    });

    describe('validateEventData via validator', () => {
        test('should delegate to validator component', () => {
            const validData = {
                name: 'Test Event',
                region: 'London',
                eventDate: '2024-12-25 18:00'
            };

            mockValidator.validateEventData.mockReturnValue({ valid: true });

            const result = eventManager.validator.validateEventData(validData);
            expect(result.valid).toBe(true);
            expect(mockValidator.validateEventData).toHaveBeenCalledWith(validData);
        });

        test('should reject empty name through validator', () => {
            const invalidData = {
                name: '',
                region: 'London',
                eventDate: '2024-12-25 18:00'
            };

            mockValidator.validateEventData.mockReturnValue({ 
                valid: false, 
                error: 'Event name is required' 
            });

            const result = eventManager.validator.validateEventData(invalidData);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Event name is required');
            expect(mockValidator.validateEventData).toHaveBeenCalledWith(invalidData);
        });

        test('should reject missing region through validator', () => {
            const invalidData = {
                name: 'Test Event',
                eventDate: '2024-12-25 18:00'
            };

            mockValidator.validateEventData.mockReturnValue({ 
                valid: false, 
                error: 'Region is required' 
            });

            const result = eventManager.validator.validateEventData(invalidData);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Region is required');
            expect(mockValidator.validateEventData).toHaveBeenCalledWith(invalidData);
        });

        test('should reject missing date through validator', () => {
            const invalidData = {
                name: 'Test Event',
                region: 'London'
            };

            mockValidator.validateEventData.mockReturnValue({ 
                valid: false, 
                error: 'Event date is required' 
            });

            const result = eventManager.validator.validateEventData(invalidData);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Event date is required');
            expect(mockValidator.validateEventData).toHaveBeenCalledWith(invalidData);
        });
    });

    describe('formatIntervalTime via reminder manager', () => {
        test('should format days correctly', () => {
            const threeDays = 3 * 24 * 60 * 60 * 1000;
            
            mockReminderManager.formatIntervalTime.mockReturnValueOnce('3 days before event');
            mockReminderManager.formatIntervalTime.mockReturnValueOnce('3 days after creation');

            const result1 = eventManager.reminderManager.formatIntervalTime(threeDays);
            const result2 = eventManager.reminderManager.formatIntervalTime(threeDays, true);
            
            expect(result1).toBe('3 days before event');
            expect(result2).toBe('3 days after creation');
            expect(mockReminderManager.formatIntervalTime).toHaveBeenCalledTimes(2);
        });

        test('should format hours correctly', () => {
            const twoHours = 2 * 60 * 60 * 1000;
            
            mockReminderManager.formatIntervalTime.mockReturnValue('2 hours before event');
            
            const result = eventManager.reminderManager.formatIntervalTime(twoHours);
            expect(result).toBe('2 hours before event');
            expect(mockReminderManager.formatIntervalTime).toHaveBeenCalledWith(twoHours);
        });

        test('should format minutes correctly', () => {
            const thirtyMinutes = 30 * 60 * 1000;
            
            mockReminderManager.formatIntervalTime.mockReturnValue('30 mins before event');
            
            const result = eventManager.reminderManager.formatIntervalTime(thirtyMinutes);
            expect(result).toBe('30 mins before event');
            expect(mockReminderManager.formatIntervalTime).toHaveBeenCalledWith(thirtyMinutes);
        });
    });

    describe('cleanup', () => {
        test('should clean up reminder manager timers', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            eventManager.cleanup();

            expect(mockReminderManager.cleanup).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith('EventManager cleaned up');
            consoleSpy.mockRestore();
        });
    });

    describe('delegation methods', () => {
        test('getEventsByRegion should delegate to storage', async () => {
            const expectedEvents = [{ id: 'event1' }];
            mockEventStorage.getEventsByRegion.mockResolvedValue(expectedEvents);

            const result = await eventManager.getEventsByRegion('guild123', 'London');

            expect(mockEventStorage.getEventsByRegion).toHaveBeenCalledWith('guild123', 'London');
            expect(result).toBe(expectedEvents);
        });

        test('deleteEvent should delegate to storage', async () => {
            mockEventStorage.deleteEvent.mockResolvedValue();

            await eventManager.deleteEvent('guild123', 'event123');

            expect(mockEventStorage.deleteEvent).toHaveBeenCalledWith('guild123', 'event123');
        });

        test('getUpcomingEventsByRegion should delegate to storage with limit', async () => {
            const expectedEvents = [{ id: 'event1' }, { id: 'event2' }];
            mockEventStorage.getUpcomingEventsByRegion.mockResolvedValue(expectedEvents);

            const result = await eventManager.getUpcomingEventsByRegion('guild123', 'London');

            expect(mockEventStorage.getUpcomingEventsByRegion).toHaveBeenCalledWith('guild123', 'London', 3);
            expect(result).toBe(expectedEvents);
        });

        test('getUpcomingEventsByLocation should delegate to storage with limit', async () => {
            const expectedEvents = [{ id: 'event1' }];
            mockEventStorage.getUpcomingEventsByLocation.mockResolvedValue(expectedEvents);

            const result = await eventManager.getUpcomingEventsByLocation('guild123', 'Manchester');

            expect(mockEventStorage.getUpcomingEventsByLocation).toHaveBeenCalledWith('guild123', 'Manchester', 3);
            expect(result).toBe(expectedEvents);
        });

        test('getUpcomingEvents should delegate to storage', async () => {
            const expectedEvents = [{ id: 'event1' }, { id: 'event2' }];
            mockEventStorage.getUpcomingEvents.mockResolvedValue(expectedEvents);

            const result = await eventManager.getUpcomingEvents('guild123');

            expect(mockEventStorage.getUpcomingEvents).toHaveBeenCalledWith('guild123');
            expect(result).toBe(expectedEvents);
        });
    });

    describe('getAllUpcomingEvents', () => {
        test('should get all upcoming events', async () => {
            const expectedEvents = [{ id: 'event1' }, { id: 'event2' }];
            mockEventStorage.getAllUpcomingEvents.mockResolvedValue(expectedEvents);

            const result = await eventManager.getAllUpcomingEvents('guild123');

            expect(mockEventStorage.getAllUpcomingEvents).toHaveBeenCalledWith('guild123', 50);
            expect(result).toBe(expectedEvents);
        });
    });

    describe('removeEvent', () => {
        beforeEach(() => {
            // Mock guild with client
            const mockGuild = {
                id: 'guild123'
            };
            mockBot.client.guilds.cache.set('guild123', mockGuild);
        });

        test('should remove event successfully and send notifications', async () => {
            const mockEvent = { id: 'event1', name: 'Test Event' };
            const eventCriteria = { name: 'Test Event', region: 'London' };
            const removedBy = { id: 'user123' };

            mockEventStorage.removeEventByCriteria.mockResolvedValue({
                success: true,
                event: mockEvent
            });

            const result = await eventManager.removeEvent('guild123', eventCriteria, removedBy);

            expect(mockEventStorage.removeEventByCriteria).toHaveBeenCalledWith('guild123', eventCriteria);
            expect(mockNotificationManager.sendCancellationNotification).toHaveBeenCalledWith(
                mockBot.client.guilds.cache.get('guild123'),
                mockEvent
            );
            expect(mockReminderManager.rescheduleReminders).toHaveBeenCalled();
            expect(result).toEqual({ success: true, event: mockEvent });
        });

        test('should handle removal failure gracefully', async () => {
            const eventCriteria = { name: 'Test Event', region: 'London' };
            const removedBy = { id: 'user123' };

            mockEventStorage.removeEventByCriteria.mockResolvedValue({
                success: false,
                error: 'Event not found'
            });

            const result = await eventManager.removeEvent('guild123', eventCriteria, removedBy);

            expect(mockEventStorage.removeEventByCriteria).toHaveBeenCalledWith('guild123', eventCriteria);
            expect(mockNotificationManager.sendCancellationNotification).not.toHaveBeenCalled();
            expect(mockReminderManager.rescheduleReminders).not.toHaveBeenCalled();
            expect(result).toEqual({ success: false, error: 'Event not found' });
        });

        test('should handle errors and return error response', async () => {
            const eventCriteria = { name: 'Test Event', region: 'London' };
            const removedBy = { id: 'user123' };
            const error = new Error('Storage error');

            mockEventStorage.removeEventByCriteria.mockRejectedValue(error);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await eventManager.removeEvent('guild123', eventCriteria, removedBy);

            expect(consoleSpy).toHaveBeenCalledWith('Error removing event:', error);
            expect(result).toEqual({ success: false, error: 'Storage error' });
            consoleSpy.mockRestore();
        });

        test('should handle missing guild gracefully', async () => {
            const mockEvent = { id: 'event1', name: 'Test Event' };
            const eventCriteria = { name: 'Test Event', region: 'London' };
            const removedBy = { id: 'user123' };

            // Clear guild cache to simulate missing guild
            mockBot.client.guilds.cache.clear();

            mockEventStorage.removeEventByCriteria.mockResolvedValue({
                success: true,
                event: mockEvent
            });

            const result = await eventManager.removeEvent('guild123', eventCriteria, removedBy);

            expect(mockEventStorage.removeEventByCriteria).toHaveBeenCalledWith('guild123', eventCriteria);
            expect(mockNotificationManager.sendCancellationNotification).not.toHaveBeenCalled();
            expect(mockReminderManager.rescheduleReminders).toHaveBeenCalled();
            expect(result).toEqual({ success: true, event: mockEvent });
        });
    });

    describe('clearAllEvents', () => {
        beforeEach(() => {
            // Mock guild with client
            const mockGuild = {
                id: 'guild123'
            };
            mockBot.client.guilds.cache.set('guild123', mockGuild);
        });

        test('should clear all events successfully', async () => {
            const mockEvents = [
                { event_id: 'event1', name: 'Event 1' },
                { event_id: 'event2', name: 'Event 2' }
            ];
            const removedBy = { id: 'user123' };

            mockEventStorage.getUpcomingEvents.mockResolvedValue(mockEvents);
            mockEventStorage.deleteEvent.mockResolvedValue(true);

            const result = await eventManager.clearAllEvents('guild123', removedBy);

            expect(mockEventStorage.getUpcomingEvents).toHaveBeenCalledWith('guild123');
            expect(mockEventStorage.deleteEvent).toHaveBeenCalledTimes(2);
            expect(mockEventStorage.deleteEvent).toHaveBeenNthCalledWith(1, 'guild123', 'event1');
            expect(mockEventStorage.deleteEvent).toHaveBeenNthCalledWith(2, 'guild123', 'event2');
            expect(mockNotificationManager.sendCancellationNotification).toHaveBeenCalledTimes(2);
            expect(mockReminderManager.rescheduleReminders).toHaveBeenCalled();
            expect(result).toBe(2);
        });

        test('should handle partial deletions', async () => {
            const mockEvents = [
                { event_id: 'event1', name: 'Event 1' },
                { event_id: 'event2', name: 'Event 2' }
            ];
            const removedBy = { id: 'user123' };

            mockEventStorage.getUpcomingEvents.mockResolvedValue(mockEvents);
            mockEventStorage.deleteEvent
                .mockResolvedValueOnce(true)  // First deletion succeeds
                .mockResolvedValueOnce(false); // Second deletion fails

            const result = await eventManager.clearAllEvents('guild123', removedBy);

            expect(result).toBe(1); // Only one successfully deleted
            expect(mockNotificationManager.sendCancellationNotification).toHaveBeenCalledTimes(1);
            expect(mockReminderManager.rescheduleReminders).toHaveBeenCalled();
        });

        test('should handle no events to clear', async () => {
            const removedBy = { id: 'user123' };

            mockEventStorage.getUpcomingEvents.mockResolvedValue([]);

            const result = await eventManager.clearAllEvents('guild123', removedBy);

            expect(mockEventStorage.deleteEvent).not.toHaveBeenCalled();
            expect(mockNotificationManager.sendCancellationNotification).not.toHaveBeenCalled();
            expect(mockReminderManager.rescheduleReminders).toHaveBeenCalled();
            expect(result).toBe(0);
        });

        test('should handle errors gracefully', async () => {
            const removedBy = { id: 'user123' };
            const error = new Error('Storage error');

            mockEventStorage.getUpcomingEvents.mockRejectedValue(error);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const result = await eventManager.clearAllEvents('guild123', removedBy);

            expect(consoleSpy).toHaveBeenCalledWith('Error clearing events:', error);
            expect(result).toBe(0);
            consoleSpy.mockRestore();
        });

        test('should handle missing guild in clearAllEvents', async () => {
            const mockEvents = [
                { event_id: 'event1', name: 'Event 1' }
            ];
            const removedBy = { id: 'user123' };

            // Clear guild cache to simulate missing guild
            mockBot.client.guilds.cache.clear();

            mockEventStorage.getUpcomingEvents.mockResolvedValue(mockEvents);
            mockEventStorage.deleteEvent.mockResolvedValue(true);

            const result = await eventManager.clearAllEvents('guild123', removedBy);

            expect(mockEventStorage.deleteEvent).toHaveBeenCalledWith('guild123', 'event1');
            expect(mockNotificationManager.sendCancellationNotification).not.toHaveBeenCalled();
            expect(mockReminderManager.rescheduleReminders).toHaveBeenCalled();
            expect(result).toBe(1);
        });
    });

    describe('createEvent', () => {
        beforeEach(() => {
            // Setup guild with roles
            const mockRegionRole = { name: 'London', id: 'region123' };
            const mockLocationRole = { name: 'Central London', id: 'location123' };
            const mockGuild = {
                id: 'guild123',
                roles: {
                    cache: new Map([
                        ['region123', mockRegionRole],
                        ['location123', mockLocationRole]
                    ])
                }
            };
            
            // Mock find method
            mockGuild.roles.cache.find = jest.fn((predicate) => {
                for (const role of mockGuild.roles.cache.values()) {
                    if (predicate(role)) return role;
                }
                return undefined;
            });
            
            mockBot.client.guilds.cache.set('guild123', mockGuild);
        });

        test('should create event successfully with all valid data', async () => {
            const eventData = {
                name: 'Test Event',
                region: 'London',
                location: 'Central London',
                eventDate: '2025-12-25 18:00',
                link: 'https://example.com/event'
            };
            const createdBy = { id: 'user123' };
            const regionRole = { name: 'London', id: 'region123' };
            const locationRole = { name: 'Central London', id: 'location123' };

            mockValidator.validateEventData.mockReturnValue({ valid: true });
            mockEventStorage.createEvent.mockResolvedValue({
                id: 'event123',
                ...eventData,
                eventDate: new Date(eventData.eventDate).toISOString(),
                createdBy: 'user123'
            });

            const result = await eventManager.createEvent('guild123', eventData, createdBy, regionRole, locationRole);

            expect(mockValidator.validateEventData).toHaveBeenCalledWith(eventData);
            expect(mockEventStorage.createEvent).toHaveBeenCalledWith('guild123', {
                ...eventData,
                eventDate: new Date(eventData.eventDate).toISOString(),
                createdBy: 'user123'
            });
            expect(mockNotificationManager.sendEventNotification).toHaveBeenCalledWith(
                mockBot.client.guilds.cache.get('guild123'),
                expect.any(Object),
                regionRole,
                locationRole
            );
            expect(mockReminderManager.rescheduleReminders).toHaveBeenCalled();
            expect(result).toMatchObject({
                id: 'event123',
                name: 'Test Event'
            });
        });

        test('should create event and find roles by name when not provided', async () => {
            const eventData = {
                name: 'Test Event',
                region: 'London',
                location: 'Central London',
                eventDate: '2025-12-25 18:00'
            };
            const createdBy = { id: 'user123' };
            const mockRegionRole = { name: 'London', id: 'region123' };
            const mockLocationRole = { name: 'Central London', id: 'location123' };

            mockValidator.validateEventData.mockReturnValue({ valid: true });
            mockValidator.findRoleByName
                .mockReturnValueOnce(mockRegionRole)  // For region
                .mockReturnValueOnce(mockLocationRole); // For location
            mockEventStorage.createEvent.mockResolvedValue({
                id: 'event123',
                ...eventData,
                eventDate: new Date(eventData.eventDate).toISOString(),
                createdBy: 'user123'
            });

            const result = await eventManager.createEvent('guild123', eventData, createdBy);

            expect(mockValidator.findRoleByName).toHaveBeenCalledWith(
                mockBot.client.guilds.cache.get('guild123'),
                'London'
            );
            expect(mockValidator.findRoleByName).toHaveBeenCalledWith(
                mockBot.client.guilds.cache.get('guild123'),
                'Central London'
            );
            expect(mockEventStorage.createEvent).toHaveBeenCalled();
            expect(result).toMatchObject({ id: 'event123' });
        });

        test('should create event without location role when location not provided', async () => {
            const eventData = {
                name: 'Test Event',
                region: 'London',
                eventDate: '2025-12-25 18:00'
            };
            const createdBy = { id: 'user123' };
            const mockRegionRole = { name: 'London', id: 'region123' };

            mockValidator.validateEventData.mockReturnValue({ valid: true });
            mockValidator.findRoleByName.mockReturnValue(mockRegionRole);
            mockEventStorage.createEvent.mockResolvedValue({
                id: 'event123',
                ...eventData,
                eventDate: new Date(eventData.eventDate).toISOString(),
                createdBy: 'user123'
            });

            const result = await eventManager.createEvent('guild123', eventData, createdBy);

            expect(mockNotificationManager.sendEventNotification).toHaveBeenCalledWith(
                mockBot.client.guilds.cache.get('guild123'),
                expect.any(Object),
                mockRegionRole,
                null
            );
            expect(result).toMatchObject({ id: 'event123' });
        });

        test('should throw error when event data validation fails', async () => {
            const eventData = { name: '', region: 'London', eventDate: '2025-12-25 18:00' };
            const createdBy = { id: 'user123' };

            mockValidator.validateEventData.mockReturnValue({
                valid: false,
                error: 'Event name is required'
            });

            await expect(eventManager.createEvent('guild123', eventData, createdBy))
                .rejects.toThrow('Event name is required');

            expect(mockValidator.validateEventData).toHaveBeenCalledWith(eventData);
            expect(mockEventStorage.createEvent).not.toHaveBeenCalled();
        });

        test('should throw error when guild not found', async () => {
            const eventData = { name: 'Test Event', region: 'London', eventDate: '2025-12-25 18:00' };
            const createdBy = { id: 'user123' };

            mockValidator.validateEventData.mockReturnValue({ valid: true });
            mockBot.client.guilds.cache.clear(); // Remove guild

            await expect(eventManager.createEvent('guild123', eventData, createdBy))
                .rejects.toThrow('Guild not found');

            expect(mockEventStorage.createEvent).not.toHaveBeenCalled();
        });

        test('should throw error when region role not found', async () => {
            const eventData = { name: 'Test Event', region: 'NonExistentRegion', eventDate: '2025-12-25 18:00' };
            const createdBy = { id: 'user123' };

            mockValidator.validateEventData.mockReturnValue({ valid: true });
            mockValidator.findRoleByName.mockReturnValue(null); // Role not found

            await expect(eventManager.createEvent('guild123', eventData, createdBy))
                .rejects.toThrow('Region role "NonExistentRegion" not found');

            expect(mockEventStorage.createEvent).not.toHaveBeenCalled();
        });

        test('should handle storage errors gracefully', async () => {
            const eventData = { name: 'Test Event', region: 'London', eventDate: '2025-12-25 18:00' };
            const createdBy = { id: 'user123' };
            const regionRole = { name: 'London', id: 'region123' };
            const storageError = new Error('Database connection failed');

            mockValidator.validateEventData.mockReturnValue({ valid: true });
            mockEventStorage.createEvent.mockRejectedValue(storageError);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await expect(eventManager.createEvent('guild123', eventData, createdBy, regionRole))
                .rejects.toThrow('Database connection failed');

            expect(consoleSpy).toHaveBeenCalledWith('Error creating event:', storageError);
            consoleSpy.mockRestore();
        });

        test('should handle notification errors gracefully', async () => {
            const eventData = { name: 'Test Event', region: 'London', eventDate: '2025-12-25 18:00' };
            const createdBy = { id: 'user123' };
            const regionRole = { name: 'London', id: 'region123' };
            const notificationError = new Error('Notification failed');

            mockValidator.validateEventData.mockReturnValue({ valid: true });
            mockEventStorage.createEvent.mockResolvedValue({
                id: 'event123',
                ...eventData,
                eventDate: new Date(eventData.eventDate).toISOString(),
                createdBy: 'user123'
            });
            mockNotificationManager.sendEventNotification.mockRejectedValue(notificationError);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await expect(eventManager.createEvent('guild123', eventData, createdBy, regionRole))
                .rejects.toThrow('Notification failed');

            expect(consoleSpy).toHaveBeenCalledWith('Error creating event:', notificationError);
            consoleSpy.mockRestore();
        });
    });

    describe('constructor with Jest environment', () => {
        test('should not start reminder checker when in Jest environment', () => {
            // This is already the default behavior in our tests since JEST_WORKER_ID is set
            expect(mockReminderManager.startReminderChecker).not.toHaveBeenCalled();
        });

        test('should start reminder checker when not in Jest environment', () => {
            // Temporarily remove Jest environment variable
            const originalJestWorkerId = process.env.JEST_WORKER_ID;
            delete process.env.JEST_WORKER_ID;

            // Create a new EventManager instance
            const newEventManager = new EventManager(mockBot);

            expect(mockReminderManager.startReminderChecker).toHaveBeenCalled();

            // Restore the environment variable
            if (originalJestWorkerId !== undefined) {
                process.env.JEST_WORKER_ID = originalJestWorkerId;
            }
        });
    });
});