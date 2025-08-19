const ProposalManager = require('../../src/managers/ProposalManager');
const DynamoProposalStorage = require('../../src/storage/DynamoProposalStorage');
const ProposalParser = require('../../src/processors/ProposalParser');
const WithdrawalProcessor = require('../../src/processors/WithdrawalProcessor');

// Mock the dependencies
jest.mock('../../src/storage/DynamoProposalStorage');
jest.mock('../../src/processors/ProposalParser');
jest.mock('../../src/processors/WithdrawalProcessor');

describe('ProposalManager - Support Reactions', () => {
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
      getActiveVotes: jest.fn().mockResolvedValue([]),
      updateVoteCounts: jest.fn().mockResolvedValue(),
      markProposalComplete: jest.fn().mockResolvedValue()
    };

    // Mock parser
    mockParser = {
      parseProposal: jest.fn(),
      isValidFormat: jest.fn(),
      getProposalType: jest.fn(),
      createVoteMessage: jest.fn().mockReturnValue('Vote message content'),
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

  describe('handleSupportReaction', () => {
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

    it('should ignore already tracked proposals', async () => {
      mockStorage.getProposal.mockResolvedValue({ id: 'existing' });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.handleSupportReaction(mockMessage, 3);

      expect(consoleSpy).toHaveBeenCalledWith('Message msg123 already being tracked');
      expect(mockParser.getProposalType).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should ignore non-proposal messages', async () => {
      mockStorage.getProposal.mockResolvedValue(null);
      mockParser.getProposalType.mockReturnValue(null);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.handleSupportReaction(mockMessage, 3);

      expect(consoleSpy).toHaveBeenCalledWith('Message msg123 is not a valid proposal for this channel');

      consoleSpy.mockRestore();
    });

    it('should track reactions below threshold', async () => {
      mockStorage.getProposal.mockResolvedValue(null);
      mockParser.getProposalType.mockReturnValue({
        type: 'policy',
        config: { supportThreshold: 5 },
        isWithdrawal: false
      });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.handleSupportReaction(mockMessage, 3);

      expect(consoleSpy).toHaveBeenCalledWith('policy proposal msg123 has 3/5 reactions');

      consoleSpy.mockRestore();
    });

    it('should move to vote when threshold is reached', async () => {
      mockStorage.getProposal.mockResolvedValue(null);
      const mockProposalConfig = {
        type: 'policy',
        config: { supportThreshold: 5, voteChannelId: 'vote123' },
        isWithdrawal: false
      };
      mockParser.getProposalType.mockReturnValue(mockProposalConfig);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock moveToVote method
      const moveToVoteSpy = jest.spyOn(proposalManager, 'moveToVote').mockResolvedValue(undefined);

      await proposalManager.handleSupportReaction(mockMessage, 5);

      expect(consoleSpy).toHaveBeenCalledWith('policy proposal msg123 has reached 5/5 support reactions, moving to vote');
      expect(moveToVoteSpy).toHaveBeenCalledWith(mockMessage, 'policy', mockProposalConfig.config, mockProposalConfig.isWithdrawal);

      consoleSpy.mockRestore();
      moveToVoteSpy.mockRestore();
    });

    it('should handle withdrawal proposals correctly', async () => {
      mockStorage.getProposal.mockResolvedValue(null);
      mockParser.getProposalType.mockReturnValue({
        type: 'policy',
        config: { supportThreshold: 5 },
        isWithdrawal: true
      });
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.handleSupportReaction(mockMessage, 3);

      // Check that the withdrawal proposal is properly logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('withdrawal proposal msg123 has 3/5 reactions'));

      consoleSpy.mockRestore();
    });

    it('should handle support reaction errors gracefully', async () => {
      mockStorage.getProposal.mockRejectedValue(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.handleSupportReaction(mockMessage, 3);

      expect(consoleSpy).toHaveBeenCalledWith('Error handling support reaction:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('moveToVote', () => {
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

    it('should successfully move proposal to vote', async () => {
      const config = { voteChannelId: 'vote123', voteDuration: 86400000 };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.moveToVote(mockMessage, 'policy', config, false);

      expect(mockChannel.send).toHaveBeenCalled();
      expect(mockMessage.react).toHaveBeenCalledWith('✅');
      expect(mockMessage.react).toHaveBeenCalledWith('❌');
      expect(mockStorage.addProposal).toHaveBeenCalled();
      expect(mockMessage.edit).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('policy proposal moved to vote: msg123');

      consoleSpy.mockRestore();
    });

    it('should handle missing vote channel', async () => {
      mockGuild.channels.cache.get.mockReturnValue(null);
      const config = { voteChannelId: 'nonexistent123' };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToVote(mockMessage, 'policy', config, false);

      expect(consoleSpy).toHaveBeenCalledWith('Vote channel nonexistent123 not found for policy');
      expect(mockChannel.send).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle withdrawal proposals with valid target', async () => {
      const config = { voteChannelId: 'vote123', voteDuration: 86400000 };
      const mockTarget = { messageId: 'res123', content: 'Resolution content' };
      mockWithdrawalProcessor.parseWithdrawalTarget.mockResolvedValue(mockTarget);

      await proposalManager.moveToVote(mockMessage, 'policy', config, true);

      expect(mockWithdrawalProcessor.parseWithdrawalTarget).toHaveBeenCalledWith(mockMessage.content, 'policy', config);
      expect(mockStorage.addProposal).toHaveBeenCalledWith('msg123', expect.objectContaining({
        is_withdrawal: true,
        target_resolution: mockTarget
      }));
    });

    it('should handle withdrawal proposals with invalid target', async () => {
      const config = { voteChannelId: 'vote123', voteDuration: 86400000 };
      mockWithdrawalProcessor.parseWithdrawalTarget.mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToVote(mockMessage, 'policy', config, true);

      expect(consoleSpy).toHaveBeenCalledWith('Could not find target resolution for withdrawal: **Policy**: Test proposal content');
      expect(mockStorage.addProposal).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle edit message errors gracefully', async () => {
      const config = { voteChannelId: 'vote123', voteDuration: 86400000 };
      mockMessage.edit.mockRejectedValue(new Error('Edit failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToVote(mockMessage, 'policy', config, false);

      expect(consoleSpy).toHaveBeenCalledWith('Could not edit original message:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle general errors', async () => {
      const config = { voteChannelId: 'vote123', voteDuration: 86400000 };
      mockChannel.send.mockRejectedValue(new Error('Send failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToVote(mockMessage, 'policy', config, false);

      expect(consoleSpy).toHaveBeenCalledWith('Error moving proposal to vote:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});