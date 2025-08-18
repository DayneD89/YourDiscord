const ProposalManager = require('../../src/ProposalManager');
const DynamoProposalStorage = require('../../src/DynamoProposalStorage');
const ProposalParser = require('../../src/ProposalParser');
const WithdrawalProcessor = require('../../src/WithdrawalProcessor');

// Mock the dependencies
jest.mock('../../src/DynamoProposalStorage');
jest.mock('../../src/ProposalParser');
jest.mock('../../src/WithdrawalProcessor');

describe('ProposalManager', () => {
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
      channels: {
        cache: {
          get: jest.fn().mockReturnValue(mockChannel)
        }
      }
    };

    // Set guild reference in message
    mockMessage.guild = mockGuild;

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

    // Mock storage
    mockStorage = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getProposal: jest.fn(),
      addProposal: jest.fn().mockResolvedValue(undefined),
      updateProposal: jest.fn().mockResolvedValue(undefined),
      getAllProposals: jest.fn().mockResolvedValue([]),
      getActiveVotes: jest.fn().mockResolvedValue([]),
      getProposalsByType: jest.fn().mockResolvedValue([])
    };
    DynamoProposalStorage.mockImplementation(() => mockStorage);

    // Mock parser
    mockParser = {
      getProposalType: jest.fn(),
      createVoteMessage: jest.fn().mockReturnValue('Vote message content')
    };
    ProposalParser.mockImplementation(() => mockParser);

    // Mock withdrawal processor
    mockWithdrawalProcessor = {
      parseWithdrawalTarget: jest.fn().mockResolvedValue(null),
      processWithdrawal: jest.fn().mockResolvedValue(undefined)
    };
    WithdrawalProcessor.mockImplementation(() => mockWithdrawalProcessor);

    proposalManager = new ProposalManager(mockBot);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with bot reference and null configs', () => {
      expect(proposalManager.bot).toBe(mockBot);
      expect(proposalManager.proposalConfig).toBeNull();
      expect(proposalManager.parser).toBeNull();
      expect(proposalManager.withdrawalProcessor).toBeNull();
    });

    it('should create storage instance', () => {
      expect(DynamoProposalStorage).toHaveBeenCalled();
      expect(proposalManager.storage).toBe(mockStorage);
    });
  });

  describe('initialize', () => {
    const mockConfig = {
      policy: {
        supportThreshold: 5,
        voteDuration: 86400000,
        voteChannelId: 'vote123',
        resolutionsChannelId: 'resolutions123'
      }
    };

    it('should initialize all components correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);

      expect(proposalManager.proposalConfig).toBe(mockConfig);
      expect(ProposalParser).toHaveBeenCalledWith(mockConfig);
      expect(WithdrawalProcessor).toHaveBeenCalledWith(mockBot, mockConfig);
      expect(mockStorage.initialize).toHaveBeenCalledWith('test-dynamo-table', 'guild123');
      expect(consoleSpy).toHaveBeenCalledWith('Proposal config loaded:', JSON.stringify(mockConfig, null, 2));

      consoleSpy.mockRestore();
    });

    it('should start voting monitor', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });
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
      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);
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
      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);
    });

    it('should successfully move proposal to vote', async () => {
      const config = { voteChannelId: 'vote123', voteDuration: 86400000 };
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.moveToVote(mockMessage, 'policy', config, false);

      expect(mockChannel.send).toHaveBeenCalledWith('Vote message content');
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
      const config = { voteChannelId: 'vote123' };
      mockWithdrawalProcessor.parseWithdrawalTarget.mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToVote(mockMessage, 'policy', config, true);

      expect(consoleSpy).toHaveBeenCalledWith('Could not find target resolution for withdrawal: **Policy**: Test proposal content');
      expect(mockMessage.reply).toHaveBeenCalledWith('Could not find the target resolution to withdraw. Please ensure you have referenced a valid resolution.');
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
      const config = { voteChannelId: 'vote123' };
      mockChannel.send.mockRejectedValue(new Error('Send failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.moveToVote(mockMessage, 'policy', config, false);

      expect(consoleSpy).toHaveBeenCalledWith('Error moving proposal to vote:', expect.any(Error));

      consoleSpy.mockRestore();
    });
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
      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);
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

      expect(mockStorage.updateProposal).toHaveBeenCalledWith('vote123', expect.objectContaining({
        status: 'failed'
      }));
      expect(mockMessage.edit).toHaveBeenCalledWith(expect.stringContaining('❌ **FAILED**'));
      expect(consoleSpy).toHaveBeenCalledWith('Processed ended vote vote123: FAILED');

      updateVoteCountsSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should process withdrawal proposals correctly', async () => {
      const mockProposal = {
        voteChannelId: 'vote123',
        yes_votes: 5,
        no_votes: 2,
        is_withdrawal: true
      };
      
      mockStorage.getProposal.mockReturnValue({ ...mockProposal, yes_votes: 6, no_votes: 2 });
      const updateVoteCountsSpy = jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue(undefined);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.processEndedVote('vote123', mockProposal);

      expect(mockWithdrawalProcessor.processWithdrawal).toHaveBeenCalled();
      expect(mockMessage.edit).toHaveBeenCalledWith(expect.stringContaining('The target resolution has been withdrawn.'));
      expect(consoleSpy).toHaveBeenCalledWith('Processed ended withdrawal vote vote123: PASSED');

      updateVoteCountsSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const mockProposal = { voteChannelId: 'vote123' };
      mockChannel.messages.fetch.mockRejectedValue(new Error('Fetch failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.processEndedVote('vote123', mockProposal);

      expect(consoleSpy).toHaveBeenCalledWith('Error processing ended vote vote123:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('moveToResolutions', () => {
    beforeEach(async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };
      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);
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
  });

  describe('delegate methods', () => {
    it('should delegate getProposal to storage', () => {
      const mockResult = { id: 'test' };
      mockStorage.getProposal.mockReturnValue(mockResult);

      const result = proposalManager.getProposal('msg123');

      expect(mockStorage.getProposal).toHaveBeenCalledWith('msg123');
      expect(result).toBe(mockResult);
    });

    it('should delegate getAllProposals to storage', () => {
      const mockResult = [{ id: 'test1' }, { id: 'test2' }];
      mockStorage.getAllProposals.mockReturnValue(mockResult);

      const result = proposalManager.getAllProposals();

      expect(mockStorage.getAllProposals).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });

    it('should delegate getActiveVotes to storage', async () => {
      const mockResult = [{ id: 'vote1' }];
      mockStorage.getActiveVotes.mockReturnValue(Promise.resolve(mockResult));

      const result = await proposalManager.getActiveVotes();

      expect(mockStorage.getActiveVotes).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should delegate getProposalsByType to storage', () => {
      const mockResult = [{ type: 'policy' }];
      mockStorage.getProposalsByType.mockReturnValue(mockResult);

      const result = proposalManager.getProposalsByType('policy');

      expect(mockStorage.getProposalsByType).toHaveBeenCalledWith('policy');
      expect(result).toBe(mockResult);
    });
  });

  describe('voting monitor integration', () => {
    it('should call checkEndedVotes on interval', async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };

      const checkEndedVotesSpy = jest.spyOn(proposalManager, 'checkEndedVotes').mockResolvedValue(undefined);

      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);

      // Fast-forward the timer
      jest.advanceTimersByTime(60000);

      expect(checkEndedVotesSpy).toHaveBeenCalled();

      checkEndedVotesSpy.mockRestore();
    });

    it('should call checkEndedVotes on startup delay', async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };

      const checkEndedVotesSpy = jest.spyOn(proposalManager, 'checkEndedVotes').mockResolvedValue(undefined);

      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);

      // Fast-forward the startup delay
      jest.advanceTimersByTime(5000);

      expect(checkEndedVotesSpy).toHaveBeenCalled();

      checkEndedVotesSpy.mockRestore();
    });
  });

  describe('checkEndedVotes error logging', () => {
    beforeEach(async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };
      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);
    });

    it('should log errors when processing ended votes fails', async () => {
      const mockEndedVotes = [
        { message_id: 'msg1', proposal_type: 'policy' },
        { message_id: 'msg2', proposal_type: 'policy' }
      ];

      mockStorage.getActiveVotes.mockReturnValue(mockEndedVotes);
      
      // Mock processEndedVote to fail for one vote
      const processEndedVoteSpy = jest.spyOn(proposalManager, 'processEndedVote')
        .mockResolvedValueOnce() // First succeeds
        .mockRejectedValueOnce(new Error('Failed to process vote')); // Second fails
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.checkEndedVotes();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to process ended vote msg2:',
        expect.any(Error)
      );

      processEndedVoteSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('processEndedVote moderator processing', () => {
    beforeEach(async () => {
      const mockConfig = {
        moderator: {
          supportThreshold: 3,
          voteDuration: 86400000,
          voteChannelId: 'vote123',
          resolutionsChannelId: 'resolutions123'
        }
      };
      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);

      // Setup moderator processor mock
      proposalManager.moderatorProcessor = {
        processModeratorAction: jest.fn()
      };
    });

    it('should process moderator action when proposal passes', async () => {
      const mockProposal = {
        message_id: 'msg123',
        proposal_type: 'moderator',
        is_withdrawal: false,
        vote_channel_id: 'vote123',
        yes_votes: 5,
        no_votes: 2
      };

      const mockUpdatedProposal = {
        ...mockProposal,
        final_yes: 5,
        final_no: 2
      };

      mockStorage.getProposal.mockResolvedValue(mockUpdatedProposal);
      mockStorage.updateProposal.mockResolvedValue();
      
      const updateVoteCountsSpy = jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue();
      proposalManager.moderatorProcessor.processModeratorAction.mockResolvedValue(true);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await proposalManager.processEndedVote('msg123', mockProposal);

      expect(proposalManager.moderatorProcessor.processModeratorAction).toHaveBeenCalledWith(mockUpdatedProposal, mockGuild);
      expect(consoleSpy).toHaveBeenCalledWith('✅ Moderator action processed successfully for msg123');

      updateVoteCountsSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should log error when moderator processing fails', async () => {
      const mockProposal = {
        message_id: 'msg123',
        proposal_type: 'moderator',
        is_withdrawal: false,
        vote_channel_id: 'vote123',
        yes_votes: 5,
        no_votes: 2
      };

      const mockUpdatedProposal = {
        ...mockProposal,
        final_yes: 5,
        final_no: 2
      };

      mockStorage.getProposal.mockResolvedValue(mockUpdatedProposal);
      mockStorage.updateProposal.mockResolvedValue();
      
      const updateVoteCountsSpy = jest.spyOn(proposalManager, 'updateVoteCounts').mockResolvedValue();
      proposalManager.moderatorProcessor.processModeratorAction.mockResolvedValue(false);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await proposalManager.processEndedVote('msg123', mockProposal);

      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to process moderator action for msg123');

      updateVoteCountsSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('getPendingProposals', () => {
    beforeEach(async () => {
      const mockConfig = {
        policy: {
          supportThreshold: 5,
          voteDuration: 86400000,
          debateChannelId: 'debate123',
          voteChannelId: 'vote123'
        },
        governance: {
          supportThreshold: 3,
          voteDuration: 86400000,
          debateChannelId: 'debate456',
          voteChannelId: 'vote456'
        }
      };
      await proposalManager.initialize('test-dynamo-table', 'guild123', mockConfig);
    });

    it('should find pending proposals with support reactions', async () => {
      // Mock debate channels
      const mockDebateChannel1 = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', {
              id: 'msg1',
              content: '**Policy**: Test proposal 1',
              author: { id: 'user1', tag: 'user1#1234' },
              createdAt: new Date('2025-01-01'),
              reactions: {
                cache: new Map([
                  ['✅', { count: 3, me: false }]
                ])
              }
            }],
            ['msg2', {
              id: 'msg2',
              content: '**Policy**: Test proposal 2',
              author: { id: 'user2', tag: 'user2#1234' },
              createdAt: new Date('2025-01-02'),
              reactions: {
                cache: new Map([
                  ['✅', { count: 2, me: false }]
                ])
              }
            }]
          ]))
        }
      };

      const mockDebateChannel2 = {
        id: 'debate456',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map())
        }
      };

      mockGuild.channels.cache.get
        .mockReturnValueOnce(mockDebateChannel1)
        .mockReturnValueOnce(mockDebateChannel2);

      // Mock parser to recognize valid proposals
      mockParser.getProposalType
        .mockReturnValueOnce({
          type: 'policy',
          isWithdrawal: false,
          config: { supportThreshold: 5 }
        })
        .mockReturnValueOnce({
          type: 'policy',
          isWithdrawal: false,
          config: { supportThreshold: 5 }
        });

      // Mock storage to return null (no existing proposals)
      mockStorage.getProposal.mockResolvedValue(null);

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(2);
      expect(result[0].messageId).toBe('msg1');
      expect(result[0].supportCount).toBe(3);
      expect(result[0].requiredSupport).toBe(5);
      expect(result[1].messageId).toBe('msg2');
      expect(result[1].supportCount).toBe(2);
      
      // Should be sorted by support count (descending)
      expect(result[0].supportCount).toBeGreaterThan(result[1].supportCount);
    });

    it('should skip messages already tracked in DynamoDB', async () => {
      const mockDebateChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', {
              id: 'msg1',
              content: '**Policy**: Already tracked proposal',
              author: { id: 'user1', tag: 'user1#1234' },
              createdAt: new Date('2025-01-01'),
              reactions: {
                cache: new Map([
                  ['✅', { count: 3, me: false }]
                ])
              }
            }]
          ]))
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockDebateChannel);
      
      // Mock storage to return existing proposal
      mockStorage.getProposal.mockResolvedValue({ message_id: 'msg1', status: 'voting' });

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(0);
    });

    it('should skip messages without valid proposal format', async () => {
      const mockDebateChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', {
              id: 'msg1',
              content: 'This is not a valid proposal format',
              author: { id: 'user1', tag: 'user1#1234' },
              createdAt: new Date('2025-01-01'),
              reactions: {
                cache: new Map([
                  ['✅', { count: 3, me: false }]
                ])
              }
            }]
          ]))
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockDebateChannel);
      mockStorage.getProposal.mockResolvedValue(null);
      
      // Mock parser to not recognize the format
      mockParser.getProposalType.mockReturnValue(null);

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(0);
    });

    it('should skip messages without support reactions', async () => {
      const mockDebateChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', {
              id: 'msg1',
              content: '**Policy**: No reactions',
              author: { id: 'user1', tag: 'user1#1234' },
              createdAt: new Date('2025-01-01'),
              reactions: {
                cache: new Map() // No reactions
              }
            }]
          ]))
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockDebateChannel);
      mockStorage.getProposal.mockResolvedValue(null);
      mockParser.getProposalType.mockReturnValue({
        type: 'policy',
        isWithdrawal: false,
        config: { supportThreshold: 5 }
      });

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(0);
    });

    it('should skip messages that have reached support threshold', async () => {
      const mockDebateChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', {
              id: 'msg1',
              content: '**Policy**: Full support',
              author: { id: 'user1', tag: 'user1#1234' },
              createdAt: new Date('2025-01-01'),
              reactions: {
                cache: new Map([
                  ['✅', { count: 5, me: false }] // Meets threshold
                ])
              }
            }]
          ]))
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockDebateChannel);
      mockStorage.getProposal.mockResolvedValue(null);
      mockParser.getProposalType.mockReturnValue({
        type: 'policy',
        isWithdrawal: false,
        config: { supportThreshold: 5 }
      });

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(0);
    });

    it('should handle missing debate channels', async () => {
      mockGuild.channels.cache.get.mockReturnValue(null);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith('Debate channel debate123 not found for policy');

      consoleSpy.mockRestore();
    });

    it('should handle errors when fetching channel messages', async () => {
      const mockDebateChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockRejectedValue(new Error('Failed to fetch messages'))
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockDebateChannel);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error scanning channel debate123 for pending proposals:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle guild not found', async () => {
      mockBot.client.guilds.cache.get.mockReturnValue(null);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await proposalManager.getPendingProposals();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Guild not found for pending proposals search');

      consoleSpy.mockRestore();
    });

    it('should handle general errors gracefully', async () => {
      // Force an error by making bot.client throw
      Object.defineProperty(mockBot, 'client', {
        get: jest.fn(() => {
          throw new Error('Client error');
        })
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await proposalManager.getPendingProposals();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting pending proposals:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should exclude bot reactions from support count', async () => {
      const mockDebateChannel = {
        id: 'debate123',
        messages: {
          fetch: jest.fn().mockResolvedValue(new Map([
            ['msg1', {
              id: 'msg1',
              content: '**Policy**: Bot reaction test',
              author: { id: 'user1', tag: 'user1#1234' },
              createdAt: new Date('2025-01-01'),
              reactions: {
                cache: new Map([
                  ['✅', { count: 4, me: true }] // Bot reacted, so actual support is 3
                ])
              }
            }]
          ]))
        }
      };

      mockGuild.channels.cache.get.mockReturnValue(mockDebateChannel);
      mockStorage.getProposal.mockResolvedValue(null);
      mockParser.getProposalType.mockReturnValue({
        type: 'policy',
        isWithdrawal: false,
        config: { supportThreshold: 5 }
      });

      const result = await proposalManager.getPendingProposals();

      expect(result).toHaveLength(1);
      expect(result[0].supportCount).toBe(3); // 4 - 1 (bot)
    });
  });
});