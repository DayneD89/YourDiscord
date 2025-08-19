// Import test utilities BEFORE importing DiscordReactionBot to ensure mocks are set up
const {
  mockClient,
  setupComponentMocks,
  resetAllMocks,
  BotStateController
} = require('../helpers/discordReactionBotTestUtils');

const DiscordReactionBot = require('../../src/DiscordReactionBot');

describe('DiscordReactionBot - State Management', () => {
  let bot;

  beforeEach(() => {
    resetAllMocks();
    setupComponentMocks();
    bot = new DiscordReactionBot();
  });

  describe('bot state delegation', () => {
    it('should delegate enableBot to state controller', () => {
      bot.enableBot('bot456');
      
      expect(global.mockStateController.enableBot).toHaveBeenCalledWith('bot456');
    });

    it('should delegate disableBot to state controller', () => {
      bot.disableBot('bot456');
      
      expect(global.mockStateController.disableBot).toHaveBeenCalledWith('bot456');
    });

    it('should delegate isBotEnabled to state controller', () => {
      global.mockStateController.isBotEnabled.mockReturnValue(true);
      
      const result = bot.isBotEnabled('bot456');
      
      expect(global.mockStateController.isBotEnabled).toHaveBeenCalledWith('bot456');
      expect(result).toBe(true);
    });

    it('should delegate isThisBotEnabled to state controller', () => {
      global.mockStateController.isThisBotEnabled.mockReturnValue(false);
      
      const result = bot.isThisBotEnabled();
      
      expect(global.mockStateController.isThisBotEnabled).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should delegate getBotId to state controller', () => {
      global.mockStateController.getBotId.mockReturnValue('bot789');
      
      const result = bot.getBotId();
      
      expect(global.mockStateController.getBotId).toHaveBeenCalled();
      expect(result).toBe('bot789');
    });
  });

  describe('state controller initialization', () => {
    it('should initialize state controller with client', () => {
      expect(BotStateController).toHaveBeenCalledWith(mockClient);
    });

    it('should have state controller instance', () => {
      expect(bot.stateController).toBe(global.mockStateController);
    });
  });

  describe('state behavior scenarios', () => {
    it('should handle bot enabling workflow', () => {
      global.mockStateController.isBotEnabled.mockReturnValue(false);
      global.mockStateController.isBotEnabled.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      // Initially disabled
      expect(bot.isBotEnabled('bot456')).toBe(false);
      
      // Enable bot
      bot.enableBot('bot456');
      
      // Now enabled
      expect(bot.isBotEnabled('bot456')).toBe(true);
      expect(global.mockStateController.enableBot).toHaveBeenCalledWith('bot456');
    });

    it('should handle bot disabling workflow', () => {
      global.mockStateController.isBotEnabled.mockReturnValue(true);
      global.mockStateController.isBotEnabled.mockReturnValueOnce(true).mockReturnValueOnce(false);
      
      // Initially enabled
      expect(bot.isBotEnabled('bot456')).toBe(true);
      
      // Disable bot
      bot.disableBot('bot456');
      
      // Now disabled
      expect(bot.isBotEnabled('bot456')).toBe(false);
      expect(global.mockStateController.disableBot).toHaveBeenCalledWith('bot456');
    });

    it('should handle current bot state changes', () => {
      global.mockStateController.isThisBotEnabled
        .mockReturnValueOnce(true)  // Initially enabled
        .mockReturnValueOnce(false) // After disable
        .mockReturnValueOnce(true); // After re-enable
      
      // Initially enabled
      expect(bot.isThisBotEnabled()).toBe(true);
      
      // Disable current bot
      bot.disableBot('bot123');
      expect(bot.isThisBotEnabled()).toBe(false);
      
      // Re-enable current bot
      bot.enableBot('bot123');
      expect(bot.isThisBotEnabled()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null bot ID gracefully', () => {
      global.mockStateController.getBotId.mockReturnValue(null);
      
      const result = bot.getBotId();
      
      expect(result).toBe(null);
    });

    it('should handle state controller errors gracefully', () => {
      global.mockStateController.enableBot.mockImplementation(() => {
        throw new Error('State error');
      });
      
      expect(() => bot.enableBot('bot456')).toThrow('State error');
    });
  });
});