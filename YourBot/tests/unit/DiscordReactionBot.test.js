const DiscordReactionBot = require('../../src/DiscordReactionBot');
const fs = require('fs').promises;

// Mock Discord.js components
const mockClient = {
  once: jest.fn(),
  on: jest.fn(),
  login: jest.fn().mockResolvedValue(),
  destroy: jest.fn(),
  user: { tag: 'TestBot#1234' },
  guilds: {
    cache: {
      get: jest.fn()
    }
  }
};

jest.mock('discord.js', () => ({
  Client: jest.fn().mockImplementation(() => mockClient),
  GatewayIntentBits: {
    Guilds: 'guilds',
    GuildMessages: 'guildMessages',
    GuildMessageReactions: 'guildMessageReactions',
    MessageContent: 'messageContent',
    GuildMembers: 'guildMembers'
  }
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

// Mock the module dependencies
jest.mock('../../src/ConfigManager');
jest.mock('../../src/EventHandlers');
jest.mock('../../src/CommandHandler');
jest.mock('../../src/UserValidator');
jest.mock('../../src/ProposalManager');

const ConfigManager = require('../../src/ConfigManager');
const EventHandlers = require('../../src/EventHandlers');
const CommandHandler = require('../../src/CommandHandler');
const UserValidator = require('../../src/UserValidator');
const ProposalManager = require('../../src/ProposalManager');

describe('DiscordReactionBot', () => {
  let bot;
  let mockGuild;
  let mockChannel;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock guild and channels
    mockChannel = {
      isTextBased: () => true,
      messages: {
        fetch: jest.fn().mockResolvedValue({ id: 'msg123' })
      },
      name: 'test-channel'
    };
    
    mockGuild = {
      channels: {
        cache: new Map([['channel123', mockChannel]])
      }
    };
    
    mockClient.guilds.cache.get.mockReturnValue(mockGuild);

    // Mock module constructors
    ConfigManager.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      getConfig: jest.fn().mockReturnValue([])
    }));

    EventHandlers.mockImplementation(() => ({
      handleReactionAdd: jest.fn(),
      handleReactionRemove: jest.fn(),
      handleMessage: jest.fn()
    }));

    CommandHandler.mockImplementation(() => ({}));
    UserValidator.mockImplementation(() => ({}));

    ProposalManager.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(),
      getActiveVotes: jest.fn().mockReturnValue([]),
      proposalConfig: null
    }));

    bot = new DiscordReactionBot();
  });

  describe('constructor', () => {
    it('should initialize with correct Discord intents', () => {
      const { Client, GatewayIntentBits } = require('discord.js');
      
      expect(Client).toHaveBeenCalledWith({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildMessageReactions,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildMembers
        ]
      });
    });

    it('should initialize all modules', () => {
      expect(ConfigManager).toHaveBeenCalledTimes(1);
      expect(EventHandlers).toHaveBeenCalledWith(bot);
      expect(CommandHandler).toHaveBeenCalledWith(bot);
      expect(UserValidator).toHaveBeenCalledTimes(1);
      expect(ProposalManager).toHaveBeenCalledWith(bot);
    });

    it('should set up event handlers', () => {
      expect(mockClient.once).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('messageReactionAdd', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('messageReactionRemove', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('messageCreate', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('warn', expect.any(Function));
    });
  });

  describe('initialize', () => {
    const mockRuntimeConfig = {
      guildId: 'guild123',
      botToken: 'bot-token-123',
      moderatorRoleId: 'mod-role-123',
      memberRoleId: 'member-role-123',
      commandChannelId: 'command-channel-123',
      memberCommandChannelId: 'member-command-channel-123',
      dynamodbTable: 'test-dynamo-table',
      reactionRoleConfig: [],
      proposalConfig: {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000
        }
      }
    };

    beforeEach(() => {
      fs.readFile.mockResolvedValue(JSON.stringify(mockRuntimeConfig));
    });

    it('should load runtime configuration successfully', async () => {
      await bot.initialize();

      expect(fs.readFile).toHaveBeenCalledWith('runtime.config.json', 'utf8');
      expect(bot.guildId).toBe('guild123');
      expect(bot.botToken).toBe('bot-token-123');
      expect(bot.moderatorRoleId).toBe('mod-role-123');
      expect(bot.memberRoleId).toBe('member-role-123');
      expect(bot.commandChannelId).toBe('command-channel-123');
      expect(bot.memberCommandChannelId).toBe('member-command-channel-123');
    });

    it('should initialize config manager with runtime config', async () => {
      await bot.initialize();

      expect(bot.configManager.initialize).toHaveBeenCalledWith([]);
    });

    it('should initialize proposal manager with runtime config', async () => {
      await bot.initialize();

      expect(bot.proposalManager.initialize).toHaveBeenCalledWith(
        'test-dynamo-table',
        'guild123',
        mockRuntimeConfig.proposalConfig
      );
    });

    it('should login to Discord', async () => {
      await bot.initialize();

      expect(mockClient.login).toHaveBeenCalledWith('bot-token-123');
    });

    it('should handle configuration file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await bot.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize bot:', expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle Discord login errors', async () => {
      mockClient.login.mockRejectedValue(new Error('Invalid token'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

      await bot.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize bot:', expect.any(Error));
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('event handlers', () => {
    it('should delegate reaction add events to event handlers', () => {
      const mockReaction = { message: { id: 'msg123' } };
      const mockUser = { id: 'user123' };

      // Get the event handler function and call it
      const reactionAddHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageReactionAdd')[1];
      reactionAddHandler(mockReaction, mockUser);

      expect(bot.eventHandlers.handleReactionAdd).toHaveBeenCalledWith(mockReaction, mockUser);
    });

    it('should delegate reaction remove events to event handlers', () => {
      const mockReaction = { message: { id: 'msg123' } };
      const mockUser = { id: 'user123' };

      const reactionRemoveHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageReactionRemove')[1];
      reactionRemoveHandler(mockReaction, mockUser);

      expect(bot.eventHandlers.handleReactionRemove).toHaveBeenCalledWith(mockReaction, mockUser);
    });

    it('should delegate message events to event handlers', () => {
      const mockMessage = { content: '!help', author: { id: 'user123' } };

      const messageHandler = mockClient.on.mock.calls.find(call => call[0] === 'messageCreate')[1];
      messageHandler(mockMessage);

      expect(bot.eventHandlers.handleMessage).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle Discord client errors', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockError = new Error('Connection lost');

      const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error')[1];
      errorHandler(mockError);

      expect(consoleSpy).toHaveBeenCalledWith('Discord client error:', mockError);
      consoleSpy.mockRestore();
    });

    it('should handle Discord client warnings', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mockWarning = 'Rate limit warning';

      const warnHandler = mockClient.on.mock.calls.find(call => call[0] === 'warn')[1];
      warnHandler(mockWarning);

      expect(consoleSpy).toHaveBeenCalledWith('Discord client warning:', mockWarning);
      consoleSpy.mockRestore();
    });
  });

  describe('ready event handler', () => {
    let readyHandler;

    beforeEach(() => {
      bot.guildId = 'guild123';
      bot.commandChannelId = 'command123';
      bot.memberCommandChannelId = 'member123';
      bot.moderatorRoleId = 'mod123';
      bot.memberRoleId = 'member123';

      readyHandler = mockClient.once.mock.calls.find(call => call[0] === 'ready')[1];
    });

    it('should log bot information on ready', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      bot.configManager.getConfig.mockReturnValue([]);
      bot.proposalManager.getActiveVotes.mockReturnValue([]);

      await readyHandler();

      expect(consoleSpy).toHaveBeenCalledWith('Bot logged in as TestBot#1234');
      expect(consoleSpy).toHaveBeenCalledWith('Monitoring guild: guild123');
      consoleSpy.mockRestore();
    });

    it('should log proposal configuration when available', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      bot.configManager.getConfig.mockReturnValue([]);
      bot.proposalManager.getActiveVotes.mockReturnValue([]);
      bot.proposalManager.proposalConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          debateChannelId: 'debate123',
          voteChannelId: 'vote123',
          resolutionsChannelId: 'res123'
        }
      };

      await readyHandler();

      expect(consoleSpy).toHaveBeenCalledWith('Proposal types configured:');
      expect(consoleSpy).toHaveBeenCalledWith('  policy: 5 reactions, 86400000ms duration');
      consoleSpy.mockRestore();
    });

    it('should pre-cache messages when configs exist', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockConfigs = [
        { from: 'msg123', action: 'emoji1' },
        { from: 'msg456', action: 'emoji2' }
      ];
      
      bot.configManager.getConfig.mockReturnValue(mockConfigs);
      bot.proposalManager.getActiveVotes.mockReturnValue([]);
      bot.preCacheMessages = jest.fn().mockResolvedValue();

      await readyHandler();

      expect(bot.preCacheMessages).toHaveBeenCalledWith(mockConfigs);
      consoleSpy.mockRestore();
    });

    it('should pre-cache vote messages when active votes exist', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockVotes = [
        { voteMessageId: 'vote123', voteChannelId: 'channel123' }
      ];
      
      bot.configManager.getConfig.mockReturnValue([]);
      bot.proposalManager.getActiveVotes.mockReturnValue(mockVotes);
      bot.preCacheVoteMessages = jest.fn().mockResolvedValue();

      await readyHandler();

      expect(bot.preCacheVoteMessages).toHaveBeenCalledWith(mockVotes);
      consoleSpy.mockRestore();
    });
  });

  describe('preCacheMessages', () => {
    beforeEach(() => {
      bot.guildId = 'guild123';
      bot.client = mockClient;
    });

    it('should cache messages successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const configs = [
        { from: 'msg123', action: 'emoji1' },
        { from: 'msg456', action: 'emoji2' }
      ];

      await bot.preCacheMessages(configs);

      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('msg123');
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('msg456');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Pre-caching complete');
      consoleSpy.mockRestore();
    });

    it('should handle guild not found', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockClient.guilds.cache.get.mockReturnValue(null);

      await bot.preCacheMessages([]);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Guild not found for pre-caching');
      consoleSpy.mockRestore();
    });

    it('should handle message not found', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockChannel.messages.fetch.mockRejectedValue(new Error('Message not found'));
      
      const configs = [{ from: 'msg999', action: 'emoji1' }];

      await bot.preCacheMessages(configs);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Message msg999 not found in any channel');
      consoleSpy.mockRestore();
    });

    it('should deduplicate message IDs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const configs = [
        { from: 'msg123', action: 'emoji1' },
        { from: 'msg123', action: 'emoji2' }  // Same message, different reaction
      ];

      await bot.preCacheMessages(configs);

      expect(mockChannel.messages.fetch).toHaveBeenCalledTimes(1);
      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('msg123');
      consoleSpy.mockRestore();
    });
  });

  describe('preCacheVoteMessages', () => {
    beforeEach(() => {
      bot.guildId = 'guild123';
      bot.client = mockClient;
    });

    it('should cache vote messages successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const votes = [
        { voteMessageId: 'vote123', voteChannelId: 'channel123' }
      ];

      await bot.preCacheVoteMessages(votes);

      expect(mockChannel.messages.fetch).toHaveBeenCalledWith('vote123');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Cached vote message vote123');
      consoleSpy.mockRestore();
    });

    it('should handle guild not found', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockClient.guilds.cache.get.mockReturnValue(null);

      await bot.preCacheVoteMessages([]);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Guild not found for vote pre-caching');
      consoleSpy.mockRestore();
    });

    it('should handle vote message not found', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockChannel.messages.fetch.mockRejectedValue(new Error('Message not found'));
      
      const votes = [{ voteMessageId: 'vote999', voteChannelId: 'channel123' }];

      await bot.preCacheVoteMessages(votes);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Could not cache vote message vote999');
      consoleSpy.mockRestore();
    });
  });

  describe('getter methods', () => {
    beforeEach(() => {
      bot.guildId = 'guild123';
      bot.moderatorRoleId = 'mod123';
      bot.memberRoleId = 'member123';
      bot.commandChannelId = 'command123';
      bot.memberCommandChannelId = 'memberCommand123';
    });

    it('should return correct guild ID', () => {
      expect(bot.getGuildId()).toBe('guild123');
    });

    it('should return correct moderator role ID', () => {
      expect(bot.getModeratorRoleId()).toBe('mod123');
    });

    it('should return correct member role ID', () => {
      expect(bot.getMemberRoleId()).toBe('member123');
    });

    it('should return correct command channel ID', () => {
      expect(bot.getCommandChannelId()).toBe('command123');
    });

    it('should return correct member command channel ID', () => {
      expect(bot.getMemberCommandChannelId()).toBe('memberCommand123');
    });

    it('should return config from config manager', () => {
      const mockConfig = [{ from: 'msg123', action: 'emoji' }];
      bot.configManager.getConfig.mockReturnValue(mockConfig);

      expect(bot.getConfig()).toBe(mockConfig);
    });

    it('should return config manager instance', () => {
      expect(bot.getConfigManager()).toBe(bot.configManager);
    });

    it('should return proposal manager instance', () => {
      expect(bot.getProposalManager()).toBe(bot.proposalManager);
    });

    it('should return user validator instance', () => {
      expect(bot.getUserValidator()).toBe(bot.userValidator);
    });
  });
});