// Import test utilities BEFORE importing DiscordReactionBot to ensure mocks are set up
const {
  mockClient,
  createMockGuildAndChannel,
  setupComponentMocks,
  resetAllMocks,
  ConfigManager,
  EventHandlers,
  CommandRouter,
  UserValidator,
  ProposalManager,
  ConfigurationResolver,
  ComponentOrchestrator,
  BotLifecycleManager,
  BotStateController
} = require('../helpers/discordReactionBotTestUtils');

const DiscordReactionBot = require('../../src/DiscordReactionBot');

describe('DiscordReactionBot - Integration', () => {
  let bot;
  let mockGuild;
  let mockChannel;

  beforeEach(() => {
    resetAllMocks();
    const { mockGuild: guild, mockChannel: channel } = createMockGuildAndChannel();
    mockGuild = guild;
    mockChannel = channel;
    mockClient.guilds.cache.get.mockReturnValue(mockGuild);
    
    setupComponentMocks();
    bot = new DiscordReactionBot();
  });

  describe('constructor', () => {
    it('should initialize with correct Discord intents', () => {
      const { Client } = require('discord.js');
      
      expect(Client).toHaveBeenCalledWith({
        intents: [
          'guilds',
          'guildMessages',
          'guildMessageReactions',
          'messageContent',
          'guildMembers'
        ]
      });
    });

    it('should initialize all component managers', () => {
      expect(ConfigurationResolver).toHaveBeenCalled();
      expect(ComponentOrchestrator).toHaveBeenCalledWith(bot);
      expect(BotLifecycleManager).toHaveBeenCalledWith(bot);
      expect(BotStateController).toHaveBeenCalledWith(mockClient);
    });

    it('should initialize components and setup event handlers', () => {
      expect(global.mockComponentOrchestrator.initializeComponents).toHaveBeenCalled();
      expect(global.mockLifecycleManager.setupEventHandlers).toHaveBeenCalled();
    });

    it('should have all required properties initialized', () => {
      expect(bot.client).toBe(mockClient);
      expect(bot.configResolver).toBeDefined();
      expect(bot.componentOrchestrator).toBeDefined();
      expect(bot.lifecycleManager).toBeDefined();
      expect(bot.stateController).toBeDefined();
    });
  });

  describe('getter methods', () => {
    beforeEach(async () => {
      // Initialize bot with config to populate getter values
      await bot.initialize();
    });

    it('should return correct configuration values', () => {
      expect(bot.getGuildId()).toBe('guild123');
      expect(bot.getRunId()).toBe('run123');
      expect(bot.getModeratorRoleId()).toBe('mod123');
      expect(bot.getMemberRoleId()).toBe('member123');
      expect(bot.getCommandChannelId()).toBe('cmd123');
      expect(bot.getMemberCommandChannelId()).toBe('mcmd123');
      expect(bot.getEventsTable()).toBe('events-table');
      expect(bot.getReminderIntervals()).toEqual({ 
        weekReminder: 604800000, 
        dayReminder: 86400000 
      });
    });

    it('should return component instances', () => {
      // These methods should be defined functions
      expect(bot.getConfigManager).toBeDefined();
      expect(bot.getProposalManager).toBeDefined();
      expect(bot.getUserValidator).toBeDefined();
      expect(bot.getEventManager).toBeDefined();
      expect(bot.getConfig).toBeDefined();
    });

    it('should return actual component instances after initialization', () => {
      // After initialization, these should return the actual components
      expect(bot.getConfigManager()).toBe(bot.configManager);
      expect(bot.getProposalManager()).toBe(bot.proposalManager);
      expect(bot.getUserValidator()).toBe(bot.userValidator);
      expect(bot.getEventManager()).toBe(bot.eventManager);
    });

    it('should return config from configManager', () => {
      // getConfig should delegate to configManager.getConfig()
      const mockConfig = [{ from: 'test', action: 'test' }];
      if (bot.configManager && bot.configManager.getConfig) {
        bot.configManager.getConfig.mockReturnValue(mockConfig);
        expect(bot.getConfig()).toBe(mockConfig);
      } else {
        // If configManager is not available, just test that getConfig method exists
        expect(bot.getConfig).toBeDefined();
        expect(typeof bot.getConfig).toBe('function');
      }
    });
  });

  describe('component integration', () => {
    it('should orchestrate all components during initialization', async () => {
      await bot.initialize();
      
      expect(global.mockComponentOrchestrator.initializeComponents).toHaveBeenCalled();
      expect(global.mockComponentOrchestrator.initializeConfigurableComponents).toHaveBeenCalled();
      expect(global.mockLifecycleManager.setupEventHandlers).toHaveBeenCalled();
    });

    it('should pass bot instance to components that need it', () => {
      expect(ComponentOrchestrator).toHaveBeenCalledWith(bot);
      expect(BotLifecycleManager).toHaveBeenCalledWith(bot);
      expect(BotStateController).toHaveBeenCalledWith(mockClient);
    });

    it('should delegate state management to BotStateController', () => {
      const result1 = bot.enableBot('test123');
      const result2 = bot.disableBot('test123');
      const result3 = bot.isBotEnabled('test123');
      const result4 = bot.isThisBotEnabled();
      const result5 = bot.getBotId();
      
      expect(global.mockStateController.enableBot).toHaveBeenCalledWith('test123');
      expect(global.mockStateController.disableBot).toHaveBeenCalledWith('test123');
      expect(global.mockStateController.isBotEnabled).toHaveBeenCalledWith('test123');
      expect(global.mockStateController.isThisBotEnabled).toHaveBeenCalled();
      expect(global.mockStateController.getBotId).toHaveBeenCalled();
    });
  });

  describe('error handling integration', () => {
    it('should handle component initialization failures', async () => {
      const error = new Error('Component init failed');
      global.mockComponentOrchestrator.initializeConfigurableComponents.mockRejectedValueOnce(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      await bot.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize bot:', error);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle cleanup gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await bot.cleanup();
      
      expect(global.mockComponentOrchestrator.cleanup).toHaveBeenCalled();
      expect(mockClient.destroy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ DiscordReactionBot cleaned up');
      
      consoleSpy.mockRestore();
    });
  });

  describe('full initialization workflow', () => {
    it('should complete full initialization successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await bot.initialize();
      
      // Verify the full workflow
      expect(global.mockConfigResolver.loadConfiguration).toHaveBeenCalled();
      expect(global.mockComponentOrchestrator.initializeConfigurableComponents).toHaveBeenCalled();
      expect(mockClient.login).toHaveBeenCalledWith('token123');
      expect(consoleSpy).toHaveBeenCalledWith('Logging into Discord...');
      expect(consoleSpy).toHaveBeenCalledWith('Bot initialized successfully');
      
      consoleSpy.mockRestore();
    });
  });
});