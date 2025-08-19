const CommandHandler = require('../../src/CommandHandler');
const MockBot = require('../helpers/mockBot');
const { MockMessage, MockMember, MockGuild, MockUser } = require('../helpers/mockDiscord');

describe('CommandHandler', () => {
  let commandHandler;
  let mockBot;
  let mockMessage;
  let mockMember;
  let mockGuild;

  beforeEach(() => {
    mockBot = new MockBot();
    commandHandler = new CommandHandler(mockBot);
    
    mockGuild = new MockGuild();
    mockMember = new MockMember();
    mockMessage = new MockMessage({ 
      guild: mockGuild,
      author: mockMember.user 
    });
    
    // Setup guild members cache
    mockGuild.members.cache.set(mockMember.user.id, mockMember);
  });

  describe('handleCommand', () => {
    it('should process valid moderator command', async () => {
      mockMessage.content = '!help';
      mockBot.userValidator.canUseModerator.mockReturnValue(true);
      
      const handleModeratorCommandSpy = jest.spyOn(commandHandler, 'handleModeratorCommand');
      
      await commandHandler.handleCommand(mockMessage, true);

      expect(handleModeratorCommandSpy).toHaveBeenCalledWith(
        mockMessage, 
        mockMember, 
        '!help', 
        true
      );
    });

    it('should process valid member command', async () => {
      mockMessage.content = '!help';
      mockBot.userValidator.hasRole.mockReturnValue(true);
      
      const handleMemberCommandSpy = jest.spyOn(commandHandler, 'handleMemberCommand');
      
      await commandHandler.handleCommand(mockMessage, false);

      expect(handleMemberCommandSpy).toHaveBeenCalledWith(
        mockMessage, 
        mockMember, 
        '!help', 
        true
      );
    });

    it('should handle member not found in guild cache', async () => {
      mockGuild.members.cache.clear(); // Remove member from cache
      
      await commandHandler.handleCommand(mockMessage, false);

      expect(mockMessage.reply).toHaveBeenCalledWith('Error: Could not find your membership in this server.');
    });

    it('should handle errors gracefully', async () => {
      mockMessage.content = '!help';
      mockBot.userValidator.canUseModerator.mockImplementation(() => {
        throw new Error('Validation error');
      });
      
      await commandHandler.handleCommand(mockMessage, true);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while processing your command.');
    });
  });

  describe('handleModeratorCommand', () => {
    beforeEach(() => {
      jest.spyOn(commandHandler, 'handleModeratorHelp').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleViewProposals').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleActiveVotes').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleVoteInfo').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleForceVote').mockResolvedValue();
    });

    it('should reject non-moderators', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!help', false);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ You need the moderator role or "Manage Roles" permission to use commands in this channel.'
      );
    });

    it('should handle !help command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!help', true);

      expect(commandHandler.handleModeratorHelp).toHaveBeenCalledWith(mockMessage);
    });


    it('should handle !proposals command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!proposals', true);

      expect(commandHandler.handleViewProposals).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle !activevotes command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!activevotes', true);

      expect(commandHandler.handleActiveVotes).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle !voteinfo command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!voteinfo msg123', true);

      expect(commandHandler.handleVoteInfo).toHaveBeenCalledWith(mockMessage, 'msg123');
    });

    it('should handle !forcevote command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!forcevote msg123', true);

      expect(commandHandler.handleForceVote).toHaveBeenCalledWith(mockMessage, 'msg123');
    });

    it('should handle unknown command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!unknown', true);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❓ Unknown moderator command. Type `!help` for available commands.'
      );
    });
  });

  describe('handleMemberCommand', () => {
    beforeEach(() => {
      jest.spyOn(commandHandler, 'handleMemberHelp').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleViewProposals').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleActiveVotes').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleVoteInfo').mockResolvedValue();
    });

    it('should reject non-members', async () => {
      await commandHandler.handleMemberCommand(mockMessage, mockMember, '!help', false);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ You need the member role to use bot commands.'
      );
    });

    it('should handle !help command', async () => {
      await commandHandler.handleMemberCommand(mockMessage, mockMember, '!help', true);

      expect(commandHandler.handleMemberHelp).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle !proposals command', async () => {
      await commandHandler.handleMemberCommand(mockMessage, mockMember, '!proposals', true);

      expect(commandHandler.handleViewProposals).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle !activevotes command', async () => {
      await commandHandler.handleMemberCommand(mockMessage, mockMember, '!activevotes', true);

      expect(commandHandler.handleActiveVotes).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle !voteinfo command', async () => {
      await commandHandler.handleMemberCommand(mockMessage, mockMember, '!voteinfo msg123', true);

      expect(commandHandler.handleVoteInfo).toHaveBeenCalledWith(mockMessage, 'msg123');
    });

    it('should handle unknown command', async () => {
      await commandHandler.handleMemberCommand(mockMessage, mockMember, '!unknown', true);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❓ Unknown command. Type `!help` for available commands.'
      );
    });
  });


  describe('handleViewProposals', () => {
    beforeEach(() => {
      mockBot.proposalManager = {
        getPendingProposals: jest.fn()
      };
      mockBot.getProposalManager = jest.fn(() => mockBot.proposalManager);
    });

    it('should display no proposals message', async () => {
      mockBot.proposalManager.getPendingProposals.mockResolvedValue([]);
      
      await commandHandler.handleViewProposals(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('📋 No pending proposals found. Post a proposal in a debate channel to get started!');
    });

    it('should display proposals list', async () => {
      const mockProposals = [
        {
          messageId: 'msg123',
          channelId: 'channel123',
          content: '**Policy**: Test proposal',
          author: { tag: 'user#1234' },
          supportCount: 3,
          requiredSupport: 5,
          proposalType: 'policy',
          isWithdrawal: false
        }
      ];
      mockBot.proposalManager.getPendingProposals.mockResolvedValue(mockProposals);
      mockMessage.guildId = 'guild123';
      
      await commandHandler.handleViewProposals(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Pending Proposals'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Test proposal'));
    });

    it('should handle long proposals list', async () => {
      const longProposals = Array(20).fill().map((_, i) => ({
        messageId: `msg${i}`,
        channelId: 'channel123',
        content: `Test proposal ${i} with very long content that should trigger message splitting behavior`,
        author: { tag: `user${i}#1234` },
        supportCount: Math.floor(Math.random() * 5) + 1,
        requiredSupport: 5,
        proposalType: 'policy',
        isWithdrawal: false
      }));
      mockBot.proposalManager.getPendingProposals.mockResolvedValue(longProposals);
      mockMessage.guildId = 'guild123';
      
      await commandHandler.handleViewProposals(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockBot.proposalManager.getPendingProposals.mockImplementation(() => {
        throw new Error('Proposal error');
      });
      
      await commandHandler.handleViewProposals(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while retrieving proposals.');
    });
  });

  describe('handleActiveVotes', () => {
    beforeEach(() => {
      mockBot.proposalManager = {
        getActiveVotes: jest.fn()
      };
      mockBot.getProposalManager = jest.fn(() => mockBot.proposalManager);
      mockBot.getGuildId = jest.fn(() => 'guild123');
    });

    it('should display no active votes message', async () => {
      mockBot.proposalManager.getActiveVotes.mockReturnValue([]);
      
      await commandHandler.handleActiveVotes(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('🗳️ No active votes currently running.');
    });

    it('should display active votes list', async () => {
      const mockVotes = [
        {
          authorId: 'user123',
          content: 'Test vote content',
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          yesVotes: 8,
          noVotes: 3,
          voteChannelId: 'channel123',
          voteMessageId: 'msg456',
          proposalType: 'governance'
        }
      ];
      mockBot.proposalManager.getActiveVotes.mockReturnValue(mockVotes);
      
      await commandHandler.handleActiveVotes(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Active Votes'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Test vote content'));
    });

    it('should handle errors gracefully', async () => {
      mockBot.proposalManager.getActiveVotes.mockImplementation(() => {
        throw new Error('Active votes error');
      });
      
      await commandHandler.handleActiveVotes(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while retrieving active votes.');
    });
  });

  describe('handleVoteInfo', () => {
    beforeEach(() => {
      mockBot.proposalManager = {
        getProposal: jest.fn()
      };
      mockBot.getProposalManager = jest.fn(() => mockBot.proposalManager);
      mockBot.getGuildId = jest.fn(() => 'guild123');
    });

    it('should handle proposal not found', async () => {
      mockBot.proposalManager.getProposal.mockReturnValue(null);
      
      await commandHandler.handleVoteInfo(mockMessage, 'msg123');

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ No proposal found with that message ID.');
    });

    it('should display voting proposal info', async () => {
      const mockProposal = {
        status: 'voting',
        authorId: 'user123',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        yesVotes: 15,
        noVotes: 7,
        voteChannelId: 'channel123',
        voteMessageId: 'msg456',
        content: 'Test proposal content',
        proposalType: 'policy'
      };
      mockBot.proposalManager.getProposal.mockReturnValue(mockProposal);
      
      await commandHandler.handleVoteInfo(mockMessage, 'msg123');

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Proposal Information'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('VOTING'));
    });

    it('should display completed proposal info', async () => {
      const mockProposal = {
        status: 'passed',
        authorId: 'user123',
        startTime: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        finalYes: 20,
        finalNo: 5,
        content: 'Completed proposal content'
      };
      mockBot.proposalManager.getProposal.mockReturnValue(mockProposal);
      
      await commandHandler.handleVoteInfo(mockMessage, 'msg123');

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Proposal Information'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('PASSED'));
    });

    it('should handle errors gracefully', async () => {
      mockBot.proposalManager.getProposal.mockImplementation(() => {
        throw new Error('Vote info error');
      });
      
      await commandHandler.handleVoteInfo(mockMessage, 'msg123');

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while retrieving vote information.');
    });
  });

  describe('handleForceVote', () => {
    beforeEach(() => {
      mockBot.proposalManager = {
        getProposal: jest.fn(),
        checkEndedVotes: jest.fn()
      };
      mockBot.getProposalManager = jest.fn(() => mockBot.proposalManager);
    });

    it('should handle proposal not found', async () => {
      mockBot.proposalManager.getProposal.mockReturnValue(null);
      
      await commandHandler.handleForceVote(mockMessage, 'msg123');

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ No proposal found with that message ID.');
    });

    it('should handle non-voting proposal', async () => {
      const mockProposal = { status: 'passed' };
      mockBot.proposalManager.getProposal.mockReturnValue(mockProposal);
      
      await commandHandler.handleForceVote(mockMessage, 'msg123');

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ This proposal is not currently in voting status.');
    });

    it('should force end voting proposal', async () => {
      const mockProposal = { 
        status: 'voting',
        endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      };
      mockBot.proposalManager.getProposal.mockReturnValue(mockProposal);
      mockBot.proposalManager.checkEndedVotes.mockResolvedValue();
      
      await commandHandler.handleForceVote(mockMessage, 'msg123');

      expect(mockProposal.endTime).toBeDefined();
      expect(mockBot.proposalManager.checkEndedVotes).toHaveBeenCalled();
      expect(mockMessage.reply).toHaveBeenCalledWith('✅ Vote has been forcefully ended and processed.');
    });

    it('should handle errors gracefully', async () => {
      mockBot.proposalManager.getProposal.mockImplementation(() => {
        throw new Error('Force vote error');
      });
      
      await commandHandler.handleForceVote(mockMessage, 'msg123');

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while forcing the vote to end.');
    });
  });

  describe('handleModeratorHelp', () => {
    it('should display moderator help with proposal config', async () => {
      mockBot.proposalManager = {
        proposalConfig: {
          policy: {
            debateChannelId: 'debate123',
            voteChannelId: 'vote123',
            resolutionsChannelId: 'res123',
            supportThreshold: 5,
            formats: ['Policy']
          }
        }
      };
      mockBot.getProposalManager = jest.fn(() => mockBot.proposalManager);
      
      await commandHandler.handleModeratorHelp(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Moderator Bot Commands'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('policy'));
    });

    it('should display moderator help without proposal config', async () => {
      mockBot.proposalManager = { proposalConfig: null };
      mockBot.getProposalManager = jest.fn(() => mockBot.proposalManager);
      
      await commandHandler.handleModeratorHelp(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Moderator Bot Commands'));
    });
  });

  describe('handleMemberHelp', () => {
    it('should display member help with proposal config', async () => {
      mockBot.proposalManager = {
        proposalConfig: {
          governance: {
            debateChannelId: 'debate456',
            supportThreshold: 3,
            formats: ['Governance']
          }
        }
      };
      mockBot.getProposalManager = jest.fn(() => mockBot.proposalManager);
      
      await commandHandler.handleMemberHelp(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Member Bot Commands'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('governance'));
    });

    it('should display member help without proposal config', async () => {
      mockBot.proposalManager = { proposalConfig: null };
      mockBot.getProposalManager = jest.fn(() => mockBot.proposalManager);
      
      await commandHandler.handleMemberHelp(mockMessage);

      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Member Bot Commands'));
    });
  });

  describe('utility methods', () => {
    describe('getStatusEmoji', () => {
      it('should return correct emojis for different statuses', () => {
        expect(commandHandler.getStatusEmoji('voting')).toBe('🗳️');
        expect(commandHandler.getStatusEmoji('passed')).toBe('✅');
        expect(commandHandler.getStatusEmoji('failed')).toBe('❌');
        expect(commandHandler.getStatusEmoji('other')).toBe('📝');
      });
    });

    describe('getTimeLeft', () => {
      it('should return "Ended" for past dates', () => {
        const pastDate = new Date(Date.now() - 1000).toISOString();
        expect(commandHandler.getTimeLeft(pastDate)).toBe('Ended');
      });

      it('should format days correctly', () => {
        const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        const result = commandHandler.getTimeLeft(futureDate);
        expect(result).toMatch(/\d+d \d+h left/);
      });

      it('should format hours correctly', () => {
        const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
        const result = commandHandler.getTimeLeft(futureDate);
        expect(result).toMatch(/\d+h \d+m left/);
      });

      it('should format minutes correctly', () => {
        const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const result = commandHandler.getTimeLeft(futureDate);
        expect(result).toMatch(/\d+m left/);
      });
    });

    describe('splitMessage', () => {
      it('should split long messages correctly', () => {
        const longText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const chunks = commandHandler.splitMessage(longText, 15);
        
        expect(chunks.length).toBeGreaterThan(1);
        chunks.forEach(chunk => {
          expect(chunk.length).toBeLessThanOrEqual(15);
        });
      });

      it('should handle single line text', () => {
        const text = 'Short text';
        const chunks = commandHandler.splitMessage(text, 100);
        
        expect(chunks).toEqual([text]);
      });

      it('should handle empty text', () => {
        const chunks = commandHandler.splitMessage('', 100);
        
        expect(chunks).toEqual([]);
      });
    });
  });
});