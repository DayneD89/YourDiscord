const ProposalManager = require('../../src/managers/ProposalManager');
const DynamoProposalStorage = require('../../src/storage/DynamoProposalStorage');
const ProposalParser = require('../../src/processors/ProposalParser');
const WithdrawalProcessor = require('../../src/processors/WithdrawalProcessor');
const ModeratorProcessor = require('../../src/processors/ModeratorProcessor');

// Mock the dependencies
jest.mock('../../src/storage/DynamoProposalStorage');
jest.mock('../../src/processors/ProposalParser');
jest.mock('../../src/processors/WithdrawalProcessor');
jest.mock('../../src/processors/ModeratorProcessor');

describe('ProposalManager - Coverage Tests', () => {
  let proposalManager;
  let mockBot;
  let mockGuild;
  let mockChannel;
  let mockMessage;
  let mockStorage;
  let mockParser;
  let mockWithdrawalProcessor;
  let mockModeratorProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock storage
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(),
      getActiveVotes: jest.fn().mockResolvedValue([]),
      getProposal: jest.fn().mockResolvedValue(null),
      addProposal: jest.fn().mockResolvedValue(),
      updateProposal: jest.fn().mockResolvedValue()
    };

    // Mock processors
    mockParser = {
      getProposalType: jest.fn(),
      createVoteMessage: jest.fn().mockReturnValue('Vote message')
    };

    mockWithdrawalProcessor = {
      processWithdrawal: jest.fn().mockResolvedValue()
    };

    mockModeratorProcessor = {
      processModeratorAction: jest.fn().mockResolvedValue(true)
    };

    // Mock message
    mockMessage = {
      id: 'msg123',
      content: 'Test content',
      author: { id: 'author123' },
      channel: { id: 'channel123' },
      edit: jest.fn().mockResolvedValue(),
      reactions: {
        cache: {
          get: jest.fn()
        }
      }
    };

    // Mock channel
    mockChannel = {
      id: 'channel123',
      send: jest.fn().mockResolvedValue(mockMessage),
      messages: {
        fetch: jest.fn().mockResolvedValue(new Map([['msg123', mockMessage]]))
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

    // Mock bot
    mockBot = {
      client: {
        guilds: {
          cache: {
            get: jest.fn().mockReturnValue(mockGuild)
          }
        }
      },
      getGuildId: jest.fn().mockReturnValue('guild123')
    };

    // Mock constructors
    DynamoProposalStorage.mockImplementation(() => mockStorage);
    ProposalParser.mockImplementation(() => mockParser);
    WithdrawalProcessor.mockImplementation(() => mockWithdrawalProcessor);
    ModeratorProcessor.mockImplementation(() => mockModeratorProcessor);

    proposalManager = new ProposalManager(mockBot);
  });

  afterEach(() => {
    if (proposalManager) {
      proposalManager.cleanup();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Dynamic Vote Scheduling', () => {
    beforeEach(async () => {
      const proposalConfig = {
        policy: {
          debateChannelId: 'debate123',
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123',
          supportThreshold: 3,
          voteDuration: 24 * 60 * 60 * 1000
        }
      };
      await proposalManager.initialize('proposals-table', 'guild123', proposalConfig);
    });

    it('should start voting monitor and set timer', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      proposalManager.startVotingMonitor();

      expect(consoleSpy).toHaveBeenCalledWith('Starting dynamic vote monitoring system...');
      expect(consoleSpy).toHaveBeenCalledWith('Dynamic vote monitoring system started');
      expect(proposalManager.initialVoteCheckTimer).toBeTruthy();
      
      consoleSpy.mockRestore();
    });

    it('should schedule next check when no active votes', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockStorage.getActiveVotes.mockResolvedValue([]);

      await proposalManager.scheduleNextVoteCheck();

      expect(consoleSpy).toHaveBeenCalledWith('🗳️ No active votes - scheduling check in 1 hour');
      expect(proposalManager.nextVoteCheckTimeout).toBeTruthy();
      
      consoleSpy.mockRestore();
    });

    it('should handle storage errors in scheduleNextVoteCheck', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Storage error');
      mockStorage.getActiveVotes.mockRejectedValue(error);

      await proposalManager.scheduleNextVoteCheck();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error scheduling next vote check:', error);
      expect(proposalManager.nextVoteCheckTimeout).toBeTruthy();
      
      consoleErrorSpy.mockRestore();
    });

    it('should reschedule vote checks', () => {
      proposalManager.nextVoteCheckTimeout = setTimeout(() => {}, 1000);
      
      proposalManager.rescheduleVoteChecks();

      expect(proposalManager.nextVoteCheckTimeout).toBeNull();
    });

    it('should cleanup timers', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      proposalManager.nextVoteCheckTimeout = setTimeout(() => {}, 1000);
      proposalManager.initialVoteCheckTimer = setTimeout(() => {}, 1000);

      proposalManager.cleanup();

      expect(proposalManager.nextVoteCheckTimeout).toBeNull();
      expect(proposalManager.initialVoteCheckTimer).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('ProposalManager timers cleaned up');
      
      consoleSpy.mockRestore();
    });
  });

  describe('processEndedVote - Advanced Cases', () => {
    let mockVoteMessage;

    beforeEach(async () => {
      const proposalConfig = {
        policy: {
          debateChannelId: 'debate123',
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123',
          supportThreshold: 3,
          voteDuration: 24 * 60 * 60 * 1000
        }
      };
      await proposalManager.initialize('proposals-table', 'guild123', proposalConfig);

      mockVoteMessage = {
        id: 'vote123',
        content: 'Vote content',
        edit: jest.fn().mockResolvedValue(),
        reactions: {
          cache: {
            get: jest.fn()
          }
        }
      };

      mockChannel.messages.fetch.mockResolvedValue(mockVoteMessage);
    });

    it('should process withdrawal proposals', async () => {
      const withdrawalProposal = {
        message_id: 'vote123',
        vote_channel_id: 'vote123',
        is_withdrawal: true,
        yes_votes: 5,
        no_votes: 2
      };

      const passedProposal = {
        ...withdrawalProposal,
        status: 'passed',
        final_yes: 5,
        final_no: 2
      };

      mockStorage.getProposal
        .mockResolvedValueOnce(withdrawalProposal)
        .mockResolvedValueOnce(passedProposal);

      jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue();

      await proposalManager.processEndedVote('vote123', withdrawalProposal);

      expect(mockWithdrawalProcessor.processWithdrawal).toHaveBeenCalledWith(
        passedProposal,
        mockGuild
      );
      expect(mockVoteMessage.edit).toHaveBeenCalledWith(
        expect.stringContaining('The target resolution has been withdrawn.')
      );
    });

    it('should process successful moderator proposals', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const moderatorProposal = {
        message_id: 'vote123',
        vote_channel_id: 'vote123',
        proposal_type: 'moderator',
        is_withdrawal: false,
        yes_votes: 5,
        no_votes: 2
      };

      const passedProposal = {
        ...moderatorProposal,
        status: 'passed',
        final_yes: 5,
        final_no: 2
      };

      mockStorage.getProposal
        .mockResolvedValueOnce(moderatorProposal)
        .mockResolvedValueOnce(passedProposal);

      jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue();
      mockModeratorProcessor.processModeratorAction.mockResolvedValue(true);

      await proposalManager.processEndedVote('vote123', moderatorProposal);

      expect(mockModeratorProcessor.processModeratorAction).toHaveBeenCalledWith(
        passedProposal,
        mockGuild
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ Moderator action processed successfully for vote123');
      
      consoleSpy.mockRestore();
    });

    it('should handle failed moderator proposals', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const moderatorProposal = {
        message_id: 'vote123',
        vote_channel_id: 'vote123',
        proposal_type: 'moderator',
        is_withdrawal: false,
        yes_votes: 5,
        no_votes: 2
      };

      const passedProposal = {
        ...moderatorProposal,
        status: 'passed',
        final_yes: 5,
        final_no: 2
      };

      mockStorage.getProposal
        .mockResolvedValueOnce(moderatorProposal)
        .mockResolvedValueOnce(passedProposal);

      jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue();
      mockModeratorProcessor.processModeratorAction.mockResolvedValue(false);

      await proposalManager.processEndedVote('vote123', moderatorProposal);

      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to process moderator action for vote123');
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getPendingProposals', () => {
    beforeEach(async () => {
      const proposalConfig = {
        policy: {
          debateChannelId: 'debate123',
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123',
          supportThreshold: 3,
          voteDuration: 24 * 60 * 60 * 1000
        }
      };
      await proposalManager.initialize('proposals-table', 'guild123', proposalConfig);
    });

    it('should return empty array when guild not found', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockBot.client.guilds.cache.get.mockReturnValue(null);

      const result = await proposalManager.getPendingProposals();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Guild not found for pending proposals search');
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle missing debate channels', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockGuild.channels.cache.get.mockReturnValue(null);

      const result = await proposalManager.getPendingProposals();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Debate channel debate123 not found for policy');
      
      consoleSpy.mockRestore();
    });

    it('should handle channel scanning errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockDebateChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockRejectedValue(new Error('Fetch failed'))
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockDebateChannel);

      const result = await proposalManager.getPendingProposals();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error scanning channel debate123 for pending proposals:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle general error in getPendingProposals', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      // Force an error by making getGuildId throw
      mockBot.getGuildId.mockImplementation(() => {
        throw new Error('General error');
      });

      const result = await proposalManager.getPendingProposals();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting pending proposals:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });
});