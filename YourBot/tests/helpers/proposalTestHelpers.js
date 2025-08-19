// Proposal-specific test utilities and helpers
// Reduces duplication in proposal manager and handler tests

const { createMockProposal, createMockVote, createMockBot, createProposalConfig } = require('./mockFactories');

/**
 * Create a complete proposal test environment
 */
function createProposalTestEnvironment(options = {}) {
  const mockBot = createMockBot(options.botOverrides);
  
  // Setup proposal manager mocks
  const mockStorage = {
    createProposal: jest.fn().mockResolvedValue('prop123'),
    getProposal: jest.fn().mockResolvedValue(null),
    updateProposal: jest.fn().mockResolvedValue(),
    deleteProposal: jest.fn().mockResolvedValue(),
    getAllProposals: jest.fn().mockResolvedValue([]),
    createVote: jest.fn().mockResolvedValue('vote123'),
    getVote: jest.fn().mockResolvedValue(null),
    updateVote: jest.fn().mockResolvedValue(),
    getActiveVotes: jest.fn().mockResolvedValue([])
  };

  const mockParser = {
    parseProposal: jest.fn().mockReturnValue({
      type: 'policy',
      title: 'Test Proposal',
      description: 'Test description'
    }),
    validateProposalFormat: jest.fn().mockReturnValue(true),
    extractProposalType: jest.fn().mockReturnValue('policy')
  };

  const mockWithdrawalProcessor = {
    processWithdrawal: jest.fn().mockResolvedValue(true),
    canWithdraw: jest.fn().mockReturnValue(true)
  };

  return {
    mockBot,
    mockStorage,
    mockParser,
    mockWithdrawalProcessor,
    
    // Helper methods
    setProposalConfig: (type, config) => {
      if (!mockBot.proposalManager.proposalConfig) {
        mockBot.proposalManager.proposalConfig = {};
      }
      mockBot.proposalManager.proposalConfig[type] = createProposalConfig(type, config);
    },
    
    addMockProposal: (proposal) => {
      const mockProposal = createMockProposal(proposal);
      mockStorage.getProposal.mockResolvedValue(mockProposal);
      return mockProposal;
    },
    
    addMockVote: (vote) => {
      const mockVote = createMockVote(vote);
      mockStorage.getVote.mockResolvedValue(mockVote);
      return mockVote;
    }
  };
}

/**
 * Simulate proposal support reactions
 */
function simulateProposalSupport(proposalId, supportCount = 5) {
  const reactions = [];
  for (let i = 0; i < supportCount; i++) {
    reactions.push({
      userId: `supporter${i}`,
      emoji: '👍',
      timestamp: new Date().toISOString()
    });
  }
  return reactions;
}

/**
 * Simulate vote reactions (yes, no, abstain)
 */
function simulateVoteReactions(options = {}) {
  const { yesVotes = 5, noVotes = 2, abstainVotes = 1 } = options;
  const reactions = {
    '✅': [], // Yes votes
    '❌': [], // No votes
    '🤷': []  // Abstain votes
  };

  // Add yes votes
  for (let i = 0; i < yesVotes; i++) {
    reactions['✅'].push({
      userId: `yes_voter${i}`,
      timestamp: new Date().toISOString()
    });
  }

  // Add no votes
  for (let i = 0; i < noVotes; i++) {
    reactions['❌'].push({
      userId: `no_voter${i}`,
      timestamp: new Date().toISOString()
    });
  }

  // Add abstain votes
  for (let i = 0; i < abstainVotes; i++) {
    reactions['🤷'].push({
      userId: `abstain_voter${i}`,
      timestamp: new Date().toISOString()
    });
  }

  return reactions;
}

/**
 * Create mock proposal timeline for lifecycle testing
 */
function createProposalTimeline(proposalId = 'prop123') {
  const now = new Date();
  const timeline = {
    created: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    debateStarted: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    supportThresholdMet: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    voteStarted: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    voteEnded: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    resolved: new Date(now.getTime() - 12 * 60 * 60 * 1000) // 12 hours ago
  };

  return {
    proposalId,
    timeline,
    
    // Helper to get proposal at specific stage
    getProposalAt: (stage) => {
      const stages = {
        created: { status: 'created', createdAt: timeline.created.toISOString() },
        debate: { status: 'debate', createdAt: timeline.created.toISOString() },
        voting: { 
          status: 'voting', 
          createdAt: timeline.created.toISOString(),
          voteStartedAt: timeline.voteStarted.toISOString() 
        },
        completed: { 
          status: 'completed', 
          createdAt: timeline.created.toISOString(),
          voteStartedAt: timeline.voteStarted.toISOString(),
          voteEndedAt: timeline.voteEnded.toISOString() 
        }
      };
      
      return createMockProposal({ proposalId, ...stages[stage] });
    }
  };
}

/**
 * Mock AWS DynamoDB operations for proposal storage
 */
function mockDynamoDBOperations() {
  const operations = {
    putItem: jest.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } }),
    getItem: jest.fn().mockResolvedValue({ Item: null }),
    updateItem: jest.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } }),
    deleteItem: jest.fn().mockResolvedValue({ $metadata: { httpStatusCode: 200 } }),
    query: jest.fn().mockResolvedValue({ Items: [] }),
    scan: jest.fn().mockResolvedValue({ Items: [] })
  };

  // Helper to setup specific responses
  const setupResponse = {
    getProposal: (proposal) => {
      operations.getItem.mockResolvedValueOnce({ 
        Item: { 
          ...proposal, 
          proposalData: { S: JSON.stringify(proposal) } 
        } 
      });
    },
    
    listProposals: (proposals) => {
      operations.query.mockResolvedValueOnce({
        Items: proposals.map(p => ({
          ...p,
          proposalData: { S: JSON.stringify(p) }
        }))
      });
    }
  };

  return { operations, setupResponse };
}

/**
 * Assertion helpers for proposal testing
 */
const proposalAssertions = {
  /**
   * Assert that a proposal was created with expected properties
   */
  expectProposalCreated: (mockStorage, expectedProposal) => {
    expect(mockStorage.createProposal).toHaveBeenCalledWith(
      expect.objectContaining(expectedProposal)
    );
  },

  /**
   * Assert that a vote was created with expected properties
   */
  expectVoteCreated: (mockStorage, expectedVote) => {
    expect(mockStorage.createVote).toHaveBeenCalledWith(
      expect.objectContaining(expectedVote)
    );
  },

  /**
   * Assert that proposal status was updated
   */
  expectProposalStatusUpdated: (mockStorage, proposalId, status) => {
    expect(mockStorage.updateProposal).toHaveBeenCalledWith(
      proposalId,
      expect.objectContaining({ status })
    );
  },

  /**
   * Assert that vote was recorded correctly
   */
  expectVoteRecorded: (mockStorage, voteId, voteData) => {
    expect(mockStorage.updateVote).toHaveBeenCalledWith(
      voteId,
      expect.objectContaining(voteData)
    );
  }
};

module.exports = {
  createProposalTestEnvironment,
  simulateProposalSupport,
  simulateVoteReactions,
  createProposalTimeline,
  mockDynamoDBOperations,
  proposalAssertions
};