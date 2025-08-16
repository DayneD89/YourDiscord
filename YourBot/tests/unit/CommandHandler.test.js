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
      jest.spyOn(commandHandler, 'handleAddConfig').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleRemoveConfig').mockResolvedValue();
      jest.spyOn(commandHandler, 'handleViewConfig').mockResolvedValue();
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

    it('should handle !addconfig command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!addconfig {"test": "config"}', true);

      expect(commandHandler.handleAddConfig).toHaveBeenCalledWith(mockMessage, '{"test": "config"}');
    });

    it('should handle !removeconfig command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!removeconfig msg123 emoji', true);

      expect(commandHandler.handleRemoveConfig).toHaveBeenCalledWith(mockMessage, 'msg123 emoji');
    });

    it('should handle !viewconfig command', async () => {
      await commandHandler.handleModeratorCommand(mockMessage, mockMember, '!viewconfig', true);

      expect(commandHandler.handleViewConfig).toHaveBeenCalledWith(mockMessage);
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

  describe('handleAddConfig', () => {
    it('should add valid config successfully', async () => {
      const configJson = '{"from": "msg123", "action": "emoji", "to": "AddRole(user_id,\'member\')"}';
      mockBot.configManager.addConfig.mockResolvedValue();
      mockBot.getConfig = jest.fn(() => [{ from: 'msg123' }]);
      
      await commandHandler.handleAddConfig(mockMessage, configJson);

      expect(mockBot.configManager.addConfig).toHaveBeenCalledWith({
        from: 'msg123',
        action: 'emoji',
        to: "AddRole(user_id,'member')"
      });
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Config added successfully!')
      );
    });

    it('should handle invalid JSON', async () => {
      const invalidJson = '{"from": "msg123", "action":}';
      
      await commandHandler.handleAddConfig(mockMessage, invalidJson);

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ Invalid JSON format. Please check your config and try again.'
      );
    });

    it('should handle config manager errors', async () => {
      const configJson = '{"from": "msg123", "action": "emoji"}';
      mockBot.configManager.addConfig.mockRejectedValue(new Error('Config validation failed'));
      
      await commandHandler.handleAddConfig(mockMessage, configJson);

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ Config validation failed');
    });
  });

  describe('handleRemoveConfig', () => {
    it('should remove config successfully', async () => {
      mockBot.configManager.removeConfig.mockResolvedValue();
      mockBot.getConfig = jest.fn(() => []);
      
      await commandHandler.handleRemoveConfig(mockMessage, 'msg123 emoji');

      expect(mockBot.configManager.removeConfig).toHaveBeenCalledWith('msg123', 'emoji');
      expect(mockMessage.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Config removed successfully!')
      );
    });

    it('should handle invalid parameters', async () => {
      await commandHandler.handleRemoveConfig(mockMessage, 'msg123');

      expect(mockMessage.reply).toHaveBeenCalledWith(
        '❌ Usage: `!removeconfig <message_id> <action>`'
      );
    });

    it('should handle config manager errors', async () => {
      mockBot.configManager.removeConfig.mockRejectedValue(new Error('Config not found'));
      
      await commandHandler.handleRemoveConfig(mockMessage, 'msg123 emoji');

      expect(mockMessage.reply).toHaveBeenCalledWith('❌ Config not found');
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