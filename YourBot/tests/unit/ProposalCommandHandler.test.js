const ProposalCommandHandler = require('../../src/handlers/ProposalCommandHandler');

describe('ProposalCommandHandler', () => {
  let proposalCommandHandler;
  let mockBot;
  let mockMessage;
  let mockMember;
  let mockGuild;

  beforeEach(() => {
    mockBot = {
      getProposalManager: jest.fn().mockReturnValue({
        getPendingProposals: jest.fn(),
        getActiveVotes: jest.fn(),
        getProposal: jest.fn(),
        forceEndVote: jest.fn()
      }),
      getModeratorRoleId: jest.fn().mockReturnValue('moderator-role-123')
    };

    mockMember = {
      id: 'user123',
      displayName: 'TestUser'
    };

    mockGuild = {
      id: 'guild123',
      members: {
        cache: new Map([['user123', mockMember]])
      },
      roles: {
        cache: new Map([
          ['moderator-role-123', { 
            id: 'moderator-role-123', 
            name: 'Moderator',
            members: new Map([
              ['mod1', { id: 'mod1', user: { tag: 'mod1#1234' } }],
              ['mod2', { id: 'mod2', user: { tag: 'mod2#5678' } }]
            ])
          }]
        ])
      }
    };

    mockMessage = {
      reply: jest.fn(),
      author: { id: 'user123', tag: 'testuser#1234' },
      guild: mockGuild,
      id: 'msg123'
    };

    proposalCommandHandler = new ProposalCommandHandler(mockBot);
  });

  describe('constructor', () => {
    it('should initialize with bot reference', () => {
      expect(proposalCommandHandler.bot).toBe(mockBot);
    });
  });

  describe('handleModeratorCommand', () => {
    it('should handle !forcevote command', async () => {
      const spy = jest.spyOn(proposalCommandHandler, 'handleForceVote').mockResolvedValue();
      
      await proposalCommandHandler.handleModeratorCommand(mockMessage, mockMember, '!forcevote msg123');
      
      expect(spy).toHaveBeenCalledWith(mockMessage, 'msg123');
      spy.mockRestore();
    });

    it('should handle !voteinfo command', async () => {
      const spy = jest.spyOn(proposalCommandHandler, 'handleVoteInfo').mockResolvedValue();
      
      await proposalCommandHandler.handleModeratorCommand(mockMessage, mockMember, '!voteinfo msg123');
      
      expect(spy).toHaveBeenCalledWith(mockMessage, 'msg123');
      spy.mockRestore();
    });

    it('should ignore non-handled commands', async () => {
      const forceSpy = jest.spyOn(proposalCommandHandler, 'handleForceVote').mockResolvedValue();
      
      await proposalCommandHandler.handleModeratorCommand(mockMessage, mockMember, '!other command');
      
      expect(forceSpy).not.toHaveBeenCalled();
      forceSpy.mockRestore();
    });
  });

  describe('handleMemberCommand', () => {
    it('should handle !propose command with help message', async () => {
      await proposalCommandHandler.handleMemberCommand(mockMessage, mockMember, '!propose test');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('post your message in the debate channel'));
    });

    it('should handle !proposals command', async () => {
      const spy = jest.spyOn(proposalCommandHandler, 'handleViewProposals').mockResolvedValue();
      
      await proposalCommandHandler.handleMemberCommand(mockMessage, mockMember, '!proposals');
      
      expect(spy).toHaveBeenCalledWith(mockMessage);
      spy.mockRestore();
    });

    it('should handle !activevotes command', async () => {
      const spy = jest.spyOn(proposalCommandHandler, 'handleActiveVotes').mockResolvedValue();
      
      await proposalCommandHandler.handleMemberCommand(mockMessage, mockMember, '!activevotes');
      
      expect(spy).toHaveBeenCalledWith(mockMessage);
      spy.mockRestore();
    });

    it('should handle !moderators command', async () => {
      const spy = jest.spyOn(proposalCommandHandler, 'handleViewModerators').mockResolvedValue();
      
      await proposalCommandHandler.handleMemberCommand(mockMessage, mockMember, '!moderators');
      
      expect(spy).toHaveBeenCalledWith(mockMessage);
      spy.mockRestore();
    });

    it('should handle !voteinfo command', async () => {
      const spy = jest.spyOn(proposalCommandHandler, 'handleVoteInfo').mockResolvedValue();
      
      await proposalCommandHandler.handleMemberCommand(mockMessage, mockMember, '!voteinfo msg123');
      
      expect(spy).toHaveBeenCalledWith(mockMessage, 'msg123');
      spy.mockRestore();
    });

    it('should ignore non-handled commands', async () => {
      const proposalsSpy = jest.spyOn(proposalCommandHandler, 'handleViewProposals').mockResolvedValue();
      
      await proposalCommandHandler.handleMemberCommand(mockMessage, mockMember, '!other command');
      
      expect(proposalsSpy).not.toHaveBeenCalled();
      proposalsSpy.mockRestore();
    });
  });

  describe('handleViewProposals', () => {
    it('should display no proposals message when empty', async () => {
      mockBot.getProposalManager().getPendingProposals.mockResolvedValue([]);
      
      await proposalCommandHandler.handleViewProposals(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('No pending proposals found'));
    });

    it('should display pending proposals with progress', async () => {
      const mockProposals = [
        {
          messageId: 'prop1',
          proposalType: 'policy',
          content: '**Policy**: Test proposal 1',
          authorId: 'user1',
          author: { tag: 'user1#1234' },
          channelId: 'channel123',
          createdAt: new Date('2025-01-01T10:00:00Z'),
          supportCount: 3,
          requiredSupport: 5
        },
        {
          messageId: 'prop2',
          proposalType: 'moderator',
          content: '**Moderator**: Test proposal 2',
          authorId: 'user2',
          author: { tag: 'user2#5678' },
          channelId: 'channel123',
          createdAt: new Date('2025-01-01T11:00:00Z'),
          supportCount: 2,
          requiredSupport: 3
        }
      ];
      
      mockBot.getProposalManager().getPendingProposals.mockResolvedValue(mockProposals);
      mockBot.commandRouter = {
        createProgressBar: jest.fn().mockReturnValue('█████░'),
        formatUserMentions: jest.fn().mockImplementation((text) => text)
      };
      mockMessage.guildId = 'guild123';
      
      await proposalCommandHandler.handleViewProposals(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Pending Proposals'));
    });

    it('should handle errors gracefully', async () => {
      mockBot.getProposalManager().getPendingProposals.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await proposalCommandHandler.handleViewProposals(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('error occurred'));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('handleActiveVotes', () => {
    it('should display no active votes message when empty', async () => {
      mockBot.getProposalManager().getActiveVotes.mockResolvedValue([]);
      
      await proposalCommandHandler.handleActiveVotes(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('No active votes'));
    });

    it('should display active votes with vote counts', async () => {
      const mockVotes = [
        {
          messageId: 'vote1',
          proposalType: 'policy',
          content: '**Policy**: Test vote 1',
          author: { tag: 'user1#1234' },
          channelId: 'channel123',
          yesCount: 5,
          noCount: 2,
          voteEndTime: new Date(Date.now() + 3600000) // 1 hour from now
        }
      ];
      
      mockBot.getProposalManager().getActiveVotes.mockResolvedValue(mockVotes);
      mockBot.commandRouter = {
        formatUserMentions: jest.fn().mockImplementation((text) => text),
        calculateTimeRemaining: jest.fn().mockReturnValue('1 hour remaining')
      };
      mockMessage.guildId = 'guild123';
      
      await proposalCommandHandler.handleActiveVotes(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Active Votes'));
    });

    it('should handle errors gracefully', async () => {
      mockBot.getProposalManager().getActiveVotes.mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await proposalCommandHandler.handleActiveVotes(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('error occurred'));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('handleViewModerators', () => {
    it('should display current moderators', async () => {
      // Add permissions and other required properties to mock members
      const mockMod1 = {
        id: 'mod1',
        user: { tag: 'mod1#1234', bot: false },
        displayName: 'Moderator1',
        username: 'mod1',
        joinedTimestamp: Date.now() - 86400000,
        permissions: {
          has: jest.fn().mockReturnValue(false)
        }
      };
      const mockMod2 = {
        id: 'mod2',
        user: { tag: 'mod2#5678', bot: false },
        displayName: 'Moderator2',
        username: 'mod2',
        joinedTimestamp: Date.now() - 172800000,
        permissions: {
          has: jest.fn().mockReturnValue(false)
        }
      };

      const mockModeratorsMap = new Map([
        ['mod1', mockMod1],
        ['mod2', mockMod2]
      ]);
      mockModeratorsMap.filter = jest.fn().mockReturnValue([mockMod1, mockMod2]);
      
      mockGuild.roles.cache.get('moderator-role-123').members = mockModeratorsMap;
      mockGuild.ownerId = 'owner123';

      await proposalCommandHandler.handleViewModerators(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Server Moderators'));
    });

    it('should handle no moderators', async () => {
      // Clear moderators from role
      const emptyModeratorsMap = new Map();
      emptyModeratorsMap.filter = jest.fn().mockReturnValue([]);
      mockGuild.roles.cache.get('moderator-role-123').members = emptyModeratorsMap;
      
      await proposalCommandHandler.handleViewModerators(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('No moderators found'));
    });

    it('should handle missing moderator role', async () => {
      mockBot.getModeratorRoleId.mockReturnValue('nonexistent-role');
      
      await proposalCommandHandler.handleViewModerators(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Moderator role not found'));
    });

    it('should handle errors gracefully', async () => {
      mockMessage.guild = null;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await proposalCommandHandler.handleViewModerators(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('error occurred'));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('handleVoteInfo', () => {
    it('should display vote not found for missing message ID', async () => {
      await proposalCommandHandler.handleVoteInfo(mockMessage, '');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Please provide a message ID'));
    });

    it('should display detailed vote information', async () => {
      const mockProposal = {
        messageId: 'vote1',
        proposalType: 'policy',
        content: '**Policy**: Test vote content',
        authorId: 'user1',
        author: { tag: 'user1#1234' },
        channelId: 'channel123',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        yesCount: 5,
        noCount: 2,
        voteEndTime: new Date(Date.now() + 3600000),
        yesVoters: ['voter1', 'voter2'],
        noVoters: ['voter3']
      };
      
      mockBot.getProposalManager().getVoteInfo = jest.fn().mockResolvedValue(mockProposal);
      mockBot.commandRouter = {
        formatUserMentions: jest.fn().mockImplementation((text) => text),
        calculateTimeRemaining: jest.fn().mockReturnValue('1 hour remaining')
      };
      mockMessage.guildId = 'guild123';
      
      await proposalCommandHandler.handleVoteInfo(mockMessage, 'vote1');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('PROPOSAL VOTE'));
    });

    it('should handle proposal not found', async () => {
      mockBot.getProposalManager().getVoteInfo = jest.fn().mockResolvedValue(null);
      
      await proposalCommandHandler.handleVoteInfo(mockMessage, 'nonexistent');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Vote not found'));
    });

    it('should handle errors gracefully', async () => {
      mockBot.getProposalManager().getVoteInfo = jest.fn().mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await proposalCommandHandler.handleVoteInfo(mockMessage, 'vote1');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('error occurred'));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('handleForceVote', () => {
    it('should require message ID', async () => {
      await proposalCommandHandler.handleForceVote(mockMessage, '');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Please provide a message ID'));
    });

    it('should force start a vote successfully', async () => {
      mockBot.getProposalManager().forceStartVote = jest.fn().mockResolvedValue({ success: true });
      
      await proposalCommandHandler.handleForceVote(mockMessage, 'vote1');
      
      expect(mockBot.getProposalManager().forceStartVote).toHaveBeenCalledWith('vote1');
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Successfully forced vote to start'));
    });

    it('should handle force vote failure', async () => {
      mockBot.getProposalManager().forceStartVote = jest.fn().mockResolvedValue({ 
        success: false, 
        error: 'Vote not found' 
      });
      
      await proposalCommandHandler.handleForceVote(mockMessage, 'vote1');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Failed to force vote: Vote not found'));
    });

    it('should handle errors gracefully', async () => {
      mockBot.getProposalManager().forceStartVote = jest.fn().mockRejectedValue(new Error('Database error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await proposalCommandHandler.handleForceVote(mockMessage, 'vote1');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('error occurred'));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});