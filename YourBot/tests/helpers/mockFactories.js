// Factory functions for creating consistent mock objects
// Reduces duplication and provides configurable defaults

const { MockUser, MockMember, MockGuild, MockChannel, MockMessage, MockReaction } = require('./mockDiscord');

/**
 * Create a mock runtime configuration
 */
function createMockRuntimeConfig(overrides = {}) {
  return {
    guildId: 'guild123',
    botToken: 'token123',
    runId: 'run123',
    moderatorRoleId: 'mod123',
    memberRoleId: 'member123',
    commandChannelId: 'cmd123',
    memberCommandChannelId: 'mcmd123',
    eventsTable: 'events-table',
    reminderIntervals: { 
      weekReminder: 604800000, 
      dayReminder: 86400000 
    },
    dynamodbTable: 'dynamo123',
    proposalConfig: {
      policy: {
        supportThreshold: 5,
        voteDuration: 86400000,
        debateChannelId: 'debate123',
        voteChannelId: 'vote123',
        resolutionsChannelId: 'res123'
      }
    },
    reactionRoleConfig: [],
    ...overrides
  };
}

/**
 * Create a mock proposal object
 */
function createMockProposal(overrides = {}) {
  return {
    proposalId: 'prop123',
    type: 'policy',
    title: 'Test Proposal',
    description: 'Test proposal description',
    authorId: 'author123',
    channelId: 'proposals123',
    messageId: 'msg123',
    status: 'debate',
    supportCount: 3,
    supportThreshold: 5,
    createdAt: new Date().toISOString(),
    debateEndsAt: new Date(Date.now() + 86400000).toISOString(),
    ...overrides
  };
}

/**
 * Create a mock vote object
 */
function createMockVote(overrides = {}) {
  return {
    voteId: 'vote123',
    proposalId: 'prop123',
    voteChannelId: 'vote123',
    voteMessageId: 'vmsg123',
    status: 'active',
    yesVotes: 5,
    noVotes: 2,
    abstainVotes: 1,
    votersWhoVoted: ['voter1', 'voter2', 'voter3'],
    voteEndsAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create a mock Discord reaction
 */
function createMockReaction(overrides = {}) {
  const defaults = {
    emoji: '✅',
    count: 1,
    me: false,
    message: createMockMessage()
  };
  
  return new MockReaction({ ...defaults, ...overrides });
}

/**
 * Create a mock Discord message
 */
function createMockMessage(overrides = {}) {
  const defaults = {
    id: 'msg123',
    content: 'Test message',
    author: createMockUser(),
    guild: createMockGuild(),
    channel: createMockChannel()
  };
  
  return new MockMessage({ ...defaults, ...overrides });
}

/**
 * Create a mock Discord user
 */
function createMockUser(overrides = {}) {
  const defaults = {
    id: 'user123',
    tag: 'TestUser#1234',
    bot: false
  };
  
  return new MockUser({ ...defaults, ...overrides });
}

/**
 * Create a mock Discord guild member
 */
function createMockMember(overrides = {}) {
  const defaults = {
    user: createMockUser(),
    roles: [],
    hasPermissions: true
  };
  
  return new MockMember({ ...defaults, ...overrides });
}

/**
 * Create a mock Discord guild
 */
function createMockGuild(overrides = {}) {
  const defaults = {
    id: 'guild123',
    channels: [],
    roles: []
  };
  
  return new MockGuild({ ...defaults, ...overrides });
}

/**
 * Create a mock Discord channel
 */
function createMockChannel(overrides = {}) {
  const defaults = {
    id: 'channel123',
    name: 'test-channel',
    type: 0
  };
  
  return new MockChannel({ ...defaults, ...overrides });
}

/**
 * Create a mock event object
 */
function createMockEvent(overrides = {}) {
  return {
    eventId: 'event123',
    title: 'Test Event',
    description: 'Test event description',
    organizerId: 'organizer123',
    channelId: 'events123',
    startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    endTime: new Date(Date.now() + 90000000).toISOString(),   // Day after tomorrow
    status: 'scheduled',
    attendees: [],
    maxAttendees: 10,
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create a mock config entry for reaction roles
 */
function createMockReactionConfig(overrides = {}) {
  return {
    from: 'msg123',
    action: 'role:member',
    emoji: '✅',
    roleId: 'role123',
    description: 'Test reaction role',
    ...overrides
  };
}

/**
 * Create a mock bot instance with all required methods
 */
function createMockBot(overrides = {}) {
  const defaults = {
    guildId: 'guild123',
    moderatorRoleId: 'mod123',
    memberRoleId: 'member123',
    commandChannelId: 'cmd123',
    memberCommandChannelId: 'mcmd123',
    runId: 'run123',
    eventsTable: 'events123',
    reminderIntervals: { weekReminder: 604800000, dayReminder: 86400000 },
    
    // Mock methods
    getGuildId: jest.fn(() => 'guild123'),
    getModeratorRoleId: jest.fn(() => 'mod123'),
    getMemberRoleId: jest.fn(() => 'member123'),
    getCommandChannelId: jest.fn(() => 'cmd123'),
    getMemberCommandChannelId: jest.fn(() => 'mcmd123'),
    getRunId: jest.fn(() => 'run123'),
    getEventsTable: jest.fn(() => 'events123'),
    getReminderIntervals: jest.fn(() => ({ weekReminder: 604800000, dayReminder: 86400000 })),
    
    // State management
    enableBot: jest.fn(),
    disableBot: jest.fn(),
    isBotEnabled: jest.fn(() => true),
    isThisBotEnabled: jest.fn(() => true),
    getBotId: jest.fn(() => 'bot123'),
    
    // Component mocks
    configManager: {
      getConfig: jest.fn(() => []),
      initialize: jest.fn().mockResolvedValue()
    },
    proposalManager: {
      proposalConfig: {
        policy: {
          debateChannelId: 'debate123',
          voteChannelId: 'vote123',
          resolutionsChannelId: 'res123',
          supportThreshold: 5,
          voteDuration: 86400000
        }
      },
      initialize: jest.fn().mockResolvedValue(),
      getActiveVotes: jest.fn(() => [])
    },
    userValidator: {
      isBot: jest.fn(() => false),
      canAct: jest.fn(() => ({ canAct: true })),
      canUseModerator: jest.fn(() => true)
    },
    eventHandlers: {
      handleReactionAdd: jest.fn(),
      handleReactionRemove: jest.fn(),
      handleMessage: jest.fn()
    },
    commandRouter: {
      handleCommand: jest.fn()
    },
    client: {
      user: { id: 'bot123', tag: 'TestBot#1234' },
      guilds: { cache: { get: jest.fn() } },
      login: jest.fn().mockResolvedValue(),
      destroy: jest.fn(),
      once: jest.fn(),
      on: jest.fn()
    }
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Create proposal configuration for different types
 */
function createProposalConfig(type = 'policy', overrides = {}) {
  const configs = {
    policy: {
      supportThreshold: 5,
      voteDuration: 86400000,
      debateChannelId: 'debate123',
      voteChannelId: 'vote123',
      resolutionsChannelId: 'res123',
      formats: ['Policy']
    },
    moderator: {
      supportThreshold: 3,
      voteDuration: 604800000,
      debateChannelId: 'mod-debate123',
      voteChannelId: 'mod-vote123',
      resolutionsChannelId: 'mod-res123',
      formats: ['Moderator']
    },
    governance: {
      supportThreshold: 10,
      voteDuration: 1209600000,
      debateChannelId: 'gov-debate123',
      voteChannelId: 'gov-vote123',
      resolutionsChannelId: 'gov-res123',
      formats: ['Governance']
    }
  };
  
  return { ...configs[type], ...overrides };
}

module.exports = {
  createMockRuntimeConfig,
  createMockProposal,
  createMockVote,
  createMockReaction,
  createMockMessage,
  createMockUser,
  createMockMember,
  createMockGuild,
  createMockChannel,
  createMockEvent,
  createMockReactionConfig,
  createMockBot,
  createProposalConfig
};