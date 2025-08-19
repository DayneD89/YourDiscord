const EventReminderManager = require('../../src/managers/EventReminderManager');

describe('EventReminderManager', () => {
  let eventReminderManager;
  let mockBot;
  let mockStorage;
  let mockEventManager;

  beforeEach(() => {
    // Use fake timers to prevent real timeouts
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
        weekReminder: 7 * 24 * 60 * 60 * 1000, // 7 days
        dayReminder: 24 * 60 * 60 * 1000       // 1 day
      }),
      eventManager: mockEventManager
    };

    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    eventReminderManager = new EventReminderManager(mockBot, mockStorage);
  });

  afterEach(() => {
    // Cleanup any remaining timers
    if (eventReminderManager) {
      eventReminderManager.cleanup();
    }
    
    // Clear all timers and restore
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with bot and storage references', () => {
      expect(eventReminderManager.bot).toBe(mockBot);
      expect(eventReminderManager.storage).toBe(mockStorage);
      expect(eventReminderManager.reminderIntervals).toEqual({
        weekReminder: 7 * 24 * 60 * 60 * 1000,
        dayReminder: 24 * 60 * 60 * 1000
      });
    });

    it('should throw error when reminder intervals not configured', () => {
      mockBot.getReminderIntervals.mockReturnValue(null);

      expect(() => {
        new EventReminderManager(mockBot, mockStorage);
      }).toThrow('Reminder intervals not configured in bot');
    });

    it('should log initialization with interval details', () => {
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('EventReminderManager initialized with intervals: 10080min, 1440min')
      );
    });
  });

  describe('startReminderChecker', () => {
    it('should log start messages', () => {
      eventReminderManager.startReminderChecker();

      expect(console.log).toHaveBeenCalledWith('Starting dynamic reminder system...');
      expect(console.log).toHaveBeenCalledWith('Dynamic reminder system started');
    });

  });

  describe('scheduleNextReminder', () => {
    beforeEach(() => {
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-01-01T12:00:00Z').getTime());
    });

    it('should handle no upcoming events', async () => {
      mockStorage.getUpcomingEvents.mockResolvedValue([]);

      await eventReminderManager.scheduleNextReminder();

      expect(console.log).toHaveBeenCalledWith('🔔 No upcoming events - scheduling check in 1 hour');
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.getUpcomingEvents.mockRejectedValue(new Error('Storage error'));

      await eventReminderManager.scheduleNextReminder();

      expect(console.error).toHaveBeenCalledWith('Error scheduling next reminder:', expect.any(Error));
    });

    it('should handle events that need scheduling', async () => {
      const eventDate = new Date('2025-01-15T12:00:00Z'); // Future event
      const mockEvent = {
        name: 'Future Event',
        event_date: eventDate.toISOString(),
        reminder_status: 'pending',
        created_at: new Date('2024-12-25T12:00:00Z').toISOString()
      };

      mockStorage.getUpcomingEvents.mockResolvedValue([mockEvent]);

      await eventReminderManager.scheduleNextReminder();

      // Should log about scheduling
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Next reminder scheduled')
      );
    });

    it('should handle events with complex timing logic', async () => {
      const events = [
        {
          name: 'Event 1',
          event_date: new Date('2025-01-15T12:00:00Z').toISOString(),
          reminder_status: 'pending',
          created_at: new Date('2024-12-25T12:00:00Z').toISOString()
        },
        {
          name: 'Event 2',
          event_date: new Date('2025-01-05T12:00:00Z').toISOString(),
          reminder_status: 'week_sent',
          created_at: new Date('2024-12-25T12:00:00Z').toISOString()
        }
      ];

      mockStorage.getUpcomingEvents.mockResolvedValue(events);

      await eventReminderManager.scheduleNextReminder();

      // Should process or schedule something
      expect(mockStorage.getUpcomingEvents).toHaveBeenCalledWith('guild123');
    });

    it('should handle no upcoming reminders', async () => {
      const mockEvent = {
        name: 'Completed Event',
        event_date: new Date('2025-01-02T12:00:00Z').toISOString(),
        reminder_status: 'day_sent', // All reminders sent
        created_at: new Date('2024-12-25T12:00:00Z').toISOString()
      };

      mockStorage.getUpcomingEvents.mockResolvedValue([mockEvent]);

      await eventReminderManager.scheduleNextReminder();

      expect(console.log).toHaveBeenCalledWith('🔔 No upcoming reminders - checking again in 1 hour');
    });

  });

  describe('rescheduleReminders', () => {
    it('should reschedule immediately', async () => {
      const scheduleNextSpy = jest.spyOn(eventReminderManager, 'scheduleNextReminder').mockImplementation();
      
      eventReminderManager.rescheduleReminders();

      // Run all pending setImmediate callbacks
      await jest.runOnlyPendingTimersAsync();
      
      expect(scheduleNextSpy).toHaveBeenCalled();
    });

  });

  describe('processEventReminder', () => {
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

    it('should send week reminder for pending events', async () => {
      await eventReminderManager.processEventReminder(mockEvent);

      expect(mockEventManager.notificationManager.sendEventReminder).toHaveBeenCalledWith(
        mockEvent,
        'week',
        7 * 24 * 60 * 60 * 1000,
        false
      );
      expect(mockStorage.updateReminderStatus).toHaveBeenCalledWith('guild123', 'event123', 'week_sent');
      expect(console.log).toHaveBeenCalledWith('📅 Sending week reminder for event: Test Event');
    });

    it('should send day reminder for week_sent events', async () => {
      const weekSentEvent = { ...mockEvent, reminder_status: 'week_sent' };

      await eventReminderManager.processEventReminder(weekSentEvent);

      expect(mockEventManager.notificationManager.sendEventReminder).toHaveBeenCalledWith(
        weekSentEvent,
        'day',
        24 * 60 * 60 * 1000,
        false
      );
      expect(mockStorage.updateReminderStatus).toHaveBeenCalledWith('guild123', 'event123', 'day_sent');
      expect(console.log).toHaveBeenCalledWith('📅 Sending day reminder for event: Test Event');
    });

    it('should skip events with day_sent status', async () => {
      const completedEvent = { ...mockEvent, reminder_status: 'day_sent' };

      await eventReminderManager.processEventReminder(completedEvent);

      expect(mockEventManager.notificationManager.sendEventReminder).not.toHaveBeenCalled();
      expect(mockStorage.updateReminderStatus).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      mockEventManager.notificationManager.sendEventReminder.mockRejectedValue(new Error('Send failed'));

      await eventReminderManager.processEventReminder(mockEvent);

      expect(console.error).toHaveBeenCalledWith(
        'Error processing reminder for event event123:',
        expect.any(Error)
      );
    });

    it('should handle storage update errors gracefully', async () => {
      mockStorage.updateReminderStatus.mockRejectedValue(new Error('Update failed'));

      await eventReminderManager.processEventReminder(mockEvent);

      expect(console.error).toHaveBeenCalledWith(
        'Error processing reminder for event event123:',
        expect.any(Error)
      );
    });
  });

  describe('formatIntervalTime', () => {
    it('should format days correctly', () => {
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      
      expect(eventReminderManager.formatIntervalTime(threeDays)).toBe('3 days before event');
      expect(eventReminderManager.formatIntervalTime(threeDays, true)).toBe('3 days after creation');
    });

    it('should format single day correctly', () => {
      const oneDay = 24 * 60 * 60 * 1000;
      
      expect(eventReminderManager.formatIntervalTime(oneDay)).toBe('1 day before event');
    });

    it('should format hours correctly', () => {
      const fiveHours = 5 * 60 * 60 * 1000;
      
      expect(eventReminderManager.formatIntervalTime(fiveHours)).toBe('5 hours before event');
      expect(eventReminderManager.formatIntervalTime(fiveHours, true)).toBe('5 hours after creation');
    });

    it('should format single hour correctly', () => {
      const oneHour = 60 * 60 * 1000;
      
      expect(eventReminderManager.formatIntervalTime(oneHour)).toBe('1 hour before event');
    });

    it('should format minutes correctly', () => {
      const thirtyMinutes = 30 * 60 * 1000;
      
      expect(eventReminderManager.formatIntervalTime(thirtyMinutes)).toBe('30 mins before event');
      expect(eventReminderManager.formatIntervalTime(thirtyMinutes, true)).toBe('30 mins after creation');
    });

    it('should format single minute correctly', () => {
      const oneMinute = 60 * 1000;
      
      expect(eventReminderManager.formatIntervalTime(oneMinute)).toBe('1 min before event');
    });

    it('should format seconds correctly', () => {
      const fortyFiveSeconds = 45 * 1000;
      
      expect(eventReminderManager.formatIntervalTime(fortyFiveSeconds)).toBe('45 secs before event');
      expect(eventReminderManager.formatIntervalTime(fortyFiveSeconds, true)).toBe('45 secs after creation');
    });

    it('should format single second correctly', () => {
      const oneSecond = 1000;
      
      expect(eventReminderManager.formatIntervalTime(oneSecond)).toBe('1 sec before event');
    });

    it('should handle negative intervals', () => {
      const negativeInterval = -2 * 60 * 60 * 1000; // -2 hours
      
      expect(eventReminderManager.formatIntervalTime(negativeInterval)).toBe('2 hours before event');
    });

    it('should handle zero interval', () => {
      expect(eventReminderManager.formatIntervalTime(0)).toBe('0 secs before event');
    });
  });

  describe('cleanup', () => {
    it('should clear all timers and log cleanup', () => {
      eventReminderManager.cleanup();

      expect(eventReminderManager.reminderTimer).toBeNull();
      expect(eventReminderManager.initialCheckTimer).toBeNull();
      expect(eventReminderManager.nextReminderTimeout).toBeNull();
      expect(console.log).toHaveBeenCalledWith('EventReminderManager timers cleaned up');
    });

    it('should handle null timers gracefully', () => {
      eventReminderManager.reminderTimer = null;
      eventReminderManager.initialCheckTimer = null;
      eventReminderManager.nextReminderTimeout = null;

      expect(() => eventReminderManager.cleanup()).not.toThrow();
      expect(console.log).toHaveBeenCalledWith('EventReminderManager timers cleaned up');
    });

  });

});