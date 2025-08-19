const BotLifecycleManager = require('../../../src/core/BotLifecycleManager');

describe('BotLifecycleManager', () => {
  let lifecycleManager;
  let mockBot;
  let mockClient;
  let mockGuild;
  let mockChannel;
  let consoleSpy;

  beforeEach(() => {
    // Mock client
    mockClient = {
      once: jest.fn(),
      on: jest.fn(),
      user: { 
        tag: 'TestBot#1234',
        id: 'bot123'
      },
      guilds: {
        cache: {
          get: jest.fn()
        }
      }
    };

    // Mock channel
    mockChannel = {
      name: 'moderator-bot',
      id: 'channel123',
      isTextBased: () => true,
      send: jest.fn().mockResolvedValue({ id: 'msg123' }),
      messages: {
        fetch: jest.fn().mockResolvedValue({ id: 'cached123' })
      },
      permissionsFor: jest.fn().mockReturnValue({
        has: jest.fn().mockReturnValue(true),
        toArray: jest.fn().mockReturnValue(['SendMessages'])
      })
    };

    // Mock guild
    mockGuild = {
      name: 'Test Guild',
      id: 'guild123',
      channels: {
        cache: new Map([['channel123', mockChannel]])
      },
      members: {
        cache: {
          get: jest.fn().mockReturnValue({
            id: 'bot123',
            user: { id: 'bot123' }
          })
        }
      }
    };

    mockClient.guilds.cache.get.mockReturnValue(mockGuild);

    // Mock bot
    mockBot = {
      client: mockClient,
      getGuildId: jest.fn().mockReturnValue('guild123'),
      getCommandChannelId: jest.fn().mockReturnValue('channel123'),
      getMemberCommandChannelId: jest.fn().mockReturnValue('mchannel123'),
      getModeratorRoleId: jest.fn().mockReturnValue('mod123'),
      getMemberRoleId: jest.fn().mockReturnValue('member123'),
      getRunId: jest.fn().mockReturnValue('run123'),
      eventHandlers: {
        handleReactionAdd: jest.fn(),
        handleReactionRemove: jest.fn(),
        handleMessage: jest.fn()
      },
      proposalManager: {
        proposalConfig: {
          policy: {
            supportThreshold: 5,
            voteDuration: 86400000,
            debateChannelId: 'debate123',
            voteChannelId: 'vote123',
            resolutionsChannelId: 'res123'
          }
        },
        getActiveVotes: jest.fn().mockResolvedValue([])
      },
      configManager: {
        getConfig: jest.fn().mockReturnValue([])
      }
    };

    lifecycleManager = new BotLifecycleManager(mockBot);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Store original NODE_ENV
    this.originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    // Restore NODE_ENV
    process.env.NODE_ENV = this.originalNodeEnv;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with bot and client references', () => {
      expect(lifecycleManager.bot).toBe(mockBot);
      expect(lifecycleManager.client).toBe(mockClient);
      expect(lifecycleManager.shutdownMessageSent).toBe(false);
    });
  });

  describe('setupEventHandlers', () => {
    it('should setup Discord event handlers', () => {
      lifecycleManager.setupEventHandlers();

      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('messageReactionAdd', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('messageReactionRemove', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('warn', expect.any(Function));
    });

    it('should setup graceful shutdown in non-test environment', () => {
      process.env.NODE_ENV = 'production';
      const setupSpy = jest.spyOn(lifecycleManager, 'setupGracefulShutdown').mockImplementation();
      
      lifecycleManager.setupEventHandlers();
      
      expect(setupSpy).toHaveBeenCalled();
    });

    it('should skip graceful shutdown setup in test environment', () => {
      process.env.NODE_ENV = 'test';
      const setupSpy = jest.spyOn(lifecycleManager, 'setupGracefulShutdown').mockImplementation();
      
      lifecycleManager.setupEventHandlers();
      
      expect(setupSpy).not.toHaveBeenCalled();
    });

    it('should delegate reaction add events', () => {
      lifecycleManager.setupEventHandlers();
      
      const mockReaction = { message: { id: 'msg123' } };
      const mockUser = { id: 'user123' };
      const reactionAddHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageReactionAdd')[1];
      
      reactionAddHandler(mockReaction, mockUser);
      
      expect(mockBot.eventHandlers.handleReactionAdd).toHaveBeenCalledWith(mockReaction, mockUser);
    });

    it('should delegate reaction remove events', () => {
      lifecycleManager.setupEventHandlers();
      
      const mockReaction = { message: { id: 'msg123' } };
      const mockUser = { id: 'user123' };
      const reactionRemoveHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageReactionRemove')[1];
      
      reactionRemoveHandler(mockReaction, mockUser);
      
      expect(mockBot.eventHandlers.handleReactionRemove).toHaveBeenCalledWith(mockReaction, mockUser);
    });

    it('should delegate message events', () => {
      lifecycleManager.setupEventHandlers();
      
      const mockMessage = { content: 'test', author: { id: 'user123' } };
      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')[1];
      
      messageHandler(mockMessage);
      
      expect(mockBot.eventHandlers.handleMessage).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle Discord client errors', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      lifecycleManager.setupEventHandlers();
      
      const mockError = new Error('Connection failed');
      const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')[1];
      
      errorHandler(mockError);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Discord client error:', mockError);
      consoleErrorSpy.mockRestore();
    });

    it('should handle Discord client warnings', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      lifecycleManager.setupEventHandlers();
      
      const mockWarning = 'Rate limit warning';
      const warnHandler = mockClient.on.mock.calls.find(call => call[0] === 'warn')[1];
      
      warnHandler(mockWarning);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('Discord client warning:', mockWarning);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('handleReady', () => {
    beforeEach(() => {
      jest.spyOn(lifecycleManager, 'preCacheMessages').mockResolvedValue();
      jest.spyOn(lifecycleManager, 'preCacheVoteMessages').mockResolvedValue();
      jest.spyOn(lifecycleManager, 'postDeploymentConfirmation').mockResolvedValue();
      jest.spyOn(process, 'emit').mockImplementation();
    });

    it('should log bot information on ready', async () => {
      await lifecycleManager.handleReady();

      expect(consoleSpy).toHaveBeenCalledWith('Bot logged in as TestBot#1234');
      expect(consoleSpy).toHaveBeenCalledWith('Monitoring guild: guild123');
      expect(consoleSpy).toHaveBeenCalledWith('Moderator command channel: channel123');
      expect(consoleSpy).toHaveBeenCalledWith('Member command channel: mchannel123');
      expect(consoleSpy).toHaveBeenCalledWith('Moderator role ID: mod123');
      expect(consoleSpy).toHaveBeenCalledWith('Member role ID: member123');
    });

    it('should display proposal configuration', async () => {
      await lifecycleManager.handleReady();

      expect(consoleSpy).toHaveBeenCalledWith('Proposal types configured:');
      expect(consoleSpy).toHaveBeenCalledWith('  policy: 5 reactions, 86400000ms duration');
      expect(consoleSpy).toHaveBeenCalledWith('    Debate: debate123, Vote: vote123, Resolutions: res123');
    });

    it('should handle missing proposal config', async () => {
      mockBot.proposalManager.proposalConfig = null;
      
      await lifecycleManager.handleReady();

      expect(consoleSpy).not.toHaveBeenCalledWith('Proposal types configured:');
    });

    it('should pre-cache messages when configs exist', async () => {
      const mockConfigs = [
        { from: 'msg123', action: 'role:member' },
        { from: 'msg456', action: 'role:moderator' }
      ];
      mockBot.configManager.getConfig.mockReturnValue(mockConfigs);

      await lifecycleManager.handleReady();

      expect(lifecycleManager.preCacheMessages).toHaveBeenCalledWith(mockConfigs);
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Pre-caching reaction messages...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Message pre-caching completed');
    });

    it('should pre-cache vote messages when active votes exist', async () => {
      const mockVotes = [{ voteMessageId: 'vote123', voteChannelId: 'vchan123' }];
      mockBot.proposalManager.getActiveVotes.mockResolvedValue(mockVotes);

      await lifecycleManager.handleReady();

      expect(lifecycleManager.preCacheVoteMessages).toHaveBeenCalledWith(mockVotes);
      expect(consoleSpy).toHaveBeenCalledWith('🔄 Pre-caching active vote messages...');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Vote message pre-caching completed');
    });

    it('should post deployment confirmation', async () => {
      await lifecycleManager.handleReady();

      expect(lifecycleManager.postDeploymentConfirmation).toHaveBeenCalled();
    });

    it('should emit botReady event', async () => {
      await lifecycleManager.handleReady();

      expect(process.emit).toHaveBeenCalledWith('botReady');
    });
  });

  describe('preCacheMessages', () => {
    let mockChannel2;
    
    beforeEach(() => {
      mockChannel2 = {
        ...mockChannel,
        name: 'channel2',
        id: 'channel2',
        isTextBased: () => true,
        messages: {
          fetch: jest.fn().mockResolvedValue({ id: 'cached456' })
        }
      };
      
      mockGuild.channels.cache = new Map([
        ['channel1', mockChannel],
        ['channel2', mockChannel2]
      ]);
    });

    it('should cache messages successfully', async () => {
      const configs = [
        { from: 'msg123', action: 'role:member' },
        { from: 'msg456', action: 'role:moderator' }
      ];

      await lifecycleManager.preCacheMessages(configs);

      // Should find msg123 in first channel
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('msg123');
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('msg456');
      expect(consoleSpy).toHaveBeenCalledWith('Found 2 unique messages to cache from 2 configs');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Pre-caching complete');
    });

    it('should deduplicate message IDs', async () => {
      const configs = [
        { from: 'msg123', action: 'role:member' },
        { from: 'msg123', action: 'role:moderator' } // Same message, different action
      ];

      await lifecycleManager.preCacheMessages(configs);

      expect(consoleSpy).toHaveBeenCalledWith('Found 1 unique messages to cache from 2 configs');
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('msg123');
      // Should be called once since message is found in first channel
      expect(mockChannel.messages.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle guild not found', async () => {
      mockClient.guilds.cache.get.mockReturnValue(null);

      await lifecycleManager.preCacheMessages([]);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Guild not found for pre-caching');
    });

    it('should handle message not found', async () => {
      // Both channels should reject to trigger "not found" message
      mockChannel.messages.fetch.mockRejectedValue(new Error('Message not found'));
      mockChannel2.messages.fetch.mockRejectedValue(new Error('Message not found'));
      const configs = [{ from: 'msg999', action: 'role:member' }];

      await lifecycleManager.preCacheMessages(configs);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Message msg999 not found in any channel');
    });

    it('should skip non-text channels', async () => {
      const nonTextChannel = { ...mockChannel, isTextBased: () => false };
      mockGuild.channels.cache = new Map([['voice1', nonTextChannel]]);
      const configs = [{ from: 'msg123', action: 'role:member' }];

      await lifecycleManager.preCacheMessages(configs);

      expect(nonTextChannel.messages.fetch).not.toHaveBeenCalled();
    });
  });

  describe('preCacheVoteMessages', () => {
    it('should cache vote messages successfully', async () => {
      const votes = [
        { voteMessageId: 'vote123', voteChannelId: 'channel123' }
      ];

      await lifecycleManager.preCacheVoteMessages(votes);

      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('vote123');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Cached vote message vote123');
    });

    it('should handle guild not found', async () => {
      mockClient.guilds.cache.get.mockReturnValue(null);

      await lifecycleManager.preCacheVoteMessages([]);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Guild not found for vote pre-caching');
    });

    it('should handle vote message not found', async () => {
      mockChannel.messages.fetch.mockRejectedValue(new Error('Message not found'));
      const votes = [{ voteMessageId: 'vote999', voteChannelId: 'channel123' }];

      await lifecycleManager.preCacheVoteMessages(votes);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Could not cache vote message vote999');
    });

    it('should handle channel not found', async () => {
      const votes = [{ voteMessageId: 'vote123', voteChannelId: 'missing123' }];

      await lifecycleManager.preCacheVoteMessages(votes);

      // Should not attempt to fetch from non-existent channel
      expect(mockChannel.messages.fetch).not.toHaveBeenCalled();
    });
  });

  describe('postDeploymentConfirmation', () => {
    it('should post deployment confirmation successfully', async () => {
      const mockUptime = 42;
      jest.spyOn(process, 'uptime').mockReturnValue(mockUptime);

      await lifecycleManager.postDeploymentConfirmation();

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.stringMatching(/🤖 \*\*Bot run123 Online\*\* - New version deployed and ready/)
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ Posted deployment confirmation to moderator-bot channel');
    });

    it('should handle guild not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockClient.guilds.cache.get.mockReturnValue(null);

      await lifecycleManager.postDeploymentConfirmation();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Guild not found for deployment confirmation')
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle channel not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockGuild.channels.cache.get = jest.fn().mockReturnValue(null);

      await lifecycleManager.postDeploymentConfirmation();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Moderator bot channel not found')
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle bot member not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockGuild.members.cache.get.mockReturnValue(null);

      await lifecycleManager.postDeploymentConfirmation();

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Bot member not found in guild');
      consoleErrorSpy.mockRestore();
    });

    it('should handle missing send permissions', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockPermissions = {
        has: jest.fn().mockReturnValue(false),
        toArray: jest.fn().mockReturnValue(['ViewChannel'])
      };
      mockChannel.permissionsFor.mockReturnValue(mockPermissions);

      await lifecycleManager.postDeploymentConfirmation();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bot does not have SendMessages permission')
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('postShutdownMessage', () => {
    beforeEach(() => {
      jest.spyOn(lifecycleManager, 'sendShutdownMessage').mockResolvedValue();
    });

    it('should send shutdown message successfully', async () => {
      await lifecycleManager.postShutdownMessage('Test shutdown');

      expect(lifecycleManager.sendShutdownMessage).toHaveBeenCalledWith('Test shutdown');
      expect(lifecycleManager.shutdownMessageSent).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Shutdown message sent successfully for: Test shutdown');
    });

    it('should prevent duplicate shutdown messages', async () => {
      lifecycleManager.shutdownMessageSent = true;

      await lifecycleManager.postShutdownMessage('Test shutdown');

      expect(lifecycleManager.sendShutdownMessage).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '🔄 Shutdown message already sent, skipping duplicate for: Test shutdown'
      );
    });

    it('should handle timeout', async () => {
      jest.useFakeTimers();
      lifecycleManager.sendShutdownMessage.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 6000))
      );
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const shutdownPromise = lifecycleManager.postShutdownMessage('Timeout test');
      jest.advanceTimersByTime(6000);
      await shutdownPromise;

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error posting shutdown message for Timeout test'),
        expect.any(Error)
      );
      expect(lifecycleManager.shutdownMessageSent).toBe(false);

      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should handle send errors', async () => {
      const error = new Error('Send failed');
      lifecycleManager.sendShutdownMessage.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await lifecycleManager.postShutdownMessage('Error test');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Error posting shutdown message for Error test:',
        error
      );
      expect(lifecycleManager.shutdownMessageSent).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('sendShutdownMessage', () => {
    it('should send shutdown message successfully', async () => {
      const mockUptime = 123;
      jest.spyOn(process, 'uptime').mockReturnValue(mockUptime);

      await lifecycleManager.sendShutdownMessage('Test reason');

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.stringMatching(/🔄 \*\*Bot run123 Shutting Down\*\* - Test reason/)
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ Posted shutdown message to moderator bot channel successfully');
    });

    it('should handle guild not found', async () => {
      mockClient.guilds.cache.get.mockReturnValue(null);

      await lifecycleManager.sendShutdownMessage('Test reason');

      expect(consoleSpy).toHaveBeenCalledWith('❌ Guild not found for shutdown message. Guild ID: guild123');
    });

    it('should handle channel not found', async () => {
      // Create a proper Map mock with channels that don't match the target
      const mockChannelMap = new Map([
        ['other1', { name: 'general', id: 'other1' }],
        ['other2', { name: 'random', id: 'other2' }]
      ]);
      mockGuild.channels.cache = mockChannelMap;
      mockGuild.channels.cache.get = jest.fn().mockReturnValue(null);

      await lifecycleManager.sendShutdownMessage('Test reason');

      expect(consoleSpy).toHaveBeenCalledWith('❌ Moderator bot channel channel123 not found');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Available channels:'));
    });

    it('should handle send errors', async () => {
      const error = new Error('Channel send failed');
      mockChannel.send.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(lifecycleManager.sendShutdownMessage('Test reason')).rejects.toThrow('Channel send failed');
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to send shutdown message to channel:', error);
      consoleErrorSpy.mockRestore();
    });
  });
});