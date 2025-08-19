const ConfigurationResolver = require('../../../src/core/ConfigurationResolver');
const fs = require('fs').promises;

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

describe('ConfigurationResolver', () => {
  let resolver;
  let consoleSpy;

  beforeEach(() => {
    resolver = new ConfigurationResolver();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with null config', () => {
      expect(resolver.config).toBeNull();
      expect(resolver.isLoaded()).toBe(false);
    });
  });

  describe('loadConfiguration', () => {
    const validConfig = {
      guildId: 'guild123',
      botToken: 'token123',
      runId: 'run123',
      moderatorRoleId: 'mod123',
      memberRoleId: 'member123',
      commandChannelId: 'cmd123',
      memberCommandChannelId: 'mcmd123',
      dynamodbTable: 'dynamo123',
      eventsTable: 'events123',
      reminderIntervals: {
        weekReminder: 604800000,
        dayReminder: 86400000
      },
      proposalConfig: {
        policy: { supportThreshold: 5 }
      },
      reactionRoleConfig: []
    };

    it('should load and validate configuration successfully', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(validConfig));

      const result = await resolver.loadConfiguration();

      expect(fs.readFile).toHaveBeenCalledWith('runtime.config.json', 'utf8');
      expect(result).toEqual(validConfig);
      expect(resolver.config).toEqual(validConfig);
      expect(resolver.isLoaded()).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Loading runtime configuration...');
    });

    it('should log configuration summary', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(validConfig));

      await resolver.loadConfiguration();

      expect(consoleSpy).toHaveBeenCalledWith('Guild ID: guild123');
      expect(consoleSpy).toHaveBeenCalledWith('Bot Run ID: run123');
      expect(consoleSpy).toHaveBeenCalledWith('Moderator Command Channel ID: cmd123');
      expect(consoleSpy).toHaveBeenCalledWith('Member Command Channel ID: mcmd123');
      expect(consoleSpy).toHaveBeenCalledWith('Proposal config loaded with types:', ['policy']);
      expect(consoleSpy).toHaveBeenCalledWith('Event management table: events123');
      expect(consoleSpy).toHaveBeenCalledWith('Reminder intervals: 10080min, 1440min');
    });

    it('should handle unknown run ID', async () => {
      const configWithoutRunId = { ...validConfig };
      delete configWithoutRunId.runId;
      fs.readFile.mockResolvedValue(JSON.stringify(configWithoutRunId));

      await resolver.loadConfiguration();

      expect(consoleSpy).toHaveBeenCalledWith('Bot Run ID: unknown');
    });

    it('should handle empty proposal config', async () => {
      const configWithEmptyProposal = { ...validConfig, proposalConfig: {} };
      fs.readFile.mockResolvedValue(JSON.stringify(configWithEmptyProposal));

      await resolver.loadConfiguration();

      expect(consoleSpy).toHaveBeenCalledWith('Proposal config loaded with types:', []);
    });

    it('should handle null proposal config', async () => {
      const configWithNullProposal = { ...validConfig, proposalConfig: null };
      fs.readFile.mockResolvedValue(JSON.stringify(configWithNullProposal));

      await resolver.loadConfiguration();

      expect(consoleSpy).toHaveBeenCalledWith('Proposal config loaded with types:', []);
    });

    it('should handle file read errors', async () => {
      const error = new Error('File not found');
      fs.readFile.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(resolver.loadConfiguration()).rejects.toThrow('File not found');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load runtime configuration:', error);
      expect(resolver.isLoaded()).toBe(false);
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle JSON parse errors', async () => {
      fs.readFile.mockResolvedValue('invalid json');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(resolver.loadConfiguration()).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load runtime configuration:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('validateConfiguration', () => {
    const baseConfig = {
      guildId: 'guild123',
      botToken: 'token123',
      moderatorRoleId: 'mod123',
      memberRoleId: 'member123',
      commandChannelId: 'cmd123',
      memberCommandChannelId: 'mcmd123',
      dynamodbTable: 'dynamo123',
      eventsTable: 'events123',
      reminderIntervals: {
        weekReminder: 604800000,
        dayReminder: 86400000
      }
    };

    it('should validate complete configuration successfully', async () => {
      fs.readFile.mockResolvedValue(JSON.stringify(baseConfig));

      await expect(resolver.loadConfiguration()).resolves.toEqual(baseConfig);
    });

    it('should throw error for missing required fields', async () => {
      const invalidConfig = { ...baseConfig };
      delete invalidConfig.guildId;
      delete invalidConfig.botToken;
      fs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(resolver.loadConfiguration()).rejects.toThrow(
        'Missing required configuration fields: guildId, botToken'
      );
    });

    it('should throw error for missing reminderIntervals', async () => {
      const invalidConfig = { ...baseConfig };
      delete invalidConfig.reminderIntervals;
      fs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(resolver.loadConfiguration()).rejects.toThrow(
        'Reminder intervals not configured in runtime config'
      );
    });

    it('should throw error for missing specific reminder intervals', async () => {
      const invalidConfig = {
        ...baseConfig,
        reminderIntervals: {
          weekReminder: 604800000
          // dayReminder missing
        }
      };
      fs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(resolver.loadConfiguration()).rejects.toThrow(
        'Missing reminder intervals: dayReminder'
      );
    });

    it('should throw error for multiple missing reminder intervals', async () => {
      const invalidConfig = {
        ...baseConfig,
        reminderIntervals: {}
      };
      fs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

      await expect(resolver.loadConfiguration()).rejects.toThrow(
        'Missing reminder intervals: weekReminder, dayReminder'
      );
    });

    it('should validate each required field individually', async () => {
      const requiredFields = [
        'guildId',
        'botToken', 
        'moderatorRoleId',
        'memberRoleId',
        'commandChannelId',
        'memberCommandChannelId',
        'dynamodbTable',
        'eventsTable'
      ];

      for (const field of requiredFields) {
        const invalidConfig = { ...baseConfig };
        delete invalidConfig[field];
        fs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

        await expect(resolver.loadConfiguration()).rejects.toThrow(
          `Missing required configuration fields: ${field}`
        );
      }
    });
  });

  describe('get', () => {
    it('should return specific configuration value', async () => {
      const config = { guildId: 'guild123', botToken: 'token123' };
      resolver.config = config;

      expect(resolver.get('guildId')).toBe('guild123');
      expect(resolver.get('botToken')).toBe('token123');
    });

    it('should return undefined for non-existent keys', async () => {
      resolver.config = { guildId: 'guild123' };

      expect(resolver.get('nonExistent')).toBeUndefined();
    });

    it('should throw error when configuration not loaded', () => {
      expect(() => resolver.get('guildId')).toThrow('Configuration not loaded');
    });
  });

  describe('getAll', () => {
    it('should return full configuration object', async () => {
      const config = { guildId: 'guild123', botToken: 'token123' };
      resolver.config = config;

      expect(resolver.getAll()).toEqual(config);
    });

    it('should throw error when configuration not loaded', () => {
      expect(() => resolver.getAll()).toThrow('Configuration not loaded');
    });
  });

  describe('isLoaded', () => {
    it('should return false when configuration is null', () => {
      expect(resolver.isLoaded()).toBe(false);
    });

    it('should return true when configuration is loaded', () => {
      resolver.config = { guildId: 'guild123' };
      expect(resolver.isLoaded()).toBe(true);
    });
  });
});