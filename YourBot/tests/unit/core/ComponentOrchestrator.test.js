const ComponentOrchestrator = require('../../../src/core/ComponentOrchestrator');

// Mock all the component dependencies
jest.mock('../../../src/managers/ConfigManager');
jest.mock('../../../src/handlers/EventHandlers');
jest.mock('../../../src/handlers/CommandRouter');
jest.mock('../../../src/validators/UserValidator');
jest.mock('../../../src/managers/ProposalManager');
jest.mock('../../../src/managers/EventManager');

const ConfigManager = require('../../../src/managers/ConfigManager');
const EventHandlers = require('../../../src/handlers/EventHandlers');
const CommandRouter = require('../../../src/handlers/CommandRouter');
const UserValidator = require('../../../src/validators/UserValidator');
const ProposalManager = require('../../../src/managers/ProposalManager');
const EventManager = require('../../../src/managers/EventManager');

describe('ComponentOrchestrator', () => {
  let orchestrator;
  let mockBot;
  let consoleSpy;

  beforeEach(() => {
    // Mock bot
    mockBot = {
      client: { user: { id: 'bot123' } }
    };

    // Mock component instances
    const mockConfigManager = {
      initialize: jest.fn().mockResolvedValue()
    };
    const mockEventHandlers = {};
    const mockCommandRouter = {};
    const mockUserValidator = {};
    const mockProposalManager = {
      initialize: jest.fn().mockResolvedValue()
    };
    const mockEventManager = {
      cleanup: jest.fn()
    };

    // Setup mock implementations
    ConfigManager.mockImplementation(() => mockConfigManager);
    EventHandlers.mockImplementation(() => mockEventHandlers);
    CommandRouter.mockImplementation(() => mockCommandRouter);
    UserValidator.mockImplementation(() => mockUserValidator);
    ProposalManager.mockImplementation(() => mockProposalManager);
    EventManager.mockImplementation(() => mockEventManager);

    orchestrator = new ComponentOrchestrator(mockBot);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize with bot reference and empty components', () => {
      expect(orchestrator.bot).toBe(mockBot);
      expect(orchestrator.components).toEqual({});
    });
  });

  describe('initializeComponents', () => {
    beforeEach(() => {
      jest.spyOn(orchestrator, 'attachComponentsToBot').mockImplementation();
    });

    it('should initialize all components in correct order', () => {
      orchestrator.initializeComponents();

      expect(ConfigManager).toHaveBeenCalledTimes(1);
      expect(UserValidator).toHaveBeenCalledTimes(1);
      expect(ProposalManager).toHaveBeenCalledWith(mockBot);
      expect(EventHandlers).toHaveBeenCalledWith(mockBot);
      expect(CommandRouter).toHaveBeenCalledWith(mockBot);
    });

    it('should store all components', () => {
      orchestrator.initializeComponents();

      expect(orchestrator.components.configManager).toBeDefined();
      expect(orchestrator.components.userValidator).toBeDefined();
      expect(orchestrator.components.proposalManager).toBeDefined();
      expect(orchestrator.components.eventHandlers).toBeDefined();
      expect(orchestrator.components.commandRouter).toBeDefined();
      expect(orchestrator.components.eventManager).toBeNull();
    });

    it('should attach components to bot', () => {
      orchestrator.initializeComponents();

      expect(orchestrator.attachComponentsToBot).toHaveBeenCalled();
    });

    it('should log success message', () => {
      orchestrator.initializeComponents();

      expect(consoleSpy).toHaveBeenCalledWith('✅ All components initialized successfully');
    });
  });

  describe('initializeConfigurableComponents', () => {
    const mockRuntimeConfig = {
      reactionRoleConfig: [{ from: 'msg123', action: 'role:member' }],
      dynamodbTable: 'dynamo123',
      guildId: 'guild123',
      proposalConfig: { policy: { supportThreshold: 5 } },
      eventsTable: 'events123'
    };

    beforeEach(() => {
      // Initialize components first
      orchestrator.initializeComponents();
    });

    it('should initialize configurable components successfully', async () => {
      await orchestrator.initializeConfigurableComponents(mockRuntimeConfig);

      expect(orchestrator.components.configManager.initialize).toHaveBeenCalledWith(
        mockRuntimeConfig.reactionRoleConfig
      );
      expect(orchestrator.components.proposalManager.initialize).toHaveBeenCalledWith(
        mockRuntimeConfig.dynamodbTable,
        mockRuntimeConfig.guildId,
        mockRuntimeConfig.proposalConfig
      );
      expect(EventManager).toHaveBeenCalledWith(mockBot);
    });

    it('should handle missing reactionRoleConfig', async () => {
      const configWithoutReactionRoles = { ...mockRuntimeConfig };
      delete configWithoutReactionRoles.reactionRoleConfig;

      await orchestrator.initializeConfigurableComponents(configWithoutReactionRoles);

      expect(orchestrator.components.configManager.initialize).toHaveBeenCalledWith([]);
    });

    it('should attach event manager to bot', async () => {
      await orchestrator.initializeConfigurableComponents(mockRuntimeConfig);

      expect(mockBot.eventManager).toBeDefined();
      expect(orchestrator.components.eventManager).toBeDefined();
    });

    it('should log success messages', async () => {
      await orchestrator.initializeConfigurableComponents(mockRuntimeConfig);

      expect(consoleSpy).toHaveBeenCalledWith('✅ Config manager initialized');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Proposal manager initialized');
      expect(consoleSpy).toHaveBeenCalledWith('✅ Event management system initialized with table: events123');
    });

    it('should handle config manager initialization errors', async () => {
      const error = new Error('Config init failed');
      orchestrator.components.configManager.initialize.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(orchestrator.initializeConfigurableComponents(mockRuntimeConfig))
        .rejects.toThrow('Config init failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to initialize configurable components:', error);
      consoleErrorSpy.mockRestore();
    });

    it('should handle proposal manager initialization errors', async () => {
      const error = new Error('Proposal init failed');
      orchestrator.components.proposalManager.initialize.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(orchestrator.initializeConfigurableComponents(mockRuntimeConfig))
        .rejects.toThrow('Proposal init failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to initialize configurable components:', error);
      consoleErrorSpy.mockRestore();
    });

    it('should handle event manager creation errors', async () => {
      const error = new Error('EventManager construction failed');
      EventManager.mockImplementation(() => { throw error; });
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(orchestrator.initializeConfigurableComponents(mockRuntimeConfig))
        .rejects.toThrow('EventManager construction failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to initialize configurable components:', error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('attachComponentsToBot', () => {
    beforeEach(() => {
      orchestrator.initializeComponents();
    });

    it('should attach all components to bot', () => {
      orchestrator.attachComponentsToBot();

      expect(mockBot.configManager).toBe(orchestrator.components.configManager);
      expect(mockBot.userValidator).toBe(orchestrator.components.userValidator);
      expect(mockBot.proposalManager).toBe(orchestrator.components.proposalManager);
      expect(mockBot.eventHandlers).toBe(orchestrator.components.eventHandlers);
      expect(mockBot.commandRouter).toBe(orchestrator.components.commandRouter);
      expect(mockBot.eventManager).toBe(orchestrator.components.eventManager);
    });

    it('should handle null eventManager', () => {
      orchestrator.components.eventManager = null;
      
      orchestrator.attachComponentsToBot();

      expect(mockBot.eventManager).toBeNull();
    });
  });

  describe('getComponent', () => {
    beforeEach(() => {
      orchestrator.initializeComponents();
    });

    it('should return specific component', () => {
      const configManager = orchestrator.getComponent('configManager');
      expect(configManager).toBe(orchestrator.components.configManager);
    });

    it('should return undefined for non-existent component', () => {
      const nonExistent = orchestrator.getComponent('nonExistent');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('getAllComponents', () => {
    beforeEach(() => {
      orchestrator.initializeComponents();
    });

    it('should return all components', () => {
      const allComponents = orchestrator.getAllComponents();
      expect(allComponents).toBe(orchestrator.components);
      expect(allComponents).toHaveProperty('configManager');
      expect(allComponents).toHaveProperty('userValidator');
      expect(allComponents).toHaveProperty('proposalManager');
      expect(allComponents).toHaveProperty('eventHandlers');
      expect(allComponents).toHaveProperty('commandRouter');
      expect(allComponents).toHaveProperty('eventManager');
    });
  });

  describe('isComponentInitialized', () => {
    beforeEach(() => {
      orchestrator.initializeComponents();
    });

    it('should return true for initialized components', () => {
      expect(orchestrator.isComponentInitialized('configManager')).toBe(true);
      expect(orchestrator.isComponentInitialized('userValidator')).toBe(true);
    });

    it('should return false for null components', () => {
      expect(orchestrator.isComponentInitialized('eventManager')).toBe(false);
    });

    it('should return false for non-existent components', () => {
      expect(orchestrator.isComponentInitialized('nonExistent')).toBe(false);
    });

    it('should return false for undefined components', () => {
      orchestrator.components.testComponent = undefined;
      expect(orchestrator.isComponentInitialized('testComponent')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup event manager if it exists and has cleanup method', async () => {
      const mockEventManager = { cleanup: jest.fn() };
      orchestrator.components.eventManager = mockEventManager;

      await orchestrator.cleanup();

      expect(mockEventManager.cleanup).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ Components cleaned up');
    });

    it('should handle null event manager', async () => {
      orchestrator.components.eventManager = null;

      await orchestrator.cleanup();

      expect(consoleSpy).toHaveBeenCalledWith('✅ Components cleaned up');
    });

    it('should handle event manager without cleanup method', async () => {
      orchestrator.components.eventManager = { someOtherMethod: jest.fn() };

      await orchestrator.cleanup();

      expect(consoleSpy).toHaveBeenCalledWith('✅ Components cleaned up');
    });

    it('should handle undefined event manager', async () => {
      orchestrator.components.eventManager = undefined;

      await orchestrator.cleanup();

      expect(consoleSpy).toHaveBeenCalledWith('✅ Components cleaned up');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete initialization workflow', async () => {
      const runtimeConfig = {
        reactionRoleConfig: [],
        dynamodbTable: 'dynamo123',
        guildId: 'guild123',
        proposalConfig: {},
        eventsTable: 'events123'
      };

      // Initialize components
      orchestrator.initializeComponents();
      
      // Verify components are attached
      expect(mockBot.configManager).toBeDefined();
      expect(mockBot.proposalManager).toBeDefined();
      
      // Initialize configurable components
      await orchestrator.initializeConfigurableComponents(runtimeConfig);
      
      // Verify event manager is attached
      expect(mockBot.eventManager).toBeDefined();
      
      // Verify components are initialized
      expect(orchestrator.isComponentInitialized('configManager')).toBe(true);
      expect(orchestrator.isComponentInitialized('eventManager')).toBe(true);
      
      // Cleanup
      await orchestrator.cleanup();
    });

    it('should handle partial initialization failure gracefully', async () => {
      orchestrator.initializeComponents();
      
      const runtimeConfig = {
        reactionRoleConfig: [],
        dynamodbTable: 'dynamo123',
        guildId: 'guild123',
        proposalConfig: {},
        eventsTable: 'events123'
      };

      // Make proposal manager fail
      orchestrator.components.proposalManager.initialize.mockRejectedValue(new Error('DB connection failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(orchestrator.initializeConfigurableComponents(runtimeConfig))
        .rejects.toThrow('DB connection failed');

      // Verify error was logged and propagated
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Failed to initialize configurable components:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});