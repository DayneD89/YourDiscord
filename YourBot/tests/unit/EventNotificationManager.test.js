const EventNotificationManager = require('../../src/managers/EventNotificationManager');

describe('EventNotificationManager', () => {
  let eventNotificationManager;
  let mockBot;
  let mockGuild;
  let mockRegionChannel;
  let mockLocationChannel;

  beforeEach(() => {
    mockRegionChannel = {
      name: 'regional-london',
      type: 0,
      send: jest.fn().mockResolvedValue({ id: 'msg123' })
    };

    mockLocationChannel = {
      name: 'local-central-london',
      type: 0,
      send: jest.fn().mockResolvedValue({ id: 'msg456' })
    };

    mockGuild = {
      id: 'guild123',
      channels: {
        cache: new Map([
          ['channel1', mockRegionChannel],
          ['channel2', mockLocationChannel],
          ['channel3', { name: 'local-other-area', type: 0 }],
          ['channel4', { name: 'general', type: 0 }]
        ])
      }
    };

    // Add find method to the mock Map
    mockGuild.channels.cache.find = function(predicate) {
      for (const [key, value] of this) {
        if (predicate(value)) {
          return value;
        }
      }
      return undefined;
    };

    // Add filter method to the mock Map
    mockGuild.channels.cache.filter = function(predicate) {
      const result = [];
      for (const [key, value] of this) {
        if (predicate(value)) {
          result.push(value);
        }
      }
      return result;
    };

    mockBot = {
      client: {
        guilds: {
          cache: new Map([['guild123', mockGuild]])
        }
      }
    };

    mockBot.client.guilds.cache.get = jest.fn().mockReturnValue(mockGuild);

    eventNotificationManager = new EventNotificationManager(mockBot);
  });

  describe('constructor', () => {
    it('should initialize with bot reference', () => {
      expect(eventNotificationManager.bot).toBe(mockBot);
    });
  });

  describe('sendEventNotification', () => {
    const mockEvent = {
      name: 'Community Meeting',
      event_date: '2025-01-15T19:00:00Z',
      region: 'London',
      location: 'Central London',
      description: 'Monthly community gathering',
      link: 'https://example.com/event',
      created_by: 'user123'
    };

    it('should send notification to regional channel', async () => {
      const regionRole = '<@&role123>';
      const locationRole = '<@&role456>';

      await eventNotificationManager.sendEventNotification(mockGuild, mockEvent, regionRole, locationRole);

      expect(mockRegionChannel.send).toHaveBeenCalledWith({
        content: '<@&role123> - New event in your region!',
        embeds: [{
          title: '🎉 New Regional Event',
          description: expect.stringContaining('Community Meeting'),
          color: 0x00ff00,
          timestamp: expect.any(String)
        }]
      });
    });

    it('should send notification to location channel when location exists', async () => {
      const regionRole = '<@&role123>';
      const locationRole = '<@&role456>';

      await eventNotificationManager.sendEventNotification(mockGuild, mockEvent, regionRole, locationRole);

      expect(mockLocationChannel.send).toHaveBeenCalledWith({
        content: '<@&role456> - New event in your area!',
        embeds: [{
          title: '🎉 New Local Event',
          description: expect.stringContaining('Community Meeting'),
          color: 0x00ff00,
          timestamp: expect.any(String)
        }]
      });
    });

    it('should handle event without location', async () => {
      const eventNoLocation = { ...mockEvent };
      delete eventNoLocation.location;
      
      const regionRole = '<@&role123>';

      await eventNotificationManager.sendEventNotification(mockGuild, eventNoLocation, regionRole, null);

      expect(mockRegionChannel.send).toHaveBeenCalled();
      expect(mockLocationChannel.send).not.toHaveBeenCalled();
    });

    it('should handle missing regional channel', async () => {
      // Remove regional channel
      mockGuild.channels.cache.delete('channel1');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await eventNotificationManager.sendEventNotification(mockGuild, mockEvent, '<@&role123>', '<@&role456>');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NOT FOUND'));
      consoleSpy.mockRestore();
    });

    it('should handle missing location channel', async () => {
      // Remove location channel
      mockGuild.channels.cache.delete('channel2');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await eventNotificationManager.sendEventNotification(mockGuild, mockEvent, '<@&role123>', '<@&role456>');

      expect(mockRegionChannel.send).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('NOT FOUND'));
      consoleSpy.mockRestore();
    });

    it('should handle channel send errors gracefully', async () => {
      mockRegionChannel.send.mockRejectedValue(new Error('Send failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await eventNotificationManager.sendEventNotification(mockGuild, mockEvent, '<@&role123>', '<@&role456>');

      expect(consoleSpy).toHaveBeenCalledWith('Error sending event notification:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle events with slashes in location names', async () => {
      const eventWithSlashes = {
        ...mockEvent,
        location: 'North/South London'
      };

      // Add channel with dashes instead of slashes
      const slashLocationChannel = {
        name: 'local-north-south-london',
        type: 0,
        send: jest.fn().mockResolvedValue({ id: 'msg789' })
      };
      
      mockGuild.channels.cache.set('channel5', slashLocationChannel);

      await eventNotificationManager.sendEventNotification(mockGuild, eventWithSlashes, '<@&role123>', '<@&role456>');

      expect(slashLocationChannel.send).toHaveBeenCalled();
    });
  });

  describe('sendEventReminder', () => {
    const mockEvent = {
      name: 'Community Meeting',
      event_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      region: 'London',
      location: 'Central London',
      description: 'Monthly community gathering',
      link: 'https://example.com/event',
      created_by: 'user123',
      guild_id: 'guild123'
    };

    it('should send week reminder', async () => {
      await eventNotificationManager.sendEventReminder(mockEvent, 'week', 7 * 24 * 60 * 60 * 1000);

      expect(mockRegionChannel.send).toHaveBeenCalledWith({
        embeds: [{
          title: '📅 Event Reminder - One Week',
          description: expect.stringContaining('Community Meeting'),
          color: 0xffff00,
          timestamp: expect.any(String)
        }]
      });
    });

    it('should send day reminder', async () => {
      await eventNotificationManager.sendEventReminder(mockEvent, 'day', 24 * 60 * 60 * 1000);

      expect(mockRegionChannel.send).toHaveBeenCalledWith({
        embeds: [{
          title: '⏰ Event Reminder - Tomorrow',
          description: expect.stringContaining('Community Meeting'),
          color: 0xff9900,
          timestamp: expect.any(String)
        }]
      });
    });

    it('should send soon reminder', async () => {
      await eventNotificationManager.sendEventReminder(mockEvent, 'soon', 60 * 60 * 1000);

      expect(mockRegionChannel.send).toHaveBeenCalledWith({
        embeds: [{
          title: '🚨 Event Starting Soon',
          description: expect.stringContaining('Community Meeting'),
          color: 0xff0000,
          timestamp: expect.any(String)
        }]
      });
    });

    it('should send generic reminder for unknown types', async () => {
      await eventNotificationManager.sendEventReminder(mockEvent, 'custom', 60 * 60 * 1000);

      expect(mockRegionChannel.send).toHaveBeenCalledWith({
        embeds: [{
          title: '📅 Event Reminder',
          description: expect.stringContaining('Community Meeting'),
          color: 0x0099ff,
          timestamp: expect.any(String)
        }]
      });
    });

    it('should send reminder to both regional and location channels', async () => {
      await eventNotificationManager.sendEventReminder(mockEvent, 'day', 24 * 60 * 60 * 1000);

      expect(mockRegionChannel.send).toHaveBeenCalled();
      expect(mockLocationChannel.send).toHaveBeenCalled();
    });

    it('should handle missing guild', async () => {
      mockBot.client.guilds.cache.get.mockReturnValue(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await eventNotificationManager.sendEventReminder(mockEvent, 'day', 24 * 60 * 60 * 1000);

      expect(consoleSpy).toHaveBeenCalledWith('Guild guild123 not found for reminder');
      consoleSpy.mockRestore();
    });

    it('should handle reminder send errors', async () => {
      mockRegionChannel.send.mockRejectedValue(new Error('Send failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await eventNotificationManager.sendEventReminder(mockEvent, 'day', 24 * 60 * 60 * 1000);

      expect(consoleSpy).toHaveBeenCalledWith('Error sending day reminder:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle isAfterCreation flag', async () => {
      await eventNotificationManager.sendEventReminder(mockEvent, 'day', 24 * 60 * 60 * 1000, true);

      expect(mockRegionChannel.send).toHaveBeenCalledWith({
        embeds: [{
          title: '⏰ Event Reminder - Tomorrow',
          description: expect.stringContaining('Starting in'),
          color: 0xff9900,
          timestamp: expect.any(String)
        }]
      });
    });
  });

  describe('formatEventMessage', () => {
    it('should format complete event message', () => {
      const event = {
        name: 'Community Meeting',
        event_date: '2025-01-15T19:00:00Z',
        region: 'London',
        location: 'Central London',
        description: 'Monthly community gathering',
        link: 'https://example.com/event',
        created_by: 'user123'
      };

      const result = eventNotificationManager.formatEventMessage(event);

      expect(result).toContain('🎉 **New Event Added!**');
      expect(result).toContain('Community Meeting');
      expect(result).toContain('London');
      expect(result).toContain('Central London');
      expect(result).toContain('Monthly community gathering');
      expect(result).toContain('https://example.com/event');
      expect(result).toContain('<@user123>');
      expect(result).toContain('React with ✅');
    });

    it('should format event message without optional fields', () => {
      const event = {
        name: 'Simple Event',
        event_date: '2025-01-15T19:00:00Z',
        region: 'Manchester',
        created_by: 'user456'
      };

      const result = eventNotificationManager.formatEventMessage(event);

      expect(result).toContain('Simple Event');
      expect(result).toContain('Manchester');
      expect(result).toContain('<@user456>');
      expect(result).not.toContain('🏘️ **Location:**');
      expect(result).not.toContain('📝 **Description:**');
      expect(result).not.toContain('🔗 **Link:**');
    });

    it('should format date correctly', () => {
      const event = {
        name: 'Test Event',
        event_date: '2025-01-15T19:30:00Z',
        region: 'London',
        created_by: 'user123'
      };

      const result = eventNotificationManager.formatEventMessage(event);

      // Check for essential date components (handles comma formatting differences between OS)
      expect(result).toContain('Wednesday');
      expect(result).toContain('15 January 2025');
      expect(result).toContain('19:30');
    });
  });

  describe('formatReminderMessage', () => {
    it('should format reminder message without isAfterCreation flag', () => {
      const event = {
        name: 'Community Meeting',
        event_date: '2025-01-15T19:00:00Z',
        region: 'London',
        location: 'Central London',
        description: 'Monthly gathering',
        link: 'https://example.com/event',
        created_by: 'user123'
      };

      const result = eventNotificationManager.formatReminderMessage(event, '2 days', false);

      expect(result).toContain('Community Meeting');
      expect(result).toContain('⏰ **2 days**');
      expect(result).not.toContain('Starting in');
    });

    it('should format reminder message with isAfterCreation flag', () => {
      const event = {
        name: 'Community Meeting',
        event_date: '2025-01-15T19:00:00Z',
        region: 'London',
        created_by: 'user123'
      };

      const result = eventNotificationManager.formatReminderMessage(event, '2 days', true);

      expect(result).toContain('⏰ **Starting in 2 days**');
    });

    it('should handle event without optional fields', () => {
      const event = {
        name: 'Simple Event',
        event_date: '2025-01-15T19:00:00Z',
        region: 'Manchester',
        created_by: 'user456'
      };

      const result = eventNotificationManager.formatReminderMessage(event, '1 day', false);

      expect(result).toContain('Simple Event');
      expect(result).toContain('Manchester');
      expect(result).not.toContain('🏘️ **Location:**');
      expect(result).not.toContain('📝 **Description:**');
      expect(result).not.toContain('🔗 **Link:**');
    });
  });

  describe('getTimeUntilEvent', () => {
    it('should calculate days and hours correctly', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const eventDate = new Date('2025-01-03T15:00:00Z'); // 2 days 3 hours later

      const result = eventNotificationManager.getTimeUntilEvent(eventDate, now);

      expect(result).toBe('2 days and 3 hours');
    });

    it('should calculate hours and minutes correctly', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const eventDate = new Date('2025-01-01T15:30:00Z'); // 3 hours 30 minutes later

      const result = eventNotificationManager.getTimeUntilEvent(eventDate, now);

      expect(result).toBe('3 hours and 30 minutes');
    });

    it('should calculate minutes only', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const eventDate = new Date('2025-01-01T12:45:00Z'); // 45 minutes later

      const result = eventNotificationManager.getTimeUntilEvent(eventDate, now);

      expect(result).toBe('45 minutes');
    });

    it('should handle single units correctly', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const eventDate = new Date('2025-01-02T13:01:00Z'); // 1 day 1 hour 1 minute later

      const result = eventNotificationManager.getTimeUntilEvent(eventDate, now);

      expect(result).toBe('1 day and 1 hour');
    });

    it('should return "Event has started" for past events', () => {
      const now = new Date('2025-01-01T12:00:00Z');
      const eventDate = new Date('2025-01-01T11:00:00Z'); // 1 hour ago

      const result = eventNotificationManager.getTimeUntilEvent(eventDate, now);

      expect(result).toBe('Event has started');
    });

    it('should use current time when now parameter not provided', () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now

      const result = eventNotificationManager.getTimeUntilEvent(futureDate);

      expect(result).toMatch(/2 hours?/);
    });
  });

  describe('sendCancellationNotification', () => {
    const mockEvent = {
      name: 'Cancelled Meeting',
      event_date: '2025-01-15T19:00:00Z',
      region: 'London',
      location: 'Central London',
      created_by: 'user123'
    };

    it('should send cancellation notification to both channels', async () => {
      await eventNotificationManager.sendCancellationNotification(mockGuild, mockEvent);

      expect(mockRegionChannel.send).toHaveBeenCalledWith({
        embeds: [{
          title: '❌ Event Cancelled',
          description: expect.stringContaining('Cancelled Meeting'),
          color: 0xff0000,
          timestamp: expect.any(String)
        }]
      });

      expect(mockLocationChannel.send).toHaveBeenCalledWith({
        embeds: [{
          title: '❌ Event Cancelled',
          description: expect.stringContaining('Cancelled Meeting'),
          color: 0xff0000,
          timestamp: expect.any(String)
        }]
      });
    });

    it('should handle event without location', async () => {
      const eventNoLocation = { ...mockEvent };
      delete eventNoLocation.location;

      await eventNotificationManager.sendCancellationNotification(mockGuild, eventNoLocation);

      expect(mockRegionChannel.send).toHaveBeenCalled();
      expect(mockLocationChannel.send).not.toHaveBeenCalled();
    });

    it('should handle cancellation send errors gracefully', async () => {
      mockRegionChannel.send.mockRejectedValue(new Error('Send failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await eventNotificationManager.sendCancellationNotification(mockGuild, mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Error sending cancellation notification:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should log successful cancellation', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await eventNotificationManager.sendCancellationNotification(mockGuild, mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Cancellation notification sent for: Cancelled Meeting');
      consoleSpy.mockRestore();
    });
  });

  describe('formatCancellationMessage', () => {
    it('should format cancellation message correctly', () => {
      const event = {
        name: 'Cancelled Event',
        event_date: '2025-01-15T19:00:00Z',
        region: 'London',
        location: 'Central London',
        created_by: 'user123'
      };

      const result = eventNotificationManager.formatCancellationMessage(event);

      expect(result).toContain('Cancelled Event');
      expect(result).toContain('Was scheduled for:');
      expect(result).toContain('London');
      expect(result).toContain('Central London');
      expect(result).toContain('<@user123>');
      expect(result).toContain('This event has been cancelled');
    });

    it('should handle event without location', () => {
      const event = {
        name: 'Cancelled Event',
        event_date: '2025-01-15T19:00:00Z',
        region: 'Manchester',
        created_by: 'user456'
      };

      const result = eventNotificationManager.formatCancellationMessage(event);

      expect(result).toContain('Cancelled Event');
      expect(result).toContain('Manchester');
      expect(result).not.toContain('🏘️ **Location:**');
    });
  });
});