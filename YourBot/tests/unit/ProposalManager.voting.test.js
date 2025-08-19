const ProposalManager = require('../../src/managers/ProposalManager');
const DynamoProposalStorage = require('../../src/storage/DynamoProposalStorage');
const ProposalParser = require('../../src/processors/ProposalParser');
const WithdrawalProcessor = require('../../src/processors/WithdrawalProcessor');

// Mock the dependencies
jest.mock('../../src/storage/DynamoProposalStorage');
jest.mock('../../src/processors/ProposalParser');
jest.mock('../../src/processors/WithdrawalProcessor');

describe('ProposalManager - Voting System', () => {
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
      addProposal: jest.fn().mockResolvedValue(),
      getAllProposals: jest.fn().mockResolvedValue([]),
      updateProposal: jest.fn().mockResolvedValue(),
      getActiveVotes: jest.fn().mockReturnValue([]),
      markProposalComplete: jest.fn().mockResolvedValue()
    };

    // Mock parser
    mockParser = {
      parseProposal: jest.fn(),
      isValidFormat: jest.fn(),
      getProposalType: jest.fn(),
      initialize: jest.fn()
    };

    // Mock withdrawal processor
    mockWithdrawalProcessor = {
      parseWithdrawalTarget: jest.fn(),
      initialize: jest.fn()
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

  describe('handleVoteReaction', () => {
    it('should ignore non-voting proposals', async () => {
      mockStorage.getProposal.mockReturnValue(null);

      await proposalManager.handleVoteReaction(mockMessage, '✅', true);

      // No errors should occur, method should return early
      expect(mockStorage.updateProposal).not.toHaveBeenCalled();
    });

    it('should ignore proposals not in voting status', async () => {
      mockStorage.getProposal.mockReturnValue({ status: 'completed' });

      await proposalManager.handleVoteReaction(mockMessage, '✅', true);

      expect(mockStorage.updateProposal).not.toHaveBeenCalled();
    });

    it('should ignore reactions after voting ended', async () => {
      const pastDate = new Date(Date.now() - 10000).toISOString();
      mockStorage.getProposal.mockReturnValue({
        status: 'voting',
        end_time: pastDate
      });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.handleVoteReaction(mockMessage, '✅', true);

      expect(consoleSpy).toHaveBeenCalledWith('Voting has ended for proposal msg123');
      expect(mockStorage.updateProposal).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should update vote counts for active proposals', async () => {
      const futureDate = new Date(Date.now() + 10000).toISOString();
      const mockProposal = {
        status: 'voting',
        end_time: futureDate
      };
      mockStorage.getProposal.mockReturnValue(mockProposal);
      
      // Mock updateVoteCounts method
      const updateVoteCountsSpy = jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue(undefined);

      await proposalManager.handleVoteReaction(mockMessage, '✅', true);

      expect(updateVoteCountsSpy).toHaveBeenCalledWith(mockMessage, mockProposal);

      updateVoteCountsSpy.mockRestore();
    });
  });

  describe('updateVoteCounts', () => {
    it('should correctly count reactions and update storage', async () => {
      const mockYesReaction = { count: 6 }; // 5 real votes + 1 bot
      const mockNoReaction = { count: 3 };  // 2 real votes + 1 bot
      
      mockMessage.reactions.cache.get.mockImplementation((emoji) => {
        if (emoji === '✅') return mockYesReaction;
        if (emoji === '❌') return mockNoReaction;
        return null;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.updateVoteCounts(mockMessage, { id: 'test' });

      expect(mockStorage.updateProposal).toHaveBeenCalledWith('msg123', {
        yes_votes: 5,
        no_votes: 2
      });
      expect(consoleSpy).toHaveBeenCalledWith('Vote counts updated for msg123: Yes=5, No=2');

      consoleSpy.mockRestore();
    });

    it('should handle missing reactions', async () => {
      mockMessage.reactions.cache.get.mockReturnValue(null);

      await proposalManager.updateVoteCounts(mockMessage, { id: 'test' });

      expect(mockStorage.updateProposal).toHaveBeenCalledWith('msg123', {
        yes_votes: 0,
        no_votes: 0
      });
    });

    it('should handle errors gracefully', async () => {
      mockMessage.reactions.cache.get.mockImplementation(() => {
        throw new Error('Reaction fetch failed');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.updateVoteCounts(mockMessage, { id: 'test' });

      expect(consoleSpy).toHaveBeenCalledWith('Error updating vote counts:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('checkEndedVotes', () => {
    it('should process ended votes', async () => {
      const pastDate = new Date(Date.now() - 10000);
      const mockProposal = {
        message_id: 'vote123',
        vote_message_id: 'vote123',
        proposal_type: 'policy',
        end_time: pastDate.toISOString()
      };
      
      mockStorage.getActiveVotes.mockReturnValue([mockProposal]);
      const processEndedVoteSpy = jest.spyOn(proposalManager, 'processEndedVote').mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.checkEndedVotes();

      expect(consoleSpy).toHaveBeenCalledWith('Processing ended vote: vote123 (policy)');
      expect(processEndedVoteSpy).toHaveBeenCalledWith('vote123', mockProposal);

      processEndedVoteSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should skip active votes', async () => {
      const futureDate = new Date(Date.now() + 10000);
      const mockProposal = {
        vote_message_id: 'vote123',
        end_time: futureDate.toISOString()
      };
      
      mockStorage.getActiveVotes.mockReturnValue([mockProposal]);
      const processEndedVoteSpy = jest.spyOn(proposalManager, 'processEndedVote').mockResolvedValue(undefined);

      await proposalManager.checkEndedVotes();

      expect(processEndedVoteSpy).not.toHaveBeenCalled();

      processEndedVoteSpy.mockRestore();
    });

    it('should handle check ended votes errors gracefully', async () => {
      mockStorage.getActiveVotes.mockRejectedValue(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.checkEndedVotes();

      expect(consoleSpy).toHaveBeenCalledWith('Error checking ended votes:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('processEndedVote', () => {
    beforeEach(async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };
      await proposalManager.initialize('test-table', 'guild123', mockConfig);
    });

    it('should process passed proposal correctly', async () => {
      const mockProposal = {
        voteChannelId: 'vote123',
        yes_votes: 5,
        no_votes: 2,
        isWithdrawal: false,
        proposal_type: 'policy'
      };
      
      mockStorage.getProposal.mockReturnValue({ ...mockProposal, yes_votes: 6, no_votes: 2 });
      const updateVoteCountsSpy = jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue(undefined);
      const moveToResolutionsSpy = jest.spyOn(proposalManager, 'moveToResolutions').mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.processEndedVote('vote123', mockProposal);

      expect(updateVoteCountsSpy).toHaveBeenCalled();
      expect(mockStorage.updateProposal).toHaveBeenCalledWith('vote123', expect.objectContaining({
        status: 'passed',
        final_yes: 6,
        final_no: 2
      }));
      expect(mockMessage.edit).toHaveBeenCalledWith(expect.stringContaining('✅ **PASSED**'));
      expect(moveToResolutionsSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Processed ended vote vote123: PASSED');

      updateVoteCountsSpy.mockRestore();
      moveToResolutionsSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should process failed proposal correctly', async () => {
      const mockProposal = {
        voteChannelId: 'vote123',
        yes_votes: 2,
        no_votes: 5,
        isWithdrawal: false
      };
      
      mockStorage.getProposal.mockReturnValue(mockProposal);
      const updateVoteCountsSpy = jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.processEndedVote('vote123', mockProposal);

      expect(updateVoteCountsSpy).toHaveBeenCalled();
      expect(mockStorage.updateProposal).toHaveBeenCalledWith('vote123', expect.objectContaining({
        status: 'failed',
        final_yes: 2,
        final_no: 5
      }));
      expect(mockMessage.edit).toHaveBeenCalledWith(expect.stringContaining('❌ **FAILED**'));
      expect(consoleSpy).toHaveBeenCalledWith('Processed ended vote vote123: FAILED');

      updateVoteCountsSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle missing vote message', async () => {
      const mockProposal = { voteChannelId: 'vote123' };
      mockChannel.messages.fetch.mockRejectedValue(new Error('Message not found'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.processEndedVote('vote123', mockProposal);

      expect(consoleSpy).toHaveBeenCalledWith('Error processing ended vote vote123:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle general processing errors', async () => {
      const mockProposal = { voteChannelId: 'vote123' };
      mockStorage.getProposal.mockImplementation(() => {
        throw new Error('Storage error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.processEndedVote('vote123', mockProposal);

      expect(consoleSpy).toHaveBeenCalledWith('Error processing ended vote vote123:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('voting monitor integration', () => {
    beforeEach(async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };
      await proposalManager.initialize('test-table', 'guild123', mockConfig);
    });

    it('should start voting monitor on initialization', () => {
      expect(proposalManager.votingMonitorInterval).not.toBeNull();
    });

    it('should stop voting monitor', () => {
      // Mock setInterval to return a timer ID that can be cleared
      proposalManager.votingMonitorInterval = 123; // Simulate active timer
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      proposalManager.stopVotingMonitor();
      
      expect(clearIntervalSpy).toHaveBeenCalledWith(123);
      expect(proposalManager.votingMonitorInterval).toBeNull();
      
      clearIntervalSpy.mockRestore();
    });

    it('should check ended votes periodically', () => {
      // Stop the existing timer and restart with a spy
      proposalManager.stopVotingMonitor();
      
      const checkEndedVotesSpy = jest.spyOn(proposalManager, 'checkEndedVotes').mockResolvedValue();
      
      // Restart the monitor so it uses the spy
      proposalManager.startVotingMonitor();
      
      // Fast forward time to trigger the interval
      jest.advanceTimersByTime(60000); // 1 minute
      
      expect(checkEndedVotesSpy).toHaveBeenCalled();
      
      checkEndedVotesSpy.mockRestore();
    });
  });

});