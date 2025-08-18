const EventManager = require('../../src/EventManager');
const EventStorage = require('../../src/EventStorage');

// Mock EventStorage
jest.mock('../../src/EventStorage');

// Use Jest fake timers for timer control
jest.useFakeTimers();

describe('EventManager (Basic)', () => {
    let eventManager;
    let mockBot;
    let mockEventStorage;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        jest.clearAllTimers();

        // Create mock EventStorage instance
        mockEventStorage = {
            createEvent: jest.fn(),
            getUpcomingEvents: jest.fn(),
            updateReminderStatus: jest.fn(),
            getEventsByRegion: jest.fn(),
            getUpcomingEventsByRegion: jest.fn(),
            getUpcomingEventsByLocation: jest.fn(),
            deleteEvent: jest.fn()
        };

        // Mock EventStorage constructor
        EventStorage.mockImplementation(() => mockEventStorage);

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

        test('should throw error when reminder intervals not configured', () => {
            const badMockBot = {
                ...mockBot,
                getReminderIntervals: jest.fn().mockReturnValue(null)
            };

            expect(() => new EventManager(badMockBot))
                .toThrow('Reminder intervals not configured in bot');
        });
    });

    describe('validateEventData', () => {
        test('should validate correct event data', () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const validData = {
                name: 'Test Event',
                region: 'London',
                eventDate: futureDate.toISOString().substring(0, 16).replace('T', ' ')
            };

            const result = eventManager.validateEventData(validData);
            expect(result.valid).toBe(true);
        });

        test('should reject empty name', () => {
            const invalidData = {
                name: '',
                region: 'London',
                eventDate: '2024-12-25 18:00'
            };

            const result = eventManager.validateEventData(invalidData);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Event name is required');
        });

        test('should reject missing region', () => {
            const invalidData = {
                name: 'Test Event',
                eventDate: '2024-12-25 18:00'
            };

            const result = eventManager.validateEventData(invalidData);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Region is required');
        });

        test('should reject missing date', () => {
            const invalidData = {
                name: 'Test Event',
                region: 'London'
            };

            const result = eventManager.validateEventData(invalidData);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Event date is required');
        });
    });

    describe('formatIntervalTime', () => {
        test('should format days correctly', () => {
            const threeDays = 3 * 24 * 60 * 60 * 1000;
            expect(eventManager.formatIntervalTime(threeDays)).toBe('3 days before event');
            expect(eventManager.formatIntervalTime(threeDays, true)).toBe('3 days after creation');
        });

        test('should format hours correctly', () => {
            const twoHours = 2 * 60 * 60 * 1000;
            expect(eventManager.formatIntervalTime(twoHours)).toBe('2 hours before event');
        });

        test('should format minutes correctly', () => {
            const thirtyMinutes = 30 * 60 * 1000;
            expect(eventManager.formatIntervalTime(thirtyMinutes)).toBe('30 mins before event');
        });
    });

    describe('cleanup', () => {
        test('should clean up all timers', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            eventManager.cleanup();

            expect(consoleSpy).toHaveBeenCalledWith('EventManager timers cleaned up');
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
    });
});