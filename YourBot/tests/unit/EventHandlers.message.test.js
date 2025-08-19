const EventHandlers = require('../../src/handlers/EventHandlers');
const { setupTest } = require('../helpers/testSetup');
const { createMockBot, createMockMessage, createMockUser, createMockGuild } = require('../helpers/mockFactories');
const MockBot = require('../helpers/mockBot');

describe('EventHandlers - Message Processing', () => {
  let eventHandlers;
  let mockBot;
  let mockMessage;
  let mockUser;
  let testSetup;

  beforeEach(() => {
    testSetup = setupTest({ useFakeTimers: false });
    
    // Use the legacy MockBot for compatibility with EventHandlers tests
    mockBot = new MockBot();
    
    // Setup default proposal configuration
    mockBot.proposalManager.proposalConfig = {
      policy: {
        debateChannelId: '123456789012345683',
        voteChannelId: '123456789012345684',
        resolutionsChannelId: '123456789012345685',
        supportThreshold: 3,
        voteDuration: 86400000,
        formats: ['Policy']
      }
    };
    
    eventHandlers = new EventHandlers(mockBot);
    mockUser = createMockUser({ bot: false });
    mockMessage = createMockMessage();
  });

  afterEach(() => {
    testSetup.restoreFunction();
  });

  describe('handleMessage', () => {
    beforeEach(() => {
      mockMessage.author = mockUser;
      mockMessage.guild = createMockGuild({ id: mockBot.getGuildId() });
      mockMessage.channel = { id: mockBot.getCommandChannelId() };
      
      // Mock command handler
      mockBot.commandRouter = {
        handleCommand: jest.fn().mockResolvedValue()
      };
    });

    it('should ignore bot messages', async () => {
      mockBot.userValidator.isBot.mockReturnValue(true);
      mockMessage.content = '!help';
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandRouter.handleCommand).not.toHaveBeenCalled();
    });

    it('should ignore messages without command prefix', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = 'normal message';
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandRouter.handleCommand).not.toHaveBeenCalled();
    });

    it('should ignore messages not in command channels', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!help';
      mockMessage.channel.id = 'different-channel';
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandRouter.handleCommand).not.toHaveBeenCalled();
    });

    it('should process commands in moderator channel', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!help';
      mockMessage.channel.id = mockBot.getCommandChannelId();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandRouter.handleCommand).toHaveBeenCalledWith(mockMessage, true);
    });

    it('should process commands in member channel', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!help';
      mockMessage.channel.id = mockBot.getMemberCommandChannelId();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandRouter.handleCommand).toHaveBeenCalledWith(mockMessage, false);
    });

    it('should process !events command in regional channel', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!events';
      mockMessage.channel.id = 'some-other-channel';
      mockMessage.channel.name = 'regional-north-east';
      
      const handleEventsCommandSpy = jest.spyOn(eventHandlers, 'handleEventsCommand').mockResolvedValue();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(handleEventsCommandSpy).toHaveBeenCalledWith(mockMessage);
      expect(mockBot.commandRouter.handleCommand).not.toHaveBeenCalled();
    });

    it('should process !events command in local channel', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!events';
      mockMessage.channel.id = 'some-other-channel';
      mockMessage.channel.name = 'local-newcastle';
      
      const handleEventsCommandSpy = jest.spyOn(eventHandlers, 'handleEventsCommand').mockResolvedValue();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(handleEventsCommandSpy).toHaveBeenCalledWith(mockMessage);
      expect(mockBot.commandRouter.handleCommand).not.toHaveBeenCalled();
    });

    it('should not process !events command in non-regional/local channels', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!events';
      mockMessage.channel.id = 'some-other-channel';
      mockMessage.channel.name = 'general-chat';
      
      const handleEventsCommandSpy = jest.spyOn(eventHandlers, 'handleEventsCommand').mockResolvedValue();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(handleEventsCommandSpy).not.toHaveBeenCalled();
      expect(mockBot.commandRouter.handleCommand).not.toHaveBeenCalled();
    });

    it('should handle bot state filtering disabled', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockBot.isThisBotEnabled = jest.fn().mockReturnValue(false); // Bot disabled
      mockMessage.content = '!help';
      mockMessage.channel.id = mockBot.getCommandChannelId();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandRouter.handleCommand).not.toHaveBeenCalled();
    });

    it('should handle bot state filtering enabled', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockBot.isThisBotEnabled = jest.fn().mockReturnValue(true); // Bot enabled
      mockMessage.content = '!help';
      mockMessage.channel.id = mockBot.getCommandChannelId();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandRouter.handleCommand).toHaveBeenCalledWith(mockMessage, true);
    });

    it('should allow enable command when bot is disabled', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockBot.isThisBotEnabled = jest.fn().mockReturnValue(false); // Bot disabled
      mockMessage.content = '!boton ';
      mockMessage.channel.id = mockBot.getCommandChannelId();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandRouter.handleCommand).toHaveBeenCalledWith(mockMessage, true);
    });
  });

  describe('isRegionalOrLocalChannel', () => {
    it('should return true for regional channels', () => {
      expect(eventHandlers.isRegionalOrLocalChannel('regional-north-east')).toBe(true);
      expect(eventHandlers.isRegionalOrLocalChannel('regional-london')).toBe(true);
    });

    it('should return true for local channels', () => {
      expect(eventHandlers.isRegionalOrLocalChannel('local-newcastle')).toBe(true);
      expect(eventHandlers.isRegionalOrLocalChannel('local-manchester')).toBe(true);
    });

    it('should return false for other channels', () => {
      expect(eventHandlers.isRegionalOrLocalChannel('general')).toBe(false);
      expect(eventHandlers.isRegionalOrLocalChannel('bot-commands')).toBe(false);
    });

    it('should return false for null/undefined channel names', () => {
      expect(eventHandlers.isRegionalOrLocalChannel(null)).toBe(false);
      expect(eventHandlers.isRegionalOrLocalChannel(undefined)).toBe(false);
      expect(eventHandlers.isRegionalOrLocalChannel('')).toBe(false);
    });

    it('should return false for non-string channel names', () => {
      expect(eventHandlers.isRegionalOrLocalChannel(123)).toBe(false);
      expect(eventHandlers.isRegionalOrLocalChannel({})).toBe(false);
    });
  });

  describe('handleEventsCommand', () => {
    beforeEach(() => {
      // Mock the event manager
      mockBot.getEventManager = jest.fn().mockReturnValue({
        getUpcomingEventsByRegion: jest.fn().mockResolvedValue([]),
        getUpcomingEventsByLocation: jest.fn().mockResolvedValue([])
      });

      // Setup guild and member
      const mockMember = { 
        user: { id: 'user123' },
        roles: {
          cache: new Map([
            ['member-role-id', { name: 'Member', id: 'member-role-id' }]
          ])
        }
      };
      
      mockMessage.guild = {
        id: 'guild123',
        members: {
          cache: new Map([['user123', mockMember]]),
          fetch: jest.fn().mockResolvedValue(mockMember)
        }
      };
      mockMessage.author = { id: 'user123' };
      
      mockBot.userValidator.hasRole.mockReturnValue(true);
    });

    it('should handle !events in regional channel with no events', async () => {
      mockMessage.channel.name = 'regional-north-east';
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockBot.getEventManager().getUpcomingEventsByRegion).toHaveBeenCalledWith('guild123', 'North East');
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('No upcoming events found for North East'));
    });

    it('should handle !events in local channel with no events', async () => {
      mockMessage.channel.name = 'local-newcastle';
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockBot.getEventManager().getUpcomingEventsByLocation).toHaveBeenCalledWith('guild123', 'Newcastle');
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('No upcoming events found for Newcastle'));
    });

    it('should handle !events in regional channel with events', async () => {
      mockMessage.channel.name = 'regional-london';
      
      const mockEvents = [
        {
          name: 'Community Meeting',
          event_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          region: 'London',
          location: 'Central London',
          link: 'https://example.com/event1',
          created_by: 'user456'
        }
      ];
      
      mockBot.getEventManager().getUpcomingEventsByRegion.mockResolvedValue(mockEvents);
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockBot.getEventManager().getUpcomingEventsByRegion).toHaveBeenCalledWith('guild123', 'London');
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Community Meeting/));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Central London/));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/https:\/\/example\.com\/event1/));
    });

    it('should handle !events in local channel with events without links', async () => {
      mockMessage.channel.name = 'local-manchester';
      
      const mockEvents = [
        {
          name: 'Local Meetup',
          event_date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          region: 'North West',
          location: 'Manchester',
          created_by: 'user789'
        }
      ];
      
      mockBot.getEventManager().getUpcomingEventsByLocation.mockResolvedValue(mockEvents);
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockBot.getEventManager().getUpcomingEventsByLocation).toHaveBeenCalledWith('guild123', 'Manchester');
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Local Meetup/));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Manchester/));
    });

    it('should handle permission validation failure', async () => {
      mockMessage.channel.name = 'regional-london';
      mockBot.userValidator.hasRole.mockReturnValue(false);
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ You need the member role to use this command.');
    });

    it('should handle invalid channel format', async () => {
      mockMessage.channel.name = 'invalid-channel';
      
      await eventHandlers.handleEventsCommand(mockMessage);

      // Invalid channel format will extract empty area name and find no events
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('No upcoming events found for'));
    });

    it('should handle event manager errors gracefully', async () => {
      mockMessage.channel.name = 'regional-london';
      mockBot.getEventManager().getUpcomingEventsByRegion.mockRejectedValue(new Error('Database error'));
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while fetching events.');
      expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith('Error handling !events command:', expect.any(Error));
    });
  });

  describe('getTimeUntilEvent', () => {
    it('should calculate time correctly for future events', () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      const result = eventHandlers.getTimeUntilEvent(futureDate);
      
      expect(result).toMatch(/in 2 hours?/);
    });

    it('should handle events starting soon', () => {
      const soonDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const result = eventHandlers.getTimeUntilEvent(soonDate);
      
      expect(result).toBe('very soon');
    });

    it('should handle events in days', () => {
      const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days
      const result = eventHandlers.getTimeUntilEvent(futureDate);
      
      expect(result).toMatch(/in 2 days?/);
    });

    it('should handle events that have started', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const result = eventHandlers.getTimeUntilEvent(pastDate);
      
      expect(result).toMatch(/started .* ago/);
    });
  });

  describe('handleAllEventsCommand', () => {
    beforeEach(() => {
      mockBot.getEventManager = jest.fn().mockReturnValue({
        getAllUpcomingEvents: jest.fn().mockResolvedValue([])
      });

      mockMessage.guild = {
        id: 'guild123',
        members: {
          cache: new Map([['user123', { user: { id: 'user123' } }]])
        }
      };
      mockMessage.author = { id: 'user123' };
      mockBot.userValidator.hasRole.mockReturnValue(true);
    });

    it('should handle all events command with no events', async () => {
      await eventHandlers.handleAllEventsCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('No upcoming events found across all regions'));
    });

    it('should handle all events command with multiple events', async () => {
      const mockEvents = [
        {
          name: 'Event 1',
          event_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          region: 'London',
          created_by: 'user1'
        },
        {
          name: 'Event 2', 
          event_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          region: 'Manchester',
          created_by: 'user2'
        }
      ];

      mockBot.getEventManager().getAllUpcomingEvents.mockResolvedValue(mockEvents);

      // Mock the regions that the bot knows about
      mockBot.getConfig = jest.fn().mockReturnValue({
        regions: ['London', 'Manchester']
      });

      await eventHandlers.handleAllEventsCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Event 1/));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Event 2/));
    });

    it('should handle errors in all events command', async () => {
      mockBot.getEventManager().getAllUpcomingEvents.mockRejectedValue(new Error('Database error'));

      await eventHandlers.handleAllEventsCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while fetching events.');
      expect(testSetup.consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle message processing errors gracefully', async () => {
      mockBot.userValidator.isBot.mockImplementation(() => {
        throw new Error('Validation error');
      });
      
      await eventHandlers.handleMessage(mockMessage);

      expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith('Error handling message:', expect.any(Error));
    });

    it('should handle channel authorization edge cases', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!help';
      mockMessage.channel = null; // Null channel
      
      await eventHandlers.handleMessage(mockMessage);

      expect(testSetup.consoleErrorSpy).toHaveBeenCalledWith('Invalid message object received');
    });
  });
});