// Mock bot instance for testing
// Provides a consistent bot mock across all tests

class MockBot {
  constructor(overrides = {}) {
    this.guildId = overrides.guildId || '123456789012345678';
    this.moderatorRoleId = overrides.moderatorRoleId || '123456789012345679';
    this.memberRoleId = overrides.memberRoleId || '123456789012345680';
    this.commandChannelId = overrides.commandChannelId || '123456789012345681';
    this.memberCommandChannelId = overrides.memberCommandChannelId || '123456789012345682';
    
    this.configManager = overrides.configManager || {
      getConfig: jest.fn(() => []),
      findConfig: jest.fn(() => null),
      addConfig: jest.fn(),
      removeConfig: jest.fn(),
      saveConfig: jest.fn(),
    };
    
    this.userValidator = overrides.userValidator || {
      isBot: jest.fn(() => false),
      canAct: jest.fn(() => ({ canAct: true })),
      canUseModerator: jest.fn(() => true),
      hasRole: jest.fn(() => true),
    };
    
    this.proposalManager = overrides.proposalManager || {
      proposalConfig: {
        policy: {
          debateChannelId: '123456789012345683',
          voteChannelId: '123456789012345684',
          resolutionsChannelId: '123456789012345685',
          supportThreshold: 3,
          voteDuration: 86400000,
          formats: ['Policy']
        }
      },
      handleSupportReaction: jest.fn(),
      handleVoteReaction: jest.fn(),
      getProposal: jest.fn(() => null),
      getAllProposals: jest.fn(() => []),
      getActiveVotes: jest.fn(() => []),
    };
    
    this.commandHandler = overrides.commandHandler || {
      handleCommand: jest.fn(),
    };
  }
  
  getGuildId() { return this.guildId; }
  getModeratorRoleId() { return this.moderatorRoleId; }
  getMemberRoleId() { return this.memberRoleId; }
  getCommandChannelId() { return this.commandChannelId; }
  getMemberCommandChannelId() { return this.memberCommandChannelId; }
  getConfigManager() { return this.configManager; }
  getUserValidator() { return this.userValidator; }
  getProposalManager() { return this.proposalManager; }
  getReminderIntervals() { 
    return {
      weekReminder: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
      dayReminder: 24 * 60 * 60 * 1000 // 24 hours in ms
    };
  }
  getEventsTable() { return 'discord-events-test'; }
  
  // Bot state management methods
  isThisBotEnabled() { return true; }
  isBotEnabled(botId) { return true; }
  enableBot(botId) { }
  disableBot(botId) { }
  getBotId() { return 'test-bot-123'; }
}

module.exports = MockBot;