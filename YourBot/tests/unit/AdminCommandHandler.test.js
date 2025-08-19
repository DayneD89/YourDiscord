const AdminCommandHandler = require('../../src/handlers/AdminCommandHandler');

describe('AdminCommandHandler', () => {
  let adminCommandHandler;
  let mockBot;
  let mockMessage;
  let mockMember;

  beforeEach(() => {
    mockBot = {
      getRunId: jest.fn().mockReturnValue('run123'),
      getBotId: jest.fn().mockReturnValue('bot123'),
      getProposalManager: jest.fn().mockReturnValue({
        proposalConfig: {
          policy: {
            debateChannelId: 'debate123',
            voteChannelId: 'vote123',
            resolutionsChannelId: 'res123',
            supportThreshold: 5,
            formats: ['Policy']
          },
          moderator: {
            debateChannelId: 'mod-debate123',
            voteChannelId: 'mod-vote123',
            resolutionsChannelId: 'mod-res123',
            supportThreshold: 3,
            formats: ['Add Moderator', 'Remove Moderator']
          }
        }
      })
    };

    mockMember = {
      id: 'user123'
    };

    mockMessage = {
      reply: jest.fn(),
      author: { id: 'user123', tag: 'testuser#1234' }
    };

    adminCommandHandler = new AdminCommandHandler(mockBot);
  });

  describe('constructor', () => {
    it('should initialize with bot reference', () => {
      expect(adminCommandHandler.bot).toBe(mockBot);
    });
  });

  describe('handleModeratorCommand', () => {
    it('should handle !help command', async () => {
      const spy = jest.spyOn(adminCommandHandler, 'handleModeratorHelp').mockResolvedValue();
      
      await adminCommandHandler.handleModeratorCommand(mockMessage, mockMember, '!help');
      
      expect(spy).toHaveBeenCalledWith(mockMessage);
      spy.mockRestore();
    });

    it('should ignore non-help commands', async () => {
      const helpSpy = jest.spyOn(adminCommandHandler, 'handleModeratorHelp').mockResolvedValue();
      
      await adminCommandHandler.handleModeratorCommand(mockMessage, mockMember, '!other command');
      
      expect(helpSpy).not.toHaveBeenCalled();
      helpSpy.mockRestore();
    });
  });

  describe('handleMemberCommand', () => {
    it('should handle !ping command', async () => {
      const spy = jest.spyOn(adminCommandHandler, 'handlePing').mockResolvedValue();
      
      await adminCommandHandler.handleMemberCommand(mockMessage, mockMember, '!ping');
      
      expect(spy).toHaveBeenCalledWith(mockMessage);
      spy.mockRestore();
    });

    it('should handle !help command', async () => {
      const spy = jest.spyOn(adminCommandHandler, 'handleMemberHelp').mockResolvedValue();
      
      await adminCommandHandler.handleMemberCommand(mockMessage, mockMember, '!help');
      
      expect(spy).toHaveBeenCalledWith(mockMessage);
      spy.mockRestore();
    });

    it('should ignore non-ping/help commands', async () => {
      const pingSpy = jest.spyOn(adminCommandHandler, 'handlePing').mockResolvedValue();
      const helpSpy = jest.spyOn(adminCommandHandler, 'handleMemberHelp').mockResolvedValue();
      
      await adminCommandHandler.handleMemberCommand(mockMessage, mockMember, '!other command');
      
      expect(pingSpy).not.toHaveBeenCalled();
      expect(helpSpy).not.toHaveBeenCalled();
      pingSpy.mockRestore();
      helpSpy.mockRestore();
    });
  });

  describe('handlePing', () => {
    it('should respond with bot status information', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await adminCommandHandler.handlePing(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Pong!'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('run123'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Uptime'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Memory'));
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Ping command executed'));
      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      mockBot.getRunId.mockImplementation(() => {
        throw new Error('Test error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await adminCommandHandler.handlePing(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('error occurred'));
      expect(consoleSpy).toHaveBeenCalledWith('Error handling ping command:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('handleMemberHelp', () => {
    it('should show member help information', async () => {
      await adminCommandHandler.handleMemberHelp(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Member Bot Commands'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('!proposals'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('!events'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('!help'));
    });

    it('should include proposal information', async () => {
      await adminCommandHandler.handleMemberHelp(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('How to Participate'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('policy proposals'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('5 ✅ reactions'));
    });

    it('should include moderator management info when moderator config exists', async () => {
      await adminCommandHandler.handleMemberHelp(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Moderator Management'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Add Moderator'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Remove Moderator'));
    });

    it('should handle missing proposal config', async () => {
      mockBot.getProposalManager.mockReturnValue({ proposalConfig: null });
      
      await adminCommandHandler.handleMemberHelp(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Member Bot Commands'));
    });
  });

  describe('handleModeratorHelp', () => {
    it('should show moderator help information', async () => {
      await adminCommandHandler.handleModeratorHelp(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Moderator Bot Commands'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('!addevent'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('!removeevent'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('!forcevote'));
    });

    it('should include proposal system information', async () => {
      await adminCommandHandler.handleModeratorHelp(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Proposal System'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('policy'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('moderator'));
    });

    it('should include channel IDs in help', async () => {
      await adminCommandHandler.handleModeratorHelp(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('debate123'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('vote123'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('res123'));
    });

    it('should handle missing proposal config', async () => {
      mockBot.getProposalManager.mockReturnValue({ proposalConfig: null });
      
      await adminCommandHandler.handleModeratorHelp(mockMessage);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Moderator Bot Commands'));
    });
  });
});