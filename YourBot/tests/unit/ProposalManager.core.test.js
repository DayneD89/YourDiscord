const ProposalManager = require('../../src/managers/ProposalManager');
const DynamoProposalStorage = require('../../src/storage/DynamoProposalStorage');
const ProposalParser = require('../../src/processors/ProposalParser');
const WithdrawalProcessor = require('../../src/processors/WithdrawalProcessor');

// Mock the dependencies
jest.mock('../../src/storage/DynamoProposalStorage');
jest.mock('../../src/processors/ProposalParser');
jest.mock('../../src/processors/WithdrawalProcessor');

describe('ProposalManager - Core Functionality', () => {
  let proposalManager;
  let mockBot;
  let mockGuild;
  let mockChannel;
  let mockMessage;
  let mockStorage;
  let mockParser;
  let mockWithdrawalProcessor;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Mock message
    mockMessage = {
      id: 'msg123',
      content: '**Policy**: Test proposal content',
      author: { id: 'author123' },
      channel: { id: 'proposals123' },
      guild: null, // Will be set later
      edit: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      react: jest.fn().mockResolvedValue(undefined),
      reactions: {
        cache: {
          get: jest.fn()
        }
      }
    };

    // Mock channel
    mockChannel = {
      id: 'vote123',
      send: jest.fn().mockResolvedValue(mockMessage),
      messages: {
        fetch: jest.fn().mockResolvedValue(mockMessage)
      }
    };

    // Mock guild
    mockGuild = {
      id: 'guild123',
      channels: {
        cache: {
          get: jest.fn().mockReturnValue(mockChannel)
        }
      }
    };

    mockMessage.guild = mockGuild;

    // Mock bot
    mockBot = {
      getGuildId: jest.fn().mockReturnValue('guild123'),
      client: {
        guilds: {
          cache: {
            get: jest.fn().mockReturnValue(mockGuild)
          }
        }
      }
    };

    // Mock storage
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(),
      getProposal: jest.fn(),
      saveProposal: jest.fn().mockResolvedValue(),
      getAllProposals: jest.fn().mockResolvedValue([]),
      getActiveVotes: jest.fn().mockResolvedValue([]),
      updateVoteCounts: jest.fn().mockResolvedValue(),
      markProposalComplete: jest.fn().mockResolvedValue()
    };

    // Mock parser
    mockParser = {
      parseProposal: jest.fn(),
      isValidFormat: jest.fn(),
      getProposalType: jest.fn()
    };

    // Mock withdrawal processor
    mockWithdrawalProcessor = {
      parseWithdrawalTarget: jest.fn()
    };

    DynamoProposalStorage.mockImplementation(() => mockStorage);
    ProposalParser.mockImplementation(() => mockParser);
    WithdrawalProcessor.mockImplementation(() => mockWithdrawalProcessor);

    // Create fresh instance
    proposalManager = new ProposalManager(mockBot);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with bot reference and null configs', () => {
      expect(proposalManager.bot).toBe(mockBot);
      expect(proposalManager.proposalConfig).toBeNull();
      expect(proposalManager.votingMonitorTimer).toBeNull();
    });

    it('should create storage instance', () => {
      expect(DynamoProposalStorage).toHaveBeenCalledWith();
      expect(proposalManager.storage).toBe(mockStorage);
    });
  });

  describe('initialize', () => {
    const mockConfig = {
      policy: {
        debateChannelId: 'debate123',
        voteChannelId: 'vote123',
        resolutionsChannelId: 'resolutions123',
        supportThreshold: 3,
        voteDuration: 86400000,
        formats: ['**Policy**:']
      }
    };

    it('should initialize all components correctly', async () => {
      await proposalManager.initialize('test-table', 'guild123', mockConfig);

      expect(mockStorage.initialize).toHaveBeenCalledWith('test-table', 'guild123');
      expect(proposalManager.proposalConfig).toBe(mockConfig);
    });

    it('should start voting monitor in non-test environment', async () => {
      // In Jest environment, voting monitor should not start automatically
      const originalJestWorker = process.env.JEST_WORKER_ID;
      delete process.env.JEST_WORKER_ID;
      
      const startVotingMonitorSpy = jest.spyOn(proposalManager, 'startVotingMonitor').mockImplementation();
      
      await proposalManager.initialize('test-table', 'guild123', mockConfig);

      expect(startVotingMonitorSpy).toHaveBeenCalled();
      
      startVotingMonitorSpy.mockRestore();
      process.env.JEST_WORKER_ID = originalJestWorker;
    });
  });

  describe('delegate methods', () => {
    beforeEach(() => {
      const mockConfig = {
        policy: {
          debateChannelId: 'debate123',
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123',
          supportThreshold: 3,
          voteDuration: 86400000,
          formats: ['**Policy**:']
        }
      };
      proposalManager.proposalConfig = mockConfig;
    });

    it('should delegate to storage.getAllProposals', async () => {
      const mockProposals = [{ id: 'prop1' }];
      mockStorage.getAllProposals.mockResolvedValue(mockProposals);

      const result = await proposalManager.getAllProposals();

      expect(mockStorage.getAllProposals).toHaveBeenCalled();
      expect(result).toBe(mockProposals);
    });

    it('should delegate to storage.getProposal', async () => {
      const mockProposal = { id: 'prop1' };
      mockStorage.getProposal.mockResolvedValue(mockProposal);

      const result = await proposalManager.getProposal('msg123');

      expect(mockStorage.getProposal).toHaveBeenCalledWith('msg123');
      expect(result).toBe(mockProposal);
    });

    it('should provide access to parser methods', () => {
      // ProposalManager doesn't expose parseProposal directly, 
      // it's used internally in handleSupportReaction
      expect(proposalManager.parser).toBeDefined();
    });
  });

  describe('getPendingProposals', () => {
    it('should return pending proposals only', async () => {
      // Initialize proposal config
      await proposalManager.initialize('test-table', 'guild123', {
        policy: {
          supportThreshold: 3,
          debateChannelId: 'debate123',
          voteChannelId: 'vote123'
        }
      });

      // Mock guild and channel setup
      const mockChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', {
              id: 'msg1',
              content: '**Policy**: Test proposal 1',
              author: { tag: 'User#1' },
              createdAt: new Date(),
              reactions: {
                cache: new Map([
                  ['✅', { count: 2, me: false }]
                ])
              }
            }],
            ['msg2', {
              id: 'msg2', 
              content: '**Policy**: Test proposal 2',
              author: { tag: 'User#2' },
              createdAt: new Date(),
              reactions: {
                cache: new Map([
                  ['✅', { count: 5, me: false }] // Above threshold
                ])
              }
            }]
          ]))
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockChannel);
      mockStorage.getProposal.mockResolvedValue(null); // Not tracked yet
      
      // Mock parser to return valid proposal match
      mockParser.getProposalType.mockReturnValue({
        type: 'policy',
        config: { supportThreshold: 3 },
        isWithdrawal: false
      });

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(1);
      expect(result[0].messageId).toBe('msg1');
      expect(result[0].supportCount).toBe(2);
    });

    it('should return empty array when no proposals exist', async () => {
      const mockChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map()) // Empty messages
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockChannel);

      const result = await proposalManager.getPendingProposals();

      expect(result).toEqual([]);
    });

    it('should handle storage errors gracefully', async () => {
      mockGuild.channels.cache.get.mockReturnValue(null); // Guild not found

      const result = await proposalManager.getPendingProposals();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveVotes', () => {
    it('should return active votes from storage', async () => {
      const mockVotes = [
        {
          messageId: 'vote1',
          status: 'voting',
          voteEndTime: Date.now() + 3600000
        }
      ];

      mockStorage.getActiveVotes.mockResolvedValue(mockVotes);

      const result = await proposalManager.getActiveVotes();

      expect(result).toBe(mockVotes);
    });

    it('should handle storage errors by returning empty array', async () => {
      mockStorage.getActiveVotes.mockRejectedValue(new Error('Storage error'));

      const result = await proposalManager.getActiveVotes();

      expect(result).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should cleanup voting monitor timers', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Initialize to set up timers
      proposalManager.startVotingMonitor();
      expect(proposalManager.votingMonitorTimer).toBeDefined();
      expect(proposalManager.initialVoteCheckTimer).toBeDefined();
      
      // Call cleanup
      proposalManager.cleanup();
      
      expect(proposalManager.votingMonitorTimer).toBeNull();
      expect(proposalManager.initialVoteCheckTimer).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('ProposalManager timers cleaned up');
      
      consoleSpy.mockRestore();
    });

    it('should handle cleanup when timers are not set', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Call cleanup without starting monitor
      proposalManager.cleanup();
      
      expect(consoleSpy).toHaveBeenCalledWith('ProposalManager timers cleaned up');
      
      consoleSpy.mockRestore();
    });
  });
});