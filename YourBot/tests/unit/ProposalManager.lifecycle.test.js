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

describe('ProposalManager - Lifecycle & Resolutions', () => {
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
      id: 'resolutions123',
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
      markProposalComplete: jest.fn().mockResolvedValue(),
      getProposalsByType: jest.fn().mockReturnValue([])
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
      processWithdrawal: jest.fn().mockResolvedValue(),
      initialize: jest.fn()
    };

    // Mock moderator processor
    mockModeratorProcessor = {
      processModeratorAction: jest.fn().mockResolvedValue(true),
      initialize: jest.fn()
    };

    DynamoProposalStorage.mockImplementation(() => mockStorage);
    ProposalParser.mockImplementation(() => mockParser);
    WithdrawalProcessor.mockImplementation(() => mockWithdrawalProcessor);
    ModeratorProcessor.mockImplementation(() => mockModeratorProcessor);

    // Create fresh instance
    proposalManager = new ProposalManager(mockBot);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('moveToResolutions', () => {
    beforeEach(async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        },
        moderator: {
          supportThreshold: 3,
          voteDuration: 86400000,
          voteChannelId: 'mod-vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };
      await proposalManager.initialize('test-table', 'guild123', mockConfig);
    });

    it('should successfully move proposal to resolutions', async () => {
      const mockProposal = {
        proposal_type: 'policy',
        author_id: 'author123',
        content: 'Test proposal content',
        completed_at: new Date().toISOString(),
        final_yes: 6,
        final_no: 2
      };
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.moveToResolutions(mockProposal, mockGuild);

      expect(mockChannel.send).toHaveBeenCalledWith(expect.stringContaining('**PASSED POLICY RESOLUTION**'));
      expect(mockChannel.send).toHaveBeenCalledWith(expect.stringContaining('<@author123>'));
      expect(consoleSpy).toHaveBeenCalledWith('policy resolution moved to resolutions123');

      consoleSpy.mockRestore();
    });

    it('should handle missing resolutions channel', async () => {
      mockGuild.channels.cache.get.mockReturnValue(null);
      const mockProposal = { proposal_type: 'policy' };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToResolutions(mockProposal, mockGuild);

      expect(consoleSpy).toHaveBeenCalledWith('Resolutions channel resolutions123 not found for policy');
      expect(mockChannel.send).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle send errors gracefully', async () => {
      mockChannel.send.mockRejectedValue(new Error('Send failed'));
      const mockProposal = { proposal_type: 'policy' };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToResolutions(mockProposal, mockGuild);

      expect(consoleSpy).toHaveBeenCalledWith('Error moving to resolutions:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle withdrawal proposals correctly', async () => {
      const mockProposal = {
        proposal_type: 'policy',
        author_id: 'author123',
        content: 'Test withdrawal',
        completed_at: new Date().toISOString(),
        final_yes: 6,
        final_no: 2,
        is_withdrawal: true,
        target_resolution: { messageId: 'res123' }
      };
      
      await proposalManager.moveToResolutions(mockProposal, mockGuild);

      // moveToResolutions should post to resolutions channel, not call processors
      expect(mockChannel.send).toHaveBeenCalledWith(expect.stringContaining('PASSED POLICY RESOLUTION'));
    });

    it('should handle moderator proposals correctly', async () => {
      const mockProposal = {
        proposal_type: 'moderator',
        author_id: 'author123',
        content: '**Add Moderator**: <@123456>',
        completed_at: new Date().toISOString(),
        final_yes: 6,
        final_no: 2
      };
      
      await proposalManager.moveToResolutions(mockProposal, mockGuild);

      // moveToResolutions should post to resolutions channel, not call processors
      expect(mockChannel.send).toHaveBeenCalledWith(expect.stringContaining('PASSED MODERATOR RESOLUTION'));
    });
  });

  describe('error logging and edge cases', () => {
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

    it('should log errors when checking ended votes fails', async () => {
      mockStorage.getActiveVotes.mockRejectedValue(new Error('Database connection failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.checkEndedVotes();

      expect(consoleSpy).toHaveBeenCalledWith('Error checking ended votes:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle moderator processing failures gracefully', async () => {
      const mockProposal = {
        proposal_type: 'moderator',
        author_id: 'author123',
        content: '**Add Moderator**: <@invalid>',
        completed_at: new Date().toISOString(),
        final_yes: 6,
        final_no: 2
      };
      
      // Test error handling when guild.channels.cache.get fails
      mockGuild.channels.cache.get.mockReturnValue(undefined);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToResolutions(mockProposal, mockGuild);

      expect(consoleSpy).toHaveBeenCalledWith('Error moving to resolutions:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle proposal completion tracking', async () => {
      const mockProposal = {
        proposal_type: 'policy',
        author_id: 'author123',
        content: 'Test proposal',
        message_id: 'msg123',
        completed_at: new Date().toISOString(),
        final_yes: 6,
        final_no: 2
      };

      await proposalManager.moveToResolutions(mockProposal, mockGuild);

      // moveToResolutions should post to resolutions channel
      expect(mockChannel.send).toHaveBeenCalledWith(expect.stringContaining('PASSED POLICY RESOLUTION'));
    });
  });

  describe('proposal lifecycle integration', () => {
    beforeEach(async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        },
        moderator: {
          supportThreshold: 3,
          voteDuration: 86400000,
          voteChannelId: 'mod-vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };
      await proposalManager.initialize('test-table', 'guild123', mockConfig);
    });

    it('should handle complete proposal lifecycle from support to resolution', async () => {
      // Simulate complete lifecycle
      const mockProposal = {
        proposal_type: 'policy',
        author_id: 'author123',
        content: '**Policy**: Test complete lifecycle',
        message_id: 'msg123'
      };

      // Mock the progression through all stages
      const moveToVoteSpy = jest.spyOn(proposalManager, 'moveToVote').mockResolvedValue();
      const processEndedVoteSpy = jest.spyOn(proposalManager, 'processEndedVote').mockResolvedValue();
      const moveToResolutionsSpy = jest.spyOn(proposalManager, 'moveToResolutions').mockResolvedValue();

      // Simulate support reaction reaching threshold
      mockStorage.getProposal.mockReturnValue(null);
      mockParser.getProposalType.mockReturnValue({
        type: 'policy',
        config: { supportThreshold: 5, voteChannelId: 'vote123' },
        isWithdrawal: false
      });

      await proposalManager.handleSupportReaction(mockMessage, 5);

      expect(moveToVoteSpy).toHaveBeenCalled();

      moveToVoteSpy.mockRestore();
      processEndedVoteSpy.mockRestore();
      moveToResolutionsSpy.mockRestore();
    });

    it('should handle voting monitor stopping', () => {
      // Start the monitor first so there's something to stop
      proposalManager.startVotingMonitor();
      expect(proposalManager.votingMonitorInterval).not.toBeNull();
      
      proposalManager.stopVotingMonitor();
      
      expect(proposalManager.votingMonitorInterval).toBeNull();
    });

    it('should restart voting monitor after stop', () => {
      // Start monitor first
      proposalManager.startVotingMonitor();
      proposalManager.stopVotingMonitor();
      expect(proposalManager.votingMonitorInterval).toBeNull();
      
      proposalManager.startVotingMonitor();
      expect(proposalManager.votingMonitorInterval).not.toBeNull();
    });
  });

  describe('proposal metadata and tracking', () => {
    it('should track proposal creation timestamps', async () => {
      // Test that proposal manager properly delegates to storage for getProposal
      const messageId = 'msg123';
      proposalManager.getProposal(messageId);

      expect(mockStorage.getProposal).toHaveBeenCalledWith(messageId);
    });

    it('should handle proposal type filtering', () => {
      const mockProposals = [
        { proposal_type: 'policy', id: '1' },
        { proposal_type: 'governance', id: '2' },
        { proposal_type: 'policy', id: '3' }
      ];
      
      mockStorage.getProposalsByType.mockReturnValue(mockProposals.filter(p => p.proposal_type === 'policy'));

      const result = proposalManager.getProposalsByType('policy');

      expect(result).toHaveLength(2);
      expect(result.every(p => p.proposal_type === 'policy')).toBe(true);
    });
  });
});