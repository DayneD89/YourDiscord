// Example of how to use the new test utilities
// This demonstrates the improved patterns for writing tests

const { setupTest, teardownTest } = require('../helpers/testSetup');
const { createMockBot, createMockProposal, createMockMessage } = require('../helpers/mockFactories');
const { createProposalTestEnvironment, proposalAssertions } = require('../helpers/proposalTestHelpers');

describe('Example Test Using New Utilities', () => {
  let testSetup;
  let mockBot;

  beforeEach(() => {
    // Single line setup with all common mocks
    testSetup = setupTest({ useFakeTimers: true, mockConsole: true });
    
    // Create consistent mock bot
    mockBot = createMockBot({
      guildId: 'test-guild',
      // Override any specific properties needed
    });
  });

  afterEach(() => {
    // Single line teardown
    testSetup.restoreFunction();
  });

  describe('Old way vs New way examples', () => {
    it('OLD WAY - lots of boilerplate', () => {
      // OLD WAY (before utilities)
      /*
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      jest.clearAllMocks();
      jest.useFakeTimers();
      
      const mockBot = {
        guildId: 'guild123',
        getGuildId: jest.fn(() => 'guild123'),
        proposalManager: {
          proposalConfig: {
            policy: {
              supportThreshold: 5,
              voteDuration: 86400000,
              debateChannelId: 'debate123',
              voteChannelId: 'vote123',
              resolutionsChannelId: 'res123'
            }
          }
        }
      };
      
      // ... test logic ...
      
      consoleSpy.mockRestore();
      jest.useRealTimers();
      */
    });

    it('NEW WAY - clean and focused', () => {
      // NEW WAY (with utilities) - setup already done in beforeEach
      
      // Create test data with factories
      const proposal = createMockProposal({
        type: 'policy',
        title: 'Test Proposal'
      });
      
      // Test logic is now focused on what matters
      expect(proposal.type).toBe('policy');
      expect(testSetup.consoleSpy).toBeDefined(); // Console is already mocked
      expect(mockBot.getGuildId()).toBe('test-guild');
    });

    it('Proposal testing with environment', () => {
      const env = createProposalTestEnvironment();
      
      // Setup test data
      const proposal = env.addMockProposal({ type: 'policy' });
      env.setProposalConfig('policy', { supportThreshold: 3 });
      
      // Test logic
      expect(proposal.type).toBe('policy');
      
      // Use assertion helpers
      proposalAssertions.expectProposalCreated(env.mockStorage, { type: 'policy' });
    });
  });
});