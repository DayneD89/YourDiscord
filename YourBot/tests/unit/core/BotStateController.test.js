const BotStateController = require('../../../src/core/BotStateController');

describe('BotStateController', () => {
  let stateController;
  let mockClient;
  let consoleSpy;

  beforeEach(() => {
    mockClient = {
      user: {
        id: 'bot123',
        tag: 'TestBot#1234'
      }
    };

    stateController = new BotStateController(mockClient);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with client and empty bot states', () => {
      expect(stateController.client).toBe(mockClient);
      expect(stateController.botStates).toBeInstanceOf(Map);
      expect(stateController.botStates.size).toBe(0);
    });

    it('should handle null client', () => {
      const controller = new BotStateController(null);
      expect(controller.client).toBeNull();
      expect(controller.botStates).toBeInstanceOf(Map);
    });
  });

  describe('enableBot', () => {
    it('should enable a bot and log success', () => {
      stateController.enableBot('bot456');

      expect(stateController.botStates.get('bot456')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Bot bot456 enabled');
    });

    it('should enable multiple bots independently', () => {
      stateController.enableBot('bot456');
      stateController.enableBot('bot789');

      expect(stateController.botStates.get('bot456')).toBe(true);
      expect(stateController.botStates.get('bot789')).toBe(true);
      expect(stateController.botStates.size).toBe(2);
    });

    it('should re-enable a previously disabled bot', () => {
      stateController.disableBot('bot456');
      stateController.enableBot('bot456');

      expect(stateController.botStates.get('bot456')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Bot bot456 enabled');
    });
  });

  describe('disableBot', () => {
    it('should disable a bot and log success', () => {
      stateController.disableBot('bot456');

      expect(stateController.botStates.get('bot456')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Bot bot456 disabled');
    });

    it('should disable multiple bots independently', () => {
      stateController.disableBot('bot456');
      stateController.disableBot('bot789');

      expect(stateController.botStates.get('bot456')).toBe(false);
      expect(stateController.botStates.get('bot789')).toBe(false);
      expect(stateController.botStates.size).toBe(2);
    });

    it('should disable a previously enabled bot', () => {
      stateController.enableBot('bot456');
      stateController.disableBot('bot456');

      expect(stateController.botStates.get('bot456')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Bot bot456 disabled');
    });
  });

  describe('isBotEnabled', () => {
    it('should return true for enabled bots', () => {
      stateController.enableBot('bot456');
      expect(stateController.isBotEnabled('bot456')).toBe(true);
    });

    it('should return false for disabled bots', () => {
      stateController.disableBot('bot456');
      expect(stateController.isBotEnabled('bot456')).toBe(false);
    });

    it('should return true for unknown bots (default enabled)', () => {
      expect(stateController.isBotEnabled('unknown-bot')).toBe(true);
    });

    it('should handle empty bot ID', () => {
      expect(stateController.isBotEnabled('')).toBe(true);
    });

    it('should handle null bot ID', () => {
      expect(stateController.isBotEnabled(null)).toBe(true);
    });

    it('should handle undefined bot ID', () => {
      expect(stateController.isBotEnabled(undefined)).toBe(true);
    });
  });

  describe('isThisBotEnabled', () => {
    it('should return enabled status for current bot', () => {
      stateController.enableBot('bot123');
      expect(stateController.isThisBotEnabled()).toBe(true);
    });

    it('should return disabled status for current bot', () => {
      stateController.disableBot('bot123');
      expect(stateController.isThisBotEnabled()).toBe(false);
    });

    it('should return true when client user not ready', () => {
      stateController.client = { user: null };
      expect(stateController.isThisBotEnabled()).toBe(true);
    });

    it('should return true when client not ready', () => {
      stateController.client = null;
      expect(stateController.isThisBotEnabled()).toBe(true);
    });

    it('should return true when client is undefined', () => {
      stateController.client = undefined;
      expect(stateController.isThisBotEnabled()).toBe(true);
    });

    it('should return true for unknown current bot (default enabled)', () => {
      // Current bot not in states map - should default to enabled
      expect(stateController.isThisBotEnabled()).toBe(true);
    });
  });

  describe('getBotId', () => {
    it('should return current bot ID when ready', () => {
      expect(stateController.getBotId()).toBe('bot123');
    });

    it('should return null when client user not ready', () => {
      stateController.client = { user: null };
      expect(stateController.getBotId()).toBeNull();
    });

    it('should return null when client not ready', () => {
      stateController.client = null;
      expect(stateController.getBotId()).toBeNull();
    });

    it('should return null when client is undefined', () => {
      stateController.client = undefined;
      expect(stateController.getBotId()).toBeNull();
    });

    it('should return null when user is undefined', () => {
      stateController.client = {};
      expect(stateController.getBotId()).toBeNull();
    });
  });

  describe('getAllBotStates', () => {
    it('should return empty map when no states set', () => {
      const states = stateController.getAllBotStates();
      expect(states).toBeInstanceOf(Map);
      expect(states.size).toBe(0);
    });

    it('should return copy of all bot states', () => {
      stateController.enableBot('bot456');
      stateController.disableBot('bot789');

      const states = stateController.getAllBotStates();
      expect(states).toBeInstanceOf(Map);
      expect(states.size).toBe(2);
      expect(states.get('bot456')).toBe(true);
      expect(states.get('bot789')).toBe(false);
    });

    it('should return a copy not the original map', () => {
      stateController.enableBot('bot456');
      const states = stateController.getAllBotStates();
      
      // Modifying returned map should not affect original
      states.set('bot789', false);
      expect(stateController.botStates.size).toBe(1);
      expect(stateController.botStates.has('bot789')).toBe(false);
    });
  });

  describe('clearAllStates', () => {
    it('should clear all bot states and log success', () => {
      stateController.enableBot('bot456');
      stateController.disableBot('bot789');
      expect(stateController.botStates.size).toBe(2);

      stateController.clearAllStates();

      expect(stateController.botStates.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('🧹 All bot states cleared');
    });

    it('should handle clearing when no states exist', () => {
      stateController.clearAllStates();

      expect(stateController.botStates.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('🧹 All bot states cleared');
    });
  });

  describe('getStateStats', () => {
    it('should return correct stats for empty states', () => {
      const stats = stateController.getStateStats();
      expect(stats).toEqual({
        total: 0,
        enabled: 0,
        disabled: 0
      });
    });

    it('should return correct stats for mixed states', () => {
      stateController.enableBot('bot456');
      stateController.enableBot('bot789');
      stateController.disableBot('bot012');

      const stats = stateController.getStateStats();
      expect(stats).toEqual({
        total: 3,
        enabled: 2,
        disabled: 1
      });
    });

    it('should return correct stats for all enabled bots', () => {
      stateController.enableBot('bot456');
      stateController.enableBot('bot789');

      const stats = stateController.getStateStats();
      expect(stats).toEqual({
        total: 2,
        enabled: 2,
        disabled: 0
      });
    });

    it('should return correct stats for all disabled bots', () => {
      stateController.disableBot('bot456');
      stateController.disableBot('bot789');

      const stats = stateController.getStateStats();
      expect(stats).toEqual({
        total: 2,
        enabled: 0,
        disabled: 2
      });
    });
  });

  describe('state management workflows', () => {
    it('should handle complete enable/disable workflow', () => {
      const botId = 'bot456';

      // Initially unknown (defaults to enabled)
      expect(stateController.isBotEnabled(botId)).toBe(true);

      // Explicitly enable
      stateController.enableBot(botId);
      expect(stateController.isBotEnabled(botId)).toBe(true);

      // Disable
      stateController.disableBot(botId);
      expect(stateController.isBotEnabled(botId)).toBe(false);

      // Re-enable
      stateController.enableBot(botId);
      expect(stateController.isBotEnabled(botId)).toBe(true);
    });

    it('should handle multiple bot state changes', () => {
      const bot1 = 'bot456';
      const bot2 = 'bot789';
      const bot3 = 'bot012';

      // Set different states
      stateController.enableBot(bot1);
      stateController.disableBot(bot2);
      // bot3 remains unknown

      // Check individual states
      expect(stateController.isBotEnabled(bot1)).toBe(true);
      expect(stateController.isBotEnabled(bot2)).toBe(false);
      expect(stateController.isBotEnabled(bot3)).toBe(true); // Default

      // Check stats
      const stats = stateController.getStateStats();
      expect(stats.total).toBe(2); // Only explicitly set bots count
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
    });

    it('should handle current bot state management', () => {
      const currentBotId = mockClient.user.id;

      // Initially enabled (default)
      expect(stateController.isThisBotEnabled()).toBe(true);

      // Disable current bot
      stateController.disableBot(currentBotId);
      expect(stateController.isThisBotEnabled()).toBe(false);

      // Re-enable current bot
      stateController.enableBot(currentBotId);
      expect(stateController.isThisBotEnabled()).toBe(true);
    });

    it('should maintain state across client availability changes', () => {
      const botId = 'bot456';
      stateController.disableBot(botId);

      // Simulate client becoming unavailable
      const originalClient = stateController.client;
      stateController.client = null;

      // State should persist
      expect(stateController.isBotEnabled(botId)).toBe(false);

      // Restore client
      stateController.client = originalClient;
      expect(stateController.isBotEnabled(botId)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid state changes', () => {
      const botId = 'bot456';

      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          stateController.enableBot(botId);
          expect(stateController.isBotEnabled(botId)).toBe(true);
        } else {
          stateController.disableBot(botId);
          expect(stateController.isBotEnabled(botId)).toBe(false);
        }
      }

      // Final state should be enabled (even number of iterations)
      expect(stateController.isBotEnabled(botId)).toBe(false);
    });

    it('should handle very long bot IDs', () => {
      const longBotId = 'a'.repeat(1000);
      stateController.enableBot(longBotId);
      expect(stateController.isBotEnabled(longBotId)).toBe(true);
    });

    it('should handle special character bot IDs', () => {
      const specialBotId = 'bot-123_test.special@domain';
      stateController.enableBot(specialBotId);
      expect(stateController.isBotEnabled(specialBotId)).toBe(true);
    });

    it('should handle concurrent state operations', () => {
      const botId = 'bot456';
      
      // Simulate concurrent operations
      stateController.enableBot(botId);
      stateController.disableBot(botId);
      stateController.enableBot(botId);

      // Final state should be enabled
      expect(stateController.isBotEnabled(botId)).toBe(true);
    });
  });
});