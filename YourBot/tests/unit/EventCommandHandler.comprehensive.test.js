const EventCommandHandler = require('../../src/handlers/EventCommandHandler');
const { setupTest } = require('../helpers/testSetup');
const { createMockBot, createMockMessage, createMockUser, createMockGuild } = require('../helpers/mockFactories');

describe('EventCommandHandler - Comprehensive Tests', () => {
  let eventCommandHandler;
  let mockBot;
  let mockMessage;
  let mockGuild;
  let mockAuthor;
  let mockEventManager;
  let mockUserValidator;
  let testSetup;

  beforeEach(() => {
    testSetup = setupTest({ useFakeTimers: false });
    
    mockAuthor = createMockUser({
      id: 'user123',
      tag: 'TestUser#1234'
    });

    mockEventManager = {
      createEvent: jest.fn().mockResolvedValue({
        name: 'Test Event',
        link: 'https://example.com'
      }),
      removeEvent: jest.fn().mockResolvedValue({ success: true }),
      getUpcomingEvents: jest.fn().mockResolvedValue([]),
      getUpcomingEventsByLocation: jest.fn().mockResolvedValue([]),
      clearAllEvents: jest.fn().mockResolvedValue(5)
    };

    mockUserValidator = {
      canUseModerator: jest.fn().mockReturnValue(true)
    };

    // Mock guild with roles - using numeric IDs
    const mockRegionRole = {
      id: '123456789012345678',
      name: 'London',
      toString: () => '<@&123456789012345678>'
    };

    const mockLocationRole = {
      id: '987654321098765432',
      name: 'Central London',
      toString: () => '<@&987654321098765432>'
    };

    mockGuild = createMockGuild({
      id: 'guild123',
      roles: [
        ['123456789012345678', mockRegionRole],
        ['987654321098765432', mockLocationRole]
      ],
      channels: []
    });
    
    // Add members to the guild
    mockGuild.members.cache.set('user123', {
      id: 'user123',
      roles: {
        cache: new Map([['mod-role-123', { id: 'mod-role-123' }]])
      }
    });

    // Override the get method for role lookups
    mockGuild.roles.cache.get = jest.fn((id) => {
      const roles = {
        '123456789012345678': mockRegionRole,
        '987654321098765432': mockLocationRole
      };
      return roles[id];
    });

    mockBot = createMockBot({
      getEventManager: jest.fn().mockReturnValue(mockEventManager),
      getUserValidator: jest.fn().mockReturnValue(mockUserValidator),
      getModeratorRoleId: jest.fn().mockReturnValue('mod-role-123')
    });

    mockMessage = createMockMessage({
      reply: jest.fn().mockResolvedValue(),
      author: mockAuthor,
      guild: mockGuild
    });

    eventCommandHandler = new EventCommandHandler(mockBot);
  });

  afterEach(() => {
    testSetup.restoreFunction();
  });

  describe('constructor', () => {
    it('should initialize with bot reference', () => {
      expect(eventCommandHandler.bot).toBe(mockBot);
    });
  });

  describe('handleModeratorCommand', () => {
    it('should handle !addevent command', async () => {
      const addEventSpy = jest.spyOn(eventCommandHandler, 'handleAddEvent').mockResolvedValue();

      await eventCommandHandler.handleModeratorCommand(mockMessage, {}, '!addevent test args');

      expect(addEventSpy).toHaveBeenCalledWith(mockMessage, 'test args');
    });

    it('should handle !removeevent command', async () => {
      const removeEventSpy = jest.spyOn(eventCommandHandler, 'handleRemoveEvent').mockResolvedValue();

      await eventCommandHandler.handleModeratorCommand(mockMessage, {}, '!removeevent test args');

      expect(removeEventSpy).toHaveBeenCalledWith(mockMessage, 'test args');
    });

    it('should ignore unhandled commands', async () => {
      const addEventSpy = jest.spyOn(eventCommandHandler, 'handleAddEvent').mockResolvedValue();
      const removeEventSpy = jest.spyOn(eventCommandHandler, 'handleRemoveEvent').mockResolvedValue();

      await eventCommandHandler.handleModeratorCommand(mockMessage, {}, '!other command');

      expect(addEventSpy).not.toHaveBeenCalled();
      expect(removeEventSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleMemberCommand', () => {
    it('should handle !addevent command', async () => {
      const addEventSpy = jest.spyOn(eventCommandHandler, 'handleAddEvent').mockResolvedValue();

      await eventCommandHandler.handleMemberCommand(mockMessage, {}, '!addevent test args');

      expect(addEventSpy).toHaveBeenCalledWith(mockMessage, 'test args');
    });

    it('should handle !removeevent command', async () => {
      const removeEventSpy = jest.spyOn(eventCommandHandler, 'handleRemoveEvent').mockResolvedValue();

      await eventCommandHandler.handleMemberCommand(mockMessage, {}, '!removeevent test args');

      expect(removeEventSpy).toHaveBeenCalledWith(mockMessage, 'test args');
    });

    it('should handle !events command', async () => {
      const listEventsSpy = jest.spyOn(eventCommandHandler, 'handleListEvents').mockResolvedValue();

      await eventCommandHandler.handleMemberCommand(mockMessage, {}, '!events');

      expect(listEventsSpy).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle !events with location command', async () => {
      const listByLocationSpy = jest.spyOn(eventCommandHandler, 'handleListEventsByLocation').mockResolvedValue();

      await eventCommandHandler.handleMemberCommand(mockMessage, {}, '!events @London');

      expect(listByLocationSpy).toHaveBeenCalledWith(mockMessage, '@London');
    });

    it('should handle !clearevents command', async () => {
      const clearEventsSpy = jest.spyOn(eventCommandHandler, 'handleClearEvents').mockResolvedValue();

      await eventCommandHandler.handleMemberCommand(mockMessage, {}, '!clearevents');

      expect(clearEventsSpy).toHaveBeenCalledWith(mockMessage);
    });

    it('should ignore unhandled commands', async () => {
      const addEventSpy = jest.spyOn(eventCommandHandler, 'handleAddEvent').mockResolvedValue();

      await eventCommandHandler.handleMemberCommand(mockMessage, {}, '!other command');

      expect(addEventSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleAddEvent', () => {
    it('should show help message for empty arguments', async () => {
      await eventCommandHandler.handleAddEvent(mockMessage, '');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event command format')
      );
    });

    it('should show help message for whitespace arguments', async () => {
      await eventCommandHandler.handleAddEvent(mockMessage, '   ');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event command format')
      );
    });

    it('should handle invalid format with missing pipe', async () => {
      await eventCommandHandler.handleAddEvent(mockMessage, '@London "Event Name"');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Invalid format')
      );
    });

    it('should handle missing role mentions', async () => {
      await eventCommandHandler.handleAddEvent(mockMessage, '"Event Name" | 2024-08-25 18:00');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Missing role mentions')
      );
    });

    it('should handle missing event name', async () => {
      await eventCommandHandler.handleAddEvent(mockMessage, '<@&123456789012345678> | 2024-08-25 18:00');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Missing event name')
      );
    });

    it('should handle empty event name', async () => {
      await eventCommandHandler.handleAddEvent(mockMessage, '<@&123456789012345678> "" | 2024-08-25 18:00');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event name cannot be empty')
      );
    });

    it('should handle invalid role mentions', async () => {
      mockGuild.roles.cache.get.mockReturnValue(undefined);

      await eventCommandHandler.handleAddEvent(mockMessage, '<@&999999999999999999> "Event Name" | 2024-08-25 18:00');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Some mentioned roles do not exist')
      );
    });

    it('should handle invalid date format', async () => {
      await eventCommandHandler.handleAddEvent(mockMessage, '<@&123456789012345678> "Event Name" | invalid-date');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Invalid date format')
      );
    });

    it('should handle invalid link format', async () => {
      await eventCommandHandler.handleAddEvent(mockMessage, '<@&123456789012345678> "Event Name" | 2024-08-25 18:00 | invalid-link');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Invalid link format')
      );
    });

    it('should create event successfully with region and location', async () => {
      await eventCommandHandler.handleAddEvent(
        mockMessage, 
        '<@&123456789012345678> <@&987654321098765432> "Community Meeting" | 2024-08-25 18:00 | https://example.com'
      );

      expect(mockEventManager.createEvent).toHaveBeenCalledWith(
        'guild123',
        {
          name: 'Community Meeting',
          region: 'London',
          location: 'Central London',
          eventDate: '2024-08-25 18:00',
          link: 'https://example.com'
        },
        mockAuthor,
        expect.objectContaining({ name: 'London' }),
        expect.objectContaining({ name: 'Central London' })
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event created successfully')
      );
    });

    it('should create event successfully with region only', async () => {
      await eventCommandHandler.handleAddEvent(
        mockMessage, 
        '<@&123456789012345678> "Regional Event" | 2024-08-25 18:00'
      );

      expect(mockEventManager.createEvent).toHaveBeenCalledWith(
        'guild123',
        {
          name: 'Regional Event',
          region: 'London',
          location: null,
          eventDate: '2024-08-25 18:00',
          link: null
        },
        mockAuthor,
        expect.objectContaining({ name: 'London' }),
        null
      );
    });

    it('should handle region validation errors', async () => {
      mockEventManager.createEvent.mockRejectedValue(new Error('Region role error'));

      await eventCommandHandler.handleAddEvent(
        mockMessage, 
        '<@&123456789012345678> "Test Event" | 2024-08-25 18:00'
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Region validation error')
      );
    });

    it('should handle location validation errors', async () => {
      mockEventManager.createEvent.mockRejectedValue(new Error('Location role error'));

      await eventCommandHandler.handleAddEvent(
        mockMessage, 
        '<@&123456789012345678> "Test Event" | 2024-08-25 18:00'
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Location validation error')
      );
    });

    it('should handle date errors', async () => {
      mockEventManager.createEvent.mockRejectedValue(new Error('Invalid date'));

      await eventCommandHandler.handleAddEvent(
        mockMessage, 
        '<@&123456789012345678> "Test Event" | 2024-08-25 18:00'
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Date error')
      );
    });

    it('should handle general errors', async () => {
      mockEventManager.createEvent.mockRejectedValue(new Error('Generic error'));

      await eventCommandHandler.handleAddEvent(
        mockMessage, 
        '<@&123456789012345678> "Test Event" | 2024-08-25 18:00'
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred while creating the event')
      );
    });
  });

  describe('handleRemoveEvent', () => {
    it('should show help message for empty arguments', async () => {
      await eventCommandHandler.handleRemoveEvent(mockMessage, '');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event remove command format')
      );
    });

    it('should handle invalid format', async () => {
      await eventCommandHandler.handleRemoveEvent(mockMessage, 'no pipes here');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Invalid format')
      );
    });

    it('should handle missing role mentions', async () => {
      await eventCommandHandler.handleRemoveEvent(mockMessage, '"Event Name" | 2024-08-25 18:00');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Missing role mentions')
      );
    });

    it('should handle missing event name', async () => {
      await eventCommandHandler.handleRemoveEvent(mockMessage, '<@&123456789012345678> | 2024-08-25 18:00');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Missing event name')
      );
    });

    it('should handle empty event name', async () => {
      await eventCommandHandler.handleRemoveEvent(mockMessage, '<@&123456789012345678> "" | 2024-08-25 18:00');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event name cannot be empty')
      );
    });

    it('should handle invalid roles', async () => {
      mockGuild.roles.cache.get.mockReturnValue(undefined);

      await eventCommandHandler.handleRemoveEvent(mockMessage, '<@&999999999999999999> "Event Name" | 2024-08-25 18:00');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Some mentioned roles do not exist')
      );
    });

    it('should handle invalid date format', async () => {
      await eventCommandHandler.handleRemoveEvent(mockMessage, '<@&123456789012345678> "Event Name" | invalid-date');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Invalid date format')
      );
    });

    it('should remove event successfully', async () => {
      await eventCommandHandler.handleRemoveEvent(
        mockMessage, 
        '<@&123456789012345678> <@&987654321098765432> "Event to Remove" | 2024-08-25 18:00'
      );

      expect(mockEventManager.removeEvent).toHaveBeenCalledWith(
        'guild123',
        {
          name: 'Event to Remove',
          region: 'London',
          location: 'Central London',
          eventDate: '2024-08-25 18:00'
        },
        mockAuthor
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event removed successfully')
      );
    });

    it('should handle event not found', async () => {
      mockEventManager.removeEvent.mockResolvedValue({ success: false });

      await eventCommandHandler.handleRemoveEvent(
        mockMessage, 
        '<@&123456789012345678> "Nonexistent Event" | 2024-08-25 18:00'
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Could not find event to remove')
      );
    });

    it('should handle removal errors', async () => {
      mockEventManager.removeEvent.mockRejectedValue(new Error('Removal error'));

      await eventCommandHandler.handleRemoveEvent(
        mockMessage, 
        '<@&123456789012345678> "Test Event" | 2024-08-25 18:00'
      );

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred while removing the event')
      );
    });
  });

  describe('handleListEvents', () => {
    it('should handle no upcoming events', async () => {
      mockEventManager.getUpcomingEvents.mockResolvedValue([]);

      await eventCommandHandler.handleListEvents(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('No upcoming events scheduled')
      );
    });

    it('should handle null events', async () => {
      mockEventManager.getUpcomingEvents.mockResolvedValue(null);

      await eventCommandHandler.handleListEvents(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('No upcoming events scheduled')
      );
    });

    it('should list upcoming events', async () => {
      const mockEvents = [
        {
          name: 'Event 1',
          event_date: '2024-08-25T18:00:00Z',
          region: 'London',
          location: 'Central London',
          link: 'https://example.com',
          created_by: 'user123'
        },
        {
          name: 'Event 2',
          event_date: '2024-08-26T19:00:00Z',
          region: 'Manchester',
          location: null,
          link: null,
          created_by: 'user456'
        }
      ];

      mockEventManager.getUpcomingEvents.mockResolvedValue(mockEvents);

      await eventCommandHandler.handleListEvents(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringMatching(/Upcoming Events.*\(2\)/)
      );
    });

    it('should handle listing errors', async () => {
      mockEventManager.getUpcomingEvents.mockRejectedValue(new Error('Database error'));

      await eventCommandHandler.handleListEvents(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred while retrieving events')
      );
    });
  });

  describe('handleListEventsByLocation', () => {
    it('should handle missing role mention', async () => {
      await eventCommandHandler.handleListEventsByLocation(mockMessage, 'no role here');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Please mention a location role')
      );
    });

    it('should handle invalid role', async () => {
      mockGuild.roles.cache.get.mockReturnValue(undefined);

      await eventCommandHandler.handleListEventsByLocation(mockMessage, '<@&999999999999999999>');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Location role not found')
      );
    });

    it('should handle no events for location', async () => {
      mockEventManager.getUpcomingEventsByLocation.mockResolvedValue([]);

      await eventCommandHandler.handleListEventsByLocation(mockMessage, '<@&987654321098765432>');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('No upcoming events found for Central London')
      );
    });

    it('should list events by location', async () => {
      const mockEvents = [
        {
          name: 'Local Event',
          event_date: '2024-08-25T18:00:00Z',
          region: 'London',
          location: 'Central London',
          link: 'https://example.com',
          created_by: 'user123'
        }
      ];

      mockEventManager.getUpcomingEventsByLocation.mockResolvedValue(mockEvents);

      await eventCommandHandler.handleListEventsByLocation(mockMessage, '<@&987654321098765432>');

      expect(mockEventManager.getUpcomingEventsByLocation).toHaveBeenCalledWith('guild123', 'Central London');
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringMatching(/Upcoming Events in Central London.*\(1\)/)
      );
    });

    it('should handle location listing errors', async () => {
      mockEventManager.getUpcomingEventsByLocation.mockRejectedValue(new Error('Database error'));

      await eventCommandHandler.handleListEventsByLocation(mockMessage, '<@&987654321098765432>');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred while retrieving events for the specified location')
      );
    });
  });

  describe('handleClearEvents', () => {
    it('should handle no events to clear', async () => {
      mockEventManager.getUpcomingEvents.mockResolvedValue([]);

      await eventCommandHandler.handleClearEvents(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('No upcoming events to clear')
      );
    });

    it('should handle non-moderator access', async () => {
      mockEventManager.getUpcomingEvents.mockResolvedValue([{ name: 'Event 1' }]);
      mockUserValidator.canUseModerator.mockReturnValue(false);

      await eventCommandHandler.handleClearEvents(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Only moderators can clear all events')
      );
    });

    it('should clear events successfully', async () => {
      mockEventManager.getUpcomingEvents.mockResolvedValue([{ name: 'Event 1' }]);
      mockEventManager.clearAllEvents.mockResolvedValue(3);

      await eventCommandHandler.handleClearEvents(mockMessage);

      expect(mockEventManager.clearAllEvents).toHaveBeenCalledWith('guild123', mockAuthor);
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Successfully cleared 3 upcoming events')
      );
    });

    it('should handle no events cleared', async () => {
      mockEventManager.getUpcomingEvents.mockResolvedValue([{ name: 'Event 1' }]);
      mockEventManager.clearAllEvents.mockResolvedValue(0);

      await eventCommandHandler.handleClearEvents(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('No events were cleared')
      );
    });

    it('should handle clear errors', async () => {
      mockEventManager.getUpcomingEvents.mockResolvedValue([{ name: 'Event 1' }]);
      mockEventManager.clearAllEvents.mockRejectedValue(new Error('Clear error'));

      await eventCommandHandler.handleClearEvents(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('An error occurred while clearing events')
      );
    });
  });

  describe('isValidUrl', () => {
    it('should validate http URLs', () => {
      expect(eventCommandHandler.isValidUrl('http://example.com')).toBe(true);
    });

    it('should validate https URLs', () => {
      expect(eventCommandHandler.isValidUrl('https://example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(eventCommandHandler.isValidUrl('invalid-url')).toBe(false);
      expect(eventCommandHandler.isValidUrl('ftp://example.com')).toBe(false);
      expect(eventCommandHandler.isValidUrl('')).toBe(false);
    });

    it('should handle malformed URLs', () => {
      expect(eventCommandHandler.isValidUrl('http://')).toBe(false);
      expect(eventCommandHandler.isValidUrl('https')).toBe(false);
    });
  });
});