const BotControlHandler = require('../../src/handlers/BotControlHandler');

describe('BotControlHandler', () => {
  let botControlHandler;
  let mockBot;
  let mockMessage;
  let mockMember;
  let mockGuild;

  beforeEach(() => {
    mockBot = {
      getUserValidator: jest.fn().mockReturnValue({
        canUseModerator: jest.fn()
      }),
      enableBot: jest.fn(),
      disableBot: jest.fn(),
      getBotId: jest.fn().mockReturnValue('bot123'),
      getRunId: jest.fn().mockReturnValue('target-bot-123')
    };

    mockMember = {
      id: 'user123'
    };

    mockGuild = {
      id: 'guild123',
      members: {
        cache: new Map([['user123', mockMember]])
      }
    };

    mockMessage = {
      reply: jest.fn(),
      author: { id: 'user123' },
      guild: mockGuild
    };

    botControlHandler = new BotControlHandler(mockBot);
  });

  describe('constructor', () => {
    it('should initialize with bot reference', () => {
      expect(botControlHandler.bot).toBe(mockBot);
    });
  });

  describe('handleModeratorCommand', () => {
    it('should handle !boton command', async () => {
      const spy = jest.spyOn(botControlHandler, 'handleBotOn').mockResolvedValue();
      
      await botControlHandler.handleModeratorCommand(mockMessage, mockMember, '!boton test123');
      
      expect(spy).toHaveBeenCalledWith(mockMessage, 'test123');
      spy.mockRestore();
    });

    it('should handle !botoff command', async () => {
      const spy = jest.spyOn(botControlHandler, 'handleBotOff').mockResolvedValue();
      
      await botControlHandler.handleModeratorCommand(mockMessage, mockMember, '!botoff test123');
      
      expect(spy).toHaveBeenCalledWith(mockMessage, 'test123');
      spy.mockRestore();
    });

    it('should ignore non-bot-control commands', async () => {
      const onSpy = jest.spyOn(botControlHandler, 'handleBotOn').mockResolvedValue();
      const offSpy = jest.spyOn(botControlHandler, 'handleBotOff').mockResolvedValue();
      
      await botControlHandler.handleModeratorCommand(mockMessage, mockMember, '!other command');
      
      expect(onSpy).not.toHaveBeenCalled();
      expect(offSpy).not.toHaveBeenCalled();
      
      onSpy.mockRestore();
      offSpy.mockRestore();
    });
  });

  describe('handleMemberCommand', () => {
    it('should handle !boton command', async () => {
      const spy = jest.spyOn(botControlHandler, 'handleBotOn').mockResolvedValue();
      
      await botControlHandler.handleMemberCommand(mockMessage, mockMember, '!boton test123');
      
      expect(spy).toHaveBeenCalledWith(mockMessage, 'test123');
      spy.mockRestore();
    });

    it('should handle !botoff command', async () => {
      const spy = jest.spyOn(botControlHandler, 'handleBotOff').mockResolvedValue();
      
      await botControlHandler.handleMemberCommand(mockMessage, mockMember, '!botoff test123');
      
      expect(spy).toHaveBeenCalledWith(mockMessage, 'test123');
      spy.mockRestore();
    });

    it('should ignore non-bot-control commands', async () => {
      const onSpy = jest.spyOn(botControlHandler, 'handleBotOn').mockResolvedValue();
      const offSpy = jest.spyOn(botControlHandler, 'handleBotOff').mockResolvedValue();
      
      await botControlHandler.handleMemberCommand(mockMessage, mockMember, '!other command');
      
      expect(onSpy).not.toHaveBeenCalled();
      expect(offSpy).not.toHaveBeenCalled();
      
      onSpy.mockRestore();
      offSpy.mockRestore();
    });
  });

  describe('handleBotOn', () => {
    it('should require administrator permissions', async () => {
      mockMember.permissions = { has: jest.fn().mockReturnValue(false) };
      
      await botControlHandler.handleBotOn(mockMessage, 'bot123');
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ This command is restricted to administrators only.');
    });

    it('should require run ID argument', async () => {
      mockMember.permissions = { has: jest.fn().mockReturnValue(true) };
      
      await botControlHandler.handleBotOn(mockMessage, '');
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ Please provide a run ID. Usage: `!boton <run_id>`');
    });

    it('should enable bot with specified run ID', async () => {
      mockMember.permissions = { has: jest.fn().mockReturnValue(true) };
      mockMessage.author.tag = 'testuser#1234';
      
      await botControlHandler.handleBotOn(mockMessage, 'target-bot-123');
      
      expect(mockBot.enableBot).toHaveBeenCalledWith('bot123');
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Bot Control Update'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('target-bot-123'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Status:** Enabled'));
    });

    it('should handle member not found error', async () => {
      mockGuild.members.cache.clear();
      
      await botControlHandler.handleBotOn(mockMessage, 'bot123');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Could not find your membership'));
    });

    it('should handle unexpected errors gracefully', async () => {
      mockMember.permissions = { has: jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      }) };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await botControlHandler.handleBotOn(mockMessage, 'bot123');
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while enabling the bot.');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('handleBotOff', () => {
    it('should require administrator permissions', async () => {
      mockMember.permissions = { has: jest.fn().mockReturnValue(false) };
      
      await botControlHandler.handleBotOff(mockMessage, 'bot123');
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ This command is restricted to administrators only.');
    });

    it('should require run ID argument', async () => {
      mockMember.permissions = { has: jest.fn().mockReturnValue(true) };
      
      await botControlHandler.handleBotOff(mockMessage, '');
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ Please provide a run ID. Usage: `!botoff <run_id>`');
    });

    it('should disable bot with specified run ID', async () => {
      mockMember.permissions = { has: jest.fn().mockReturnValue(true) };
      mockMessage.author.tag = 'testuser#1234';
      
      await botControlHandler.handleBotOff(mockMessage, 'target-bot-123');
      
      expect(mockBot.disableBot).toHaveBeenCalledWith('bot123');
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Bot Control Update'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('target-bot-123'));
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Status:** Disabled'));
    });

    it('should handle member not found error', async () => {
      mockGuild.members.cache.clear();
      
      await botControlHandler.handleBotOff(mockMessage, 'bot123');
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Could not find your membership'));
    });

    it('should handle unexpected errors gracefully', async () => {
      mockMember.permissions = { has: jest.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      }) };
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await botControlHandler.handleBotOff(mockMessage, 'bot123');
      
      expect(mockMessage.reply).toHaveBeenCalledWith('❌ An error occurred while disabling the bot.');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});