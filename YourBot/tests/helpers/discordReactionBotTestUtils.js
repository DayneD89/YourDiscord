// Shared test utilities for DiscordReactionBot tests

// Mock Discord.js components
const mockClient = {
  once: jest.fn(),
  on: jest.fn(),
  login: jest.fn().mockResolvedValue(),
  destroy: jest.fn(),
  user: { tag: 'TestBot#1234', id: 'bot123' },
  guilds: {
    cache: {
      get: jest.fn()
    }
  }
};

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

// Mock Discord.js
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

// Mock the module dependencies
jest.mock('../../src/managers/ConfigManager');
jest.mock('../../src/handlers/EventHandlers');
jest.mock('../../src/handlers/CommandRouter');
jest.mock('../../src/validators/UserValidator');
jest.mock('../../src/managers/ProposalManager');

// Mock the new refactored components
jest.mock('../../src/core/ConfigurationResolver');
jest.mock('../../src/core/ComponentOrchestrator');
jest.mock('../../src/core/BotLifecycleManager');
jest.mock('../../src/core/BotStateController');

const ConfigManager = require('../../src/managers/ConfigManager');
const EventHandlers = require('../../src/handlers/EventHandlers');
const CommandRouter = require('../../src/handlers/CommandRouter');
const UserValidator = require('../../src/validators/UserValidator');
const ProposalManager = require('../../src/managers/ProposalManager');

// Import the new refactored components
const ConfigurationResolver = require('../../src/core/ConfigurationResolver');
const ComponentOrchestrator = require('../../src/core/ComponentOrchestrator');
const BotLifecycleManager = require('../../src/core/BotLifecycleManager');
const BotStateController = require('../../src/core/BotStateController');

/**
 * Create default runtime config for tests
 */
function createMockRuntimeConfig() {
  return {
    guildId: 'guild123',
    botToken: 'token123',
    runId: 'run123',
    moderatorRoleId: 'mod123',
    memberRoleId: 'member123',
    commandChannelId: 'cmd123',
    memberCommandChannelId: 'mcmd123',
    eventsTable: 'events-table',
    reminderIntervals: { weekReminder: 604800000, dayReminder: 86400000 },
    dynamodbTable: 'dynamo123',
    proposalConfig: {},
    reactionRoleConfig: []
  };
}

/**
 * Create mock guild and channel for tests
 */
function createMockGuildAndChannel() {
  const mockChannel = {
    isTextBased: () => true,
    messages: {
      fetch: jest.fn().mockResolvedValue({ id: 'msg123' })
    },
    name: 'test-channel',
    send: jest.fn().mockResolvedValue(),
    permissionsFor: jest.fn().mockReturnValue({
      has: jest.fn().mockReturnValue(true),
      toArray: jest.fn().mockReturnValue(['SendMessages'])
    })
  };
  
  const mockGuild = {
    id: 'guild123',
    name: 'Test Guild',
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
  
  return { mockGuild, mockChannel };
}

// Create mock instances that will be reused
const mockConfigResolver = {
  loadConfiguration: jest.fn().mockResolvedValue(createMockRuntimeConfig()),
  get: jest.fn(),
  getAll: jest.fn(),
  isLoaded: jest.fn().mockReturnValue(true)
};

const mockComponentOrchestrator = {
  initializeComponents: jest.fn(),
  initializeConfigurableComponents: jest.fn().mockResolvedValue(),
  attachComponentsToBot: jest.fn(),
  getComponent: jest.fn(),
  getAllComponents: jest.fn(),
  isComponentInitialized: jest.fn(),
  cleanup: jest.fn().mockResolvedValue()
};

const mockLifecycleManager = {
  setupEventHandlers: jest.fn(),
  handleReady: jest.fn(),
  setupGracefulShutdown: jest.fn(),
  preCacheMessages: jest.fn().mockResolvedValue(),
  preCacheVoteMessages: jest.fn().mockResolvedValue(),
  postDeploymentConfirmation: jest.fn().mockResolvedValue(),
  postShutdownMessage: jest.fn().mockResolvedValue(),
  sendShutdownMessage: jest.fn().mockResolvedValue()
};

const mockStateController = {
  enableBot: jest.fn(),
  disableBot: jest.fn(),
  isBotEnabled: jest.fn().mockReturnValue(true),
  isThisBotEnabled: jest.fn().mockReturnValue(true),
  getBotId: jest.fn().mockReturnValue('bot123'),
  getAllBotStates: jest.fn().mockReturnValue(new Map()),
  clearAllStates: jest.fn(),
  getStateStats: jest.fn().mockReturnValue({ total: 0, enabled: 0, disabled: 0 })
};

// Set up mocks immediately when module is loaded
ConfigManager.mockImplementation(() => ({
  initialize: jest.fn().mockResolvedValue(),
  getConfig: jest.fn().mockReturnValue([])
}));

EventHandlers.mockImplementation(() => ({
  handleReactionAdd: jest.fn(),
  handleReactionRemove: jest.fn(),
  handleMessage: jest.fn()
}));

CommandRouter.mockImplementation(() => ({}));
UserValidator.mockImplementation(() => ({}));

ProposalManager.mockImplementation(() => ({
  initialize: jest.fn().mockResolvedValue(),
  getActiveVotes: jest.fn().mockReturnValue([]),
  proposalConfig: null
}));

// Set up new component mocks immediately
ConfigurationResolver.mockImplementation(() => mockConfigResolver);
ComponentOrchestrator.mockImplementation(() => mockComponentOrchestrator);
BotLifecycleManager.mockImplementation(() => mockLifecycleManager);
BotStateController.mockImplementation(() => mockStateController);

/**
 * Setup component mocks with default implementations
 */
function setupComponentMocks() {
  // Reset all mocks but keep the implementations
  jest.clearAllMocks();
  
  // Store references for direct access
  global.mockConfigResolver = mockConfigResolver;
  global.mockComponentOrchestrator = mockComponentOrchestrator;
  global.mockLifecycleManager = mockLifecycleManager;
  global.mockStateController = mockStateController;
}

/**
 * Reset all mocks
 */
function resetAllMocks() {
  jest.clearAllMocks();
  mockClient.guilds.cache.get.mockReturnValue(null);
  
  // Mock process.exit to prevent tests from actually exiting
  // Always reset the spy to ensure clean state
  if (process.exit.mockRestore) {
    process.exit.mockRestore();
  }
  jest.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code}) called`);
  });
}

module.exports = {
  mockClient,
  createMockRuntimeConfig,
  createMockGuildAndChannel,
  setupComponentMocks,
  resetAllMocks,
  // Export the component mocks for individual test access
  ConfigManager,
  EventHandlers,
  CommandRouter,
  UserValidator,
  ProposalManager,
  ConfigurationResolver,
  ComponentOrchestrator,
  BotLifecycleManager,
  BotStateController
};