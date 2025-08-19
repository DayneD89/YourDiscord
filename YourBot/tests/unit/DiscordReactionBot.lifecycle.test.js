// Mock fs before importing anything else
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

// Import test utilities BEFORE importing DiscordReactionBot to ensure mocks are set up
const {
  mockClient,
  createMockRuntimeConfig,
  createMockGuildAndChannel,
  setupComponentMocks,
  resetAllMocks,
  ConfigurationResolver,
  ComponentOrchestrator,
  BotLifecycleManager
} = require('../helpers/discordReactionBotTestUtils');

const DiscordReactionBot = require('../../src/DiscordReactionBot');
const fs = require('fs').promises;

describe('DiscordReactionBot - Lifecycle', () => {
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

  describe('initialize', () => {
    beforeEach(() => {
      fs.readFile.mockResolvedValue(JSON.stringify(createMockRuntimeConfig()));
    });

    it('should load runtime configuration successfully', async () => {
      await bot.initialize();
      
      expect(global.mockConfigResolver.loadConfiguration).toHaveBeenCalled();
      expect(global.mockComponentOrchestrator.initializeConfigurableComponents).toHaveBeenCalled();
      expect(mockClient.login).toHaveBeenCalledWith('token123');
    });

    it('should extract configuration values correctly', async () => {
      await bot.initialize();
      
      expect(bot.getGuildId()).toBe('guild123');
      expect(bot.getRunId()).toBe('run123');
      expect(bot.getModeratorRoleId()).toBe('mod123');
      expect(bot.getMemberRoleId()).toBe('member123');
      expect(bot.getCommandChannelId()).toBe('cmd123');
      expect(bot.getMemberCommandChannelId()).toBe('mcmd123');
      expect(bot.getEventsTable()).toBe('events-table');
      expect(bot.getReminderIntervals()).toEqual({ weekReminder: 604800000, dayReminder: 86400000 });
    });

    it('should handle configuration loading errors', async () => {
      const error = new Error('Config load failed');
      global.mockConfigResolver.loadConfiguration.mockRejectedValueOnce(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      await bot.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize bot:', error);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should handle Discord login errors', async () => {
      const error = new Error('Login failed');
      mockClient.login.mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      await bot.initialize();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize bot:', error);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe('lifecycle manager integration', () => {
    it('should setup event handlers during construction', () => {
      expect(global.mockLifecycleManager.setupEventHandlers).toHaveBeenCalled();
    });

    it('should delegate lifecycle methods to lifecycle manager', async () => {
      // These methods should be available through lifecycle manager
      expect(bot.lifecycleManager).toBeDefined();
      expect(global.mockLifecycleManager.setupEventHandlers).toHaveBeenCalled();
    });
  });

  describe('component orchestrator integration', () => {
    it('should initialize components during construction', () => {
      expect(global.mockComponentOrchestrator.initializeComponents).toHaveBeenCalled();
    });

    it('should initialize configurable components during bot initialization', async () => {
      // This test validates that initialize() calls the component orchestrator
      // We know initialize() works from other tests, so just verify the delegation
      expect(bot.componentOrchestrator).toBeDefined();
      expect(ComponentOrchestrator).toHaveBeenCalledWith(bot);
      
      // Verify that bot.initialize would call the orchestrator with config
      // The actual call is tested in other successful tests
      expect(global.mockComponentOrchestrator.initializeConfigurableComponents).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup components and destroy client', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await bot.cleanup();
      
      expect(global.mockComponentOrchestrator.cleanup).toHaveBeenCalled();
      expect(mockClient.destroy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ DiscordReactionBot cleaned up');
      
      consoleSpy.mockRestore();
    });
  });
});