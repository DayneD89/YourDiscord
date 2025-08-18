const EventHandlers = require('../../src/EventHandlers');
const MockBot = require('../helpers/mockBot');
const { MockMessage, MockReaction, MockUser, MockChannel, MockGuild } = require('../helpers/mockDiscord');

describe('EventHandlers', () => {
  let eventHandlers;
  let mockBot;
  let mockMessage;
  let mockReaction;
  let mockUser;

  beforeEach(() => {
    mockBot = new MockBot();
    eventHandlers = new EventHandlers(mockBot);
    
    mockUser = new MockUser({ bot: false });
    mockMessage = new MockMessage();
    mockReaction = new MockReaction({ 
      emoji: '✅',
      message: mockMessage 
    });
    
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

  describe('handleReactionAdd', () => {
    it('should call processReaction with "add" type', async () => {
      const processReactionSpy = jest.spyOn(eventHandlers, 'processReaction').mockResolvedValue();
      
      await eventHandlers.handleReactionAdd(mockReaction, mockUser);

      expect(processReactionSpy).toHaveBeenCalledWith(mockReaction, mockUser, 'add');
    });
  });

  describe('handleReactionRemove', () => {
    it('should call processReaction with "remove" type', async () => {
      const processReactionSpy = jest.spyOn(eventHandlers, 'processReaction').mockResolvedValue();
      
      await eventHandlers.handleReactionRemove(mockReaction, mockUser);

      expect(processReactionSpy).toHaveBeenCalledWith(mockReaction, mockUser, 'remove');
    });
  });

  describe('processReaction', () => {
    beforeEach(() => {
      jest.spyOn(eventHandlers, 'handleReaction').mockResolvedValue();
      jest.spyOn(eventHandlers, 'handleProposalReaction').mockResolvedValue();
    });

    it('should ignore bot reactions', async () => {
      const botUser = new MockUser({ bot: true });
      mockBot.userValidator.isBot.mockReturnValue(true);
      
      await eventHandlers.processReaction(mockReaction, botUser, 'add');

      expect(eventHandlers.handleReaction).not.toHaveBeenCalled();
      expect(eventHandlers.handleProposalReaction).not.toHaveBeenCalled();
    });

    it('should process valid user reactions', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      
      await eventHandlers.processReaction(mockReaction, mockUser, 'add');

      expect(eventHandlers.handleReaction).toHaveBeenCalledWith(mockReaction, mockUser, 'add');
      expect(eventHandlers.handleProposalReaction).toHaveBeenCalledWith(mockReaction, mockUser, 'add');
    });
  });

  describe('handleProposalReaction', () => {
    beforeEach(() => {
      mockMessage.guild = new MockGuild({ id: mockBot.getGuildId() });
      mockReaction.message = mockMessage;
      jest.spyOn(eventHandlers, 'handleSupportReaction').mockResolvedValue();
      jest.spyOn(eventHandlers, 'handleVotingReaction').mockResolvedValue();
    });

    it('should handle support reaction in debate channel', async () => {
      mockMessage.channel.id = '123456789012345683'; // debate channel
      mockReaction.emoji = { name: '✅' };
      
      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'add');

      expect(eventHandlers.handleSupportReaction).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle vote reaction in vote channel', async () => {
      mockMessage.channel.id = '123456789012345684'; // vote channel
      mockReaction.emoji = { name: '✅' };
      
      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'add');

      expect(eventHandlers.handleVotingReaction).toHaveBeenCalledWith(mockMessage, '✅', 'add');
    });

    it('should ignore reactions in wrong guild', async () => {
      mockMessage.guild = new MockGuild({ id: 'different-guild-id' });
      
      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'add');

      expect(eventHandlers.handleSupportReaction).not.toHaveBeenCalled();
      expect(eventHandlers.handleVotingReaction).not.toHaveBeenCalled();
    });

    it('should ignore reactions in non-monitored channels', async () => {
      mockMessage.channel.id = 'unmonitored-channel';
      
      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'add');

      expect(eventHandlers.handleSupportReaction).not.toHaveBeenCalled();
      expect(eventHandlers.handleVotingReaction).not.toHaveBeenCalled();
    });

    it('should handle partial reaction objects', async () => {
      mockReaction.partial = true;
      mockReaction.fetch = jest.fn().mockResolvedValue(mockReaction);
      mockMessage.partial = true;
      mockMessage.fetch = jest.fn().mockResolvedValue(mockMessage);
      mockMessage.channel.id = '123456789012345683'; // debate channel
      
      // Note: Fetch logic is now handled in the parent processReaction method
      // This test verifies that handleProposalReaction still works correctly
      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'add');

      // The method should complete successfully even with partial objects
      expect(eventHandlers.handleSupportReaction).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockReaction.fetch = jest.fn().mockRejectedValue(new Error('Fetch failed'));
      
      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'add');

      // Should not throw and should handle the error
      expect(true).toBe(true); // Test that we got here without throwing
    });
  });

  describe('getProposalChannelType', () => {
    it('should identify debate channel', () => {
      const result = eventHandlers.getProposalChannelType('123456789012345683');
      expect(result).toBe('debate');
    });

    it('should identify vote channel', () => {
      const result = eventHandlers.getProposalChannelType('123456789012345684');
      expect(result).toBe('vote');
    });

    it('should identify resolutions channel', () => {
      const result = eventHandlers.getProposalChannelType('123456789012345685');
      expect(result).toBe('resolutions');
    });

    it('should return null for unknown channel', () => {
      const result = eventHandlers.getProposalChannelType('unknown-channel');
      expect(result).toBeNull();
    });

    it('should return null when no proposal config exists', () => {
      mockBot.proposalManager.proposalConfig = null;
      const result = eventHandlers.getProposalChannelType('123456789012345683');
      expect(result).toBeNull();
    });
  });

  describe('handleSupportReaction', () => {
    beforeEach(() => {
      mockMessage.reactions.cache = new Map();
      const supportReaction = {
        count: 4,
        me: true
      };
      mockMessage.reactions.cache.set('✅', supportReaction);
    });

    it('should handle support reaction with correct count', async () => {
      await eventHandlers.handleSupportReaction(mockMessage);

      expect(mockBot.proposalManager.handleSupportReaction).toHaveBeenCalledWith(mockMessage, 3); // 4 - 1 (bot)
    });

    it('should handle missing support reaction', async () => {
      mockMessage.reactions.cache.clear();
      
      await eventHandlers.handleSupportReaction(mockMessage);

      expect(mockBot.proposalManager.handleSupportReaction).not.toHaveBeenCalled();
    });

    it('should handle support reaction when bot has not reacted', async () => {
      const supportReaction = {
        count: 3,
        me: false
      };
      mockMessage.reactions.cache.set('✅', supportReaction);
      
      await eventHandlers.handleSupportReaction(mockMessage);

      expect(mockBot.proposalManager.handleSupportReaction).toHaveBeenCalledWith(mockMessage, 3);
    });

    it('should handle errors gracefully', async () => {
      mockBot.proposalManager.handleSupportReaction.mockRejectedValue(new Error('Support handling failed'));
      
      await eventHandlers.handleSupportReaction(mockMessage);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('handleVotingReaction', () => {
    it('should delegate to proposal manager for add reaction', async () => {
      await eventHandlers.handleVotingReaction(mockMessage, '✅', 'add');

      expect(mockBot.proposalManager.handleVoteReaction).toHaveBeenCalledWith(mockMessage, '✅', true);
    });

    it('should delegate to proposal manager for remove reaction', async () => {
      await eventHandlers.handleVotingReaction(mockMessage, '❌', 'remove');

      expect(mockBot.proposalManager.handleVoteReaction).toHaveBeenCalledWith(mockMessage, '❌', false);
    });

    it('should handle errors gracefully', async () => {
      mockBot.proposalManager.handleVoteReaction.mockRejectedValue(new Error('Vote handling failed'));
      
      await eventHandlers.handleVotingReaction(mockMessage, '✅', 'add');

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('handleReaction', () => {
    beforeEach(() => {
      mockMessage.guild = new MockGuild({ id: mockBot.getGuildId() });
      mockReaction.message = mockMessage;
      
      // Mock config manager to return a matching config
      const mockConfig = [
        { from: mockMessage.id, action: '✅', to: 'AddRole(user_id,"test")', unto: 'RemoveRole(user_id,"test")' }
      ];
      mockBot.configManager.getConfig.mockReturnValue(mockConfig);
      mockBot.configManager.findConfig.mockReturnValue(mockConfig[0]);
      
      // Mock guild member fetch
      const mockMember = { user: mockUser, roles: { cache: new Map() } };
      mockMessage.guild.members = {
        fetch: jest.fn().mockResolvedValue(mockMember)
      };
      
      // Mock action executor
      eventHandlers.actionExecutor = {
        executeAction: jest.fn().mockResolvedValue()
      };
    });

    it('should execute action for add reaction', async () => {
      await eventHandlers.handleReaction(mockReaction, mockUser, 'add');

      expect(eventHandlers.actionExecutor.executeAction).toHaveBeenCalledWith(
        'AddRole(user_id,"test")',
        expect.any(Object),
        mockMessage.guild
      );
    });

    it('should execute unto action for remove reaction', async () => {
      await eventHandlers.handleReaction(mockReaction, mockUser, 'remove');

      expect(eventHandlers.actionExecutor.executeAction).toHaveBeenCalledWith(
        'RemoveRole(user_id,"test")',
        expect.any(Object),
        mockMessage.guild
      );
    });

    it('should ignore reactions in wrong guild', async () => {
      mockMessage.guild = new MockGuild({ id: 'different-guild' });
      
      await eventHandlers.handleReaction(mockReaction, mockUser, 'add');

      expect(eventHandlers.actionExecutor.executeAction).not.toHaveBeenCalled();
    });

    it('should ignore reactions with no matching config', async () => {
      mockBot.configManager.findConfig.mockReturnValue(null);
      
      await eventHandlers.handleReaction(mockReaction, mockUser, 'add');

      expect(eventHandlers.actionExecutor.executeAction).not.toHaveBeenCalled();
    });

    it('should handle partial reaction objects', async () => {
      mockReaction.partial = true;
      mockReaction.fetch = jest.fn().mockResolvedValue(mockReaction);
      mockMessage.partial = true;
      mockMessage.fetch = jest.fn().mockResolvedValue(mockMessage);
      
      await eventHandlers.handleReaction(mockReaction, mockUser, 'add');

      expect(mockReaction.fetch).toHaveBeenCalled();
      expect(mockMessage.fetch).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockMessage.guild.members.fetch.mockRejectedValue(new Error('Member fetch failed'));
      
      await eventHandlers.handleReaction(mockReaction, mockUser, 'add');

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('handleMessage', () => {
    beforeEach(() => {
      mockMessage.author = mockUser;
      mockMessage.guild = new MockGuild({ id: mockBot.getGuildId() });
      mockMessage.channel = { id: mockBot.getCommandChannelId() };
      
      // Mock command handler
      mockBot.commandHandler = {
        handleCommand: jest.fn().mockResolvedValue()
      };
    });

    it('should ignore bot messages', async () => {
      mockBot.userValidator.isBot.mockReturnValue(true);
      mockMessage.content = '!help';
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandHandler.handleCommand).not.toHaveBeenCalled();
    });

    it('should ignore messages without command prefix', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = 'normal message';
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandHandler.handleCommand).not.toHaveBeenCalled();
    });

    it('should ignore messages not in command channels', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!help';
      mockMessage.channel.id = 'different-channel';
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandHandler.handleCommand).not.toHaveBeenCalled();
    });

    it('should process commands in moderator channel', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!help';
      mockMessage.channel.id = mockBot.getCommandChannelId();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandHandler.handleCommand).toHaveBeenCalledWith(mockMessage, true);
    });

    it('should process commands in member channel', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!help';
      mockMessage.channel.id = mockBot.getMemberCommandChannelId();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(mockBot.commandHandler.handleCommand).toHaveBeenCalledWith(mockMessage, false);
    });

    it('should process !events command in regional channel', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!events';
      mockMessage.channel.id = 'some-other-channel';
      mockMessage.channel.name = 'regional-north-east';
      
      const handleEventsCommandSpy = jest.spyOn(eventHandlers, 'handleEventsCommand').mockResolvedValue();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(handleEventsCommandSpy).toHaveBeenCalledWith(mockMessage);
      expect(mockBot.commandHandler.handleCommand).not.toHaveBeenCalled();
    });

    it('should process !events command in local channel', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!events';
      mockMessage.channel.id = 'some-other-channel';
      mockMessage.channel.name = 'local-newcastle';
      
      const handleEventsCommandSpy = jest.spyOn(eventHandlers, 'handleEventsCommand').mockResolvedValue();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(handleEventsCommandSpy).toHaveBeenCalledWith(mockMessage);
      expect(mockBot.commandHandler.handleCommand).not.toHaveBeenCalled();
    });

    it('should not process !events command in non-regional/local channels', async () => {
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockMessage.content = '!events';
      mockMessage.channel.id = 'some-other-channel';
      mockMessage.channel.name = 'general-chat';
      
      const handleEventsCommandSpy = jest.spyOn(eventHandlers, 'handleEventsCommand').mockResolvedValue();
      
      await eventHandlers.handleMessage(mockMessage);

      expect(handleEventsCommandSpy).not.toHaveBeenCalled();
      expect(mockBot.commandHandler.handleCommand).not.toHaveBeenCalled();
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
      mockMessage.guild = {
        id: 'guild123',
        members: {
          cache: new Map([['user123', { user: { id: 'user123' } }]])
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
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringMatching(/North West.*Manchester/));
    });

    it('should handle complex location names with slashes/dashes', async () => {
      mockMessage.channel.name = 'local-blyth-ashington-morpeth';
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockBot.getEventManager().getUpcomingEventsByLocation).toHaveBeenCalledWith('guild123', 'Blyth/Ashington/Morpeth');
    });

    it('should reject users without member role', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(false);
      mockMessage.channel.name = 'regional-london';
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ You need the member role to use this command.');
      expect(mockBot.getEventManager().getUpcomingEventsByRegion).not.toHaveBeenCalled();
    });

    it('should handle member not found in guild', async () => {
      mockMessage.guild.members.cache.clear();
      mockMessage.channel.name = 'regional-london';
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ Could not find your membership in this server.');
      expect(mockBot.getEventManager().getUpcomingEventsByRegion).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockMessage.channel.name = 'regional-london';
      mockBot.getEventManager().getUpcomingEventsByRegion.mockRejectedValue(new Error('Database error'));
      
      await eventHandlers.handleEventsCommand(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while fetching events.');
    });
  });

  describe('getTimeUntilEvent', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-08-18T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return "in X days" for future events', () => {
      const futureDate = new Date('2025-08-20T12:00:00Z'); // 2 days from now
      expect(eventHandlers.getTimeUntilEvent(futureDate)).toBe('in 2 days');
    });

    it('should return "in 1 day" for single day', () => {
      const futureDate = new Date('2025-08-19T12:00:00Z'); // 1 day from now
      expect(eventHandlers.getTimeUntilEvent(futureDate)).toBe('in 1 day');
    });

    it('should return "in X hours" for same day future events', () => {
      const futureDate = new Date('2025-08-18T15:00:00Z'); // 3 hours from now
      expect(eventHandlers.getTimeUntilEvent(futureDate)).toBe('in 3 hours');
    });

    it('should return "in 1 hour" for single hour', () => {
      const futureDate = new Date('2025-08-18T13:00:00Z'); // 1 hour from now
      expect(eventHandlers.getTimeUntilEvent(futureDate)).toBe('in 1 hour');
    });

    it('should return "very soon" for events less than 1 hour away', () => {
      const futureDate = new Date('2025-08-18T12:30:00Z'); // 30 minutes from now
      expect(eventHandlers.getTimeUntilEvent(futureDate)).toBe('very soon');
    });

    it('should return "just started" for events that just started', () => {
      const pastDate = new Date('2025-08-18T11:59:30Z'); // 30 seconds ago
      expect(eventHandlers.getTimeUntilEvent(pastDate)).toBe('just started');
    });

    it('should return "started X minutes ago" for recently started events', () => {
      const pastDate = new Date('2025-08-18T11:45:00Z'); // 15 minutes ago
      expect(eventHandlers.getTimeUntilEvent(pastDate)).toBe('started 15m ago');
    });

    it('should return "started X hours ago" for events started hours ago', () => {
      const pastDate = new Date('2025-08-18T09:00:00Z'); // 3 hours ago
      expect(eventHandlers.getTimeUntilEvent(pastDate)).toBe('started 3h ago');
    });
  });

  describe('processReaction error handling', () => {
    it('should handle errors in processReaction gracefully', async () => {
      const mockReaction = {
        emoji: { name: '✅' },
        message: mockMessage,
        partial: false
      };
      
      // Mock both handlers to throw errors
      jest.spyOn(eventHandlers, 'handleReaction').mockRejectedValue(new Error('Reaction error'));
      jest.spyOn(eventHandlers, 'handleProposalReaction').mockRejectedValue(new Error('Proposal error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // This should not throw despite the errors - processReaction has error handling
      await eventHandlers.processReaction(mockReaction, mockUser, 'add');
      
      expect(consoleSpy).toHaveBeenCalledWith('Error processing reaction:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('handleProposalReaction error cases', () => {
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

      mockBot.proposalManager.proposalConfig = {
        policy: {
          debateChannelId: '123456789012345683',
          voteChannelId: '123456789012345684',
          resolutionsChannelId: '123456789012345685'
        }
      };

      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'remove');

      expect(mockBot.proposalManager.handleVoteReaction).toHaveBeenCalledWith(mockReaction.message, '❌', false);
    });
  });

  describe('handleAllEventsCommand', () => {
    beforeEach(() => {
      const mockEventManager = {
        storage: {
          getUpcomingEvents: jest.fn()
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

    it('should reject users without member role', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(false);
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ You need the member role to use this command.');
    });

    it('should handle no events found', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(true);
      mockBot.getEventManager().storage.getUpcomingEvents.mockResolvedValue([]);
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('No upcoming events found across all regions')
      );
    });

    it('should show next 3 events when multiple events exist', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(true);
      
      const mockEvents = [
        {
          event_id: 'event1',
          name: 'Event 1',
          region: 'London',
          location: 'Central London',
          event_date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 1 day from now
          link: 'https://example.com/1',
          created_by: 'user1'
        },
        {
          event_id: 'event2', 
          name: 'Event 2',
          region: 'Manchester',
          event_date: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(), // 2 days from now
          created_by: 'user2'
        },
        {
          event_id: 'event3',
          name: 'Event 3', 
          region: 'Birmingham',
          event_date: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), // 3 days from now
          created_by: 'user3'
        },
        {
          event_id: 'event4',
          name: 'Event 4',
          region: 'Leeds',
          event_date: new Date(Date.now() + 1000 * 60 * 60 * 96).toISOString(), // 4 days from now
          created_by: 'user4'
        }
      ];
      
      mockBot.getEventManager().storage.getUpcomingEvents.mockResolvedValue(mockEvents);
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Next 3 Upcoming Events (All Regions)')
      );
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event 1')
      );
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event 2')
      );
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Event 3')
      );
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('1 more events available')
      );
    });

    it('should handle events without location or link', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(true);
      
      const mockEvents = [
        {
          event_id: 'event1',
          name: 'Simple Event',
          region: 'London',
          event_date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
          created_by: 'user1'
        }
      ];
      
      mockBot.getEventManager().storage.getUpcomingEvents.mockResolvedValue(mockEvents);
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('Simple Event')
      );
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('London')
      );
      // Should not contain location separator or link
      const replyCall = mockMessage.reply.mock.calls[0][0];
      expect(replyCall).not.toContain(' → ');
      expect(replyCall).not.toContain('🔗');
    });

    it('should handle errors gracefully', async () => {
      mockBot.userValidator.hasRole.mockReturnValue(true);
      mockBot.getEventManager().storage.getUpcomingEvents.mockRejectedValue(
        new Error('Storage error')
      );
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await eventHandlers.handleAllEventsCommand(mockMessage);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error handling !events command in bot channel:',
        expect.any(Error)
      );
      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ An error occurred while fetching events.'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('handleMessage - bot state filtering', () => {
    beforeEach(() => {
      mockMessage.author = mockUser;
      mockMessage.guild = new MockGuild({ id: mockBot.getGuildId() });
      mockMessage.channel = { id: mockBot.getCommandChannelId() };
      mockBot.userValidator.isBot.mockReturnValue(false);
      
      mockBot.commandHandler = {
        handleCommand: jest.fn().mockResolvedValue()
      };
    });

    it('should ignore all commands when bot is disabled', async () => {
      mockBot.isThisBotEnabled = jest.fn().mockReturnValue(false);
      mockMessage.content = '!help';
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await eventHandlers.handleMessage(mockMessage);
      
      expect(consoleSpy).toHaveBeenCalledWith('Bot is disabled, ignoring all commands');
      expect(mockBot.commandHandler.handleCommand).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should allow boton command when bot is disabled', async () => {
      mockBot.isThisBotEnabled = jest.fn().mockReturnValue(false);
      mockMessage.content = '!boton 123456789012345678';
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await eventHandlers.handleMessage(mockMessage);
      
      expect(consoleSpy).toHaveBeenCalledWith('Bot is disabled, but processing admin bot control command');
      expect(mockBot.commandHandler.handleCommand).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should allow botoff command when bot is disabled', async () => {
      mockBot.isThisBotEnabled = jest.fn().mockReturnValue(false);
      mockMessage.content = '!botoff 123456789012345678';
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await eventHandlers.handleMessage(mockMessage);
      
      expect(consoleSpy).toHaveBeenCalledWith('Bot is disabled, but processing admin bot control command');
      expect(mockBot.commandHandler.handleCommand).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should process commands normally when bot is enabled', async () => {
      mockBot.isThisBotEnabled = jest.fn().mockReturnValue(true);
      mockMessage.content = '!help';
      
      await eventHandlers.handleMessage(mockMessage);
      
      expect(mockBot.commandHandler.handleCommand).toHaveBeenCalled();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle errors in handleProposalReaction', async () => {
      const mockReaction = {
        emoji: { name: '✅' },
        message: {
          guild: { id: mockBot.getGuildId() },
          channel: { id: '123456789012345683' } // debate channel
        },
        partial: false
      };

      // Mock to throw error
      mockBot.proposalManager.handleSupportReaction = jest.fn().mockRejectedValue(new Error('Test error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await eventHandlers.handleProposalReaction(mockReaction, mockUser, 'add');

      expect(consoleSpy).toHaveBeenCalledWith('Error handling support reaction:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('handleMessage channel authorization edge cases', () => {
    beforeEach(() => {
      mockMessage.author = mockUser;
      mockMessage.guild = new MockGuild({ id: mockBot.getGuildId() });
      mockBot.userValidator.isBot.mockReturnValue(false);
      mockBot.isThisBotEnabled = jest.fn().mockReturnValue(true);
      
      mockBot.commandHandler = {
        handleCommand: jest.fn().mockResolvedValue()
      };
    });

    it('should reject commands in non-authorized channels', async () => {
      mockMessage.content = '!help';
      mockMessage.channel = { 
        id: 'unauthorized-channel-123', // Not a command channel
        name: 'general' 
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await eventHandlers.handleMessage(mockMessage);

      expect(consoleSpy).toHaveBeenCalledWith('Message not in authorized channels for this command, ignoring');
      expect(mockBot.commandHandler.handleCommand).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should process !events command in bot channels', async () => {
      mockMessage.content = '!events';
      mockMessage.channel = { 
        id: mockBot.getCommandChannelId(), 
        name: 'moderator-bot' 
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockBot.getEventManager = jest.fn(() => ({
        storage: {
          getUpcomingEvents: jest.fn().mockResolvedValue([])
        }
      }));

      await eventHandlers.handleMessage(mockMessage);

      expect(consoleSpy).toHaveBeenCalledWith('Processing !events command from TestUser#1234 in bot channel');
      
      consoleSpy.mockRestore();
    });
  });
});