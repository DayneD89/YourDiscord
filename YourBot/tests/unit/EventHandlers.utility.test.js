const EventHandlers = require('../../src/handlers/EventHandlers');
const MockBot = require('../helpers/mockBot');
const { MockMessage, MockUser, MockGuild } = require('../helpers/mockDiscord');

describe('EventHandlers - Utility Functions & Error Handling', () => {
  let eventHandlers;
  let mockBot;
  let mockMessage;
  let mockUser;

  beforeEach(() => {
    mockBot = new MockBot();
    eventHandlers = new EventHandlers(mockBot);
    
    mockUser = new MockUser({ bot: false });
    mockMessage = new MockMessage();
    
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
  });

  describe('getTimeUntilEvent', () => {
    it('should calculate time correctly for future events', () => {
      const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      const result = eventHandlers.getTimeUntilEvent(futureDate);
      
      expect(result).toMatch(/in [12] hours?/);
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

    it('should handle events that have started recently', () => {
      const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      const result = eventHandlers.getTimeUntilEvent(recentDate);
      
      expect(result).toMatch(/started .* ago/);
    });

    it('should handle events that started hours ago', () => {
      const pastDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const result = eventHandlers.getTimeUntilEvent(pastDate);
      
      expect(result).toMatch(/started .* ago/);
    });

    it('should handle invalid date objects', () => {
      const result = eventHandlers.getTimeUntilEvent(new Date('invalid-date'));
      
      expect(result).toBe('Event has started');
    });
  });

  describe('handleAllEventsCommand', () => {
    beforeEach(() => {
      const mockEventManager = {
        storage: {
          getUpcomingEvents: jest.fn().mockResolvedValue([])
        }
      };
      mockBot.getEventManager = jest.fn(() => mockEventManager);
      
      mockMessage.guild = {
        id: 'guild123',
        members: {
          cache: new Map([
            ['user123', {
              id: 'user123'
            }]
          ])
        }
      };
      mockMessage.author = { id: 'user123' };
    });

    it('should handle user not found in guild', async () => {
      mockMessage.guild.members.cache.clear();
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ Could not find your membership in this server.');
    });

    it('should handle no events found', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(true);
      mockBot.getEventManager().storage.getUpcomingEvents.mockResolvedValue([]);
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('No upcoming events found across all regions')
      );
    });

    it('should handle events found and format them correctly', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(true);
      
      const mockEvents = [
        {
          name: 'Community Meeting',
          event_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          region: 'London',
          location: 'Central London',
          link: 'https://example.com/event1',
          created_by: 'user456'
        },
        {
          name: 'Social Gathering',
          event_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          region: 'Manchester',
          created_by: 'user789'
        }
      ];
      
      mockBot.getEventManager().storage.getUpcomingEvents.mockResolvedValue(mockEvents);
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Community Meeting/));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Social Gathering/));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/London/));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/Manchester/));
    });

    it('should handle long event lists by showing only next 3', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(true);
      
      // Create many events to test limiting
      const mockEvents = Array.from({ length: 15 }, (_, i) => ({
        name: `Event ${i + 1}`,
        event_date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
        region: 'London',
        created_by: 'user123'
      }));
      
      mockBot.getEventManager().storage.getUpcomingEvents.mockResolvedValue(mockEvents);
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      // Should send single reply showing only first 3 events
      expect(mockMessage.reply).toHaveBeenCalledTimes(1);
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/12 more events available/));
    });

    it('should handle storage errors gracefully', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(true);
      mockBot.getEventManager().storage.getUpcomingEvents.mockRejectedValue(new Error('Storage error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while fetching events.');
      expect(consoleSpy).toHaveBeenCalledWith('Error handling !events command in bot channel:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle message processing errors gracefully', async () => {
      mockBot.userValidator.isBot.mockImplementation(() => {
        throw new Error('Validation error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(consoleSpy).toHaveBeenCalledWith('Error handling message:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should handle channel authorization edge cases', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!help';
      mockMessage.channel = null; // Null channel
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(consoleSpy).toHaveBeenCalledWith('Invalid message object received');
      consoleSpy.mockRestore();
    });

    it('should handle null message objects', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await eventHandlers.handleMessage(null);

      expect(consoleSpy).toHaveBeenCalledWith('Invalid message object received');
      consoleSpy.mockRestore();
    });

    it('should handle undefined guild in message', async () => {
      mockMessage.guild = undefined;
      mockMessage.content = '!events';
      mockMessage.channel = { id: 'some-channel', name: 'regional-london' }; // Regional channel but no guild
      mockBot.userValidator.isBot.mockReturnValue(false);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await eventHandlers.handleMessage(mockMessage);

      // Should ignore message from wrong guild (undefined guild)
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Ignoring message from wrong guild'));
      consoleSpy.mockRestore();
    });
  });

  describe('handleProposalReaction edge cases', () => {
    it('should handle vote reaction with remove type', async () => {
      const mockReaction = {
        emoji: { name: '❌' },
        message: {
          ...mockMessage,
          guild: { id: mockBot.getGuildId() },
          channel: { id: '123456789012345684' } // vote channel
        },
        partial: false
      };

      jest.spyOn(eventHandlers, 'handleVotingReaction').mockResolvedValue();

      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'remove');

      expect(eventHandlers.handleVotingReaction).toHaveBeenCalledWith(mockReaction.message, '❌', 'remove');
    });

    it('should handle missing proposal config gracefully', async () => {
      mockBot.proposalManager.proposalConfig = null;
      
      const mockReaction = {
        emoji: { name: '✅' },
        message: {
          ...mockMessage,
          guild: { id: mockBot.getGuildId() },
          channel: { id: 'some-channel' }
        },
        partial: false
      };

      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'add');

      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe('utility function error handling', () => {
    it('should handle getTimeUntilEvent with null date', () => {
      const result = eventHandlers.getTimeUntilEvent(null);
      expect(result).toBe('Event has started');
    });

    it('should handle getTimeUntilEvent with undefined date', () => {
      const result = eventHandlers.getTimeUntilEvent(undefined);
      expect(result).toBe('Event has started');
    });

    it('should handle getTimeUntilEvent with empty string', () => {
      const result = eventHandlers.getTimeUntilEvent('');
      expect(result).toBe('Event has started');
    });
  });
});