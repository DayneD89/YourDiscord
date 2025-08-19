const EventReminderManager = require('../../src/managers/EventReminderManager');

describe('EventReminderManager - Coverage Tests', () => {
    let manager;
    let mockBot;
    let mockStorage;
    let mockEventManager;

    beforeEach(() => {
        jest.useFakeTimers();
        
        mockEventManager = {
            notificationManager: {
                sendEventReminder: jest.fn().mockResolvedValue()
            }
        };

        mockStorage = {
            getUpcomingEvents: jest.fn().mockResolvedValue([]),
            updateReminderStatus: jest.fn().mockResolvedValue()
        };

        mockBot = {
            getGuildId: jest.fn().mockReturnValue('guild123'),
            getReminderIntervals: jest.fn().mockReturnValue({
                weekReminder: 7 * 24 * 60 * 60 * 1000,
                dayReminder: 24 * 60 * 60 * 1000
            }),
            eventManager: mockEventManager
        };

        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();

        manager = new EventReminderManager(mockBot, mockStorage);
    });

    afterEach(() => {
        if (manager) {
            manager.cleanup();
        }
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('scheduleNextReminder - error and edge cases', () => {
        it('should handle storage errors gracefully', async () => {
            mockStorage.getUpcomingEvents.mockRejectedValue(new Error('Database error'));

            await manager.scheduleNextReminder();

            expect(console.error).toHaveBeenCalledWith(
                'Error scheduling next reminder:',
                expect.any(Error)
            );
            // Should set fallback timeout
            expect(manager.nextReminderTimeout).toBeTruthy();
        });

        it('should handle no upcoming events', async () => {
            mockStorage.getUpcomingEvents.mockResolvedValue([]);

            await manager.scheduleNextReminder();

            expect(console.log).toHaveBeenCalledWith('🔔 No upcoming events - scheduling check in 1 hour');
            expect(manager.nextReminderTimeout).toBeTruthy();
        });

        it('should handle events with no qualifying reminders', async () => {
            const event = {
                name: 'Completed Event',
                event_date: new Date('2025-01-02T12:00:00Z').toISOString(),
                reminder_status: 'day_sent', // All reminders already sent
                created_at: new Date('2025-01-01T12:00:00Z').toISOString(),
                event_id: 'event1',
                guild_id: 'guild123'
            };

            mockStorage.getUpcomingEvents.mockResolvedValue([event]);

            await manager.scheduleNextReminder();

            expect(console.log).toHaveBeenCalledWith('🔔 No upcoming reminders - checking again in 1 hour');
            expect(manager.nextReminderTimeout).toBeTruthy();
        });
    });

    describe('constructor edge cases', () => {
        it('should throw error when reminder intervals not configured', () => {
            const badBot = {
                ...mockBot,
                getReminderIntervals: jest.fn().mockReturnValue(null)
            };

            expect(() => {
                new EventReminderManager(badBot, mockStorage);
            }).toThrow('Reminder intervals not configured in bot');
        });
    });

    describe('processEventReminder edge cases', () => {
        const mockEvent = {
            name: 'Test Event',
            event_date: new Date('2025-01-02T12:00:00Z').toISOString(),
            reminder_status: 'pending',
            guild_id: 'guild123',
            event_id: 'event123'
        };

        beforeEach(() => {
            jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-01T12:00:00Z').getTime());
        });

        it('should handle unknown reminder status gracefully', async () => {
            const eventWithUnknownStatus = {
                ...mockEvent,
                reminder_status: 'unknown_status'
            };

            await manager.processEventReminder(eventWithUnknownStatus);

            expect(mockEventManager.notificationManager.sendEventReminder).not.toHaveBeenCalled();
            expect(mockStorage.updateReminderStatus).not.toHaveBeenCalled();
        });

        it('should handle notification errors and still update status', async () => {
            mockEventManager.notificationManager.sendEventReminder.mockRejectedValue(new Error('Send failed'));

            await manager.processEventReminder(mockEvent);

            expect(console.error).toHaveBeenCalledWith(
                'Error processing reminder for event event123:',
                expect.any(Error)
            );
        });

        it('should handle storage update errors', async () => {
            mockStorage.updateReminderStatus.mockRejectedValue(new Error('Update failed'));

            await manager.processEventReminder(mockEvent);

            expect(console.error).toHaveBeenCalledWith(
                'Error processing reminder for event event123:',
                expect.any(Error)
            );
        });
    });
});