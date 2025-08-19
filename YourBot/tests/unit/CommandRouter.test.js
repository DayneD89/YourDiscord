const CommandRouter = require('../../src/handlers/CommandRouter');

// Mock the handler classes
jest.mock('../../src/handlers/ProposalCommandHandler');
jest.mock('../../src/handlers/EventCommandHandler');
jest.mock('../../src/handlers/BotControlHandler');
jest.mock('../../src/handlers/AdminCommandHandler');

const ProposalCommandHandler = require('../../src/handlers/ProposalCommandHandler');
const EventCommandHandler = require('../../src/handlers/EventCommandHandler');
const BotControlHandler = require('../../src/handlers/BotControlHandler');
const AdminCommandHandler = require('../../src/handlers/AdminCommandHandler');

describe('CommandRouter', () => {
  let commandRouter;
  let mockBot;
  let mockMessage;
  let mockMember;
  let mockGuild;
  let mockProposalHandler;
  let mockEventHandler;
  let mockBotControlHandler;
  let mockAdminHandler;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock handler instances
    mockProposalHandler = {
      handleModeratorCommand: jest.fn(),
      handleMemberCommand: jest.fn()
    };
    mockEventHandler = {
      handleModeratorCommand: jest.fn(),
      handleMemberCommand: jest.fn()
    };
    mockBotControlHandler = {
      handleModeratorCommand: jest.fn(),
      handleMemberCommand: jest.fn()
    };
    mockAdminHandler = {
      handleModeratorHelp: jest.fn(),
      handleModeratorCommand: jest.fn(),
      handleMemberCommand: jest.fn()
    };

    // Mock the constructor calls
    ProposalCommandHandler.mockImplementation(() => mockProposalHandler);
    EventCommandHandler.mockImplementation(() => mockEventHandler);
    BotControlHandler.mockImplementation(() => mockBotControlHandler);
    AdminCommandHandler.mockImplementation(() => mockAdminHandler);

    mockBot = {
      getUserValidator: jest.fn().mockReturnValue({
        canUseModerator: jest.fn(),
        hasRole: jest.fn()
      }),
      getModeratorRoleId: jest.fn().mockReturnValue('mod-role-123'),
      getMemberRoleId: jest.fn().mockReturnValue('member-role-123')
    };

    mockMember = {
      id: 'user123',
      displayName: 'TestUser'
    };

    mockGuild = {
      id: 'guild123',
      members: {
        cache: new Map([['user123', mockMember]])
      }
    };

    mockMessage = {
      reply: jest.fn(),
      author: { id: 'user123', tag: 'testuser#1234' },
      guild: mockGuild,
      content: '!test command'
    };

    commandRouter = new CommandRouter(mockBot);
  });

  describe('constructor', () => {
    it('should initialize with bot reference', () => {
      expect(commandRouter.bot).toBe(mockBot);
    });

    it('should create handler instances', () => {
      expect(ProposalCommandHandler).toHaveBeenCalledWith(mockBot);
      expect(EventCommandHandler).toHaveBeenCalledWith(mockBot);
      expect(BotControlHandler).toHaveBeenCalledWith(mockBot);
      expect(AdminCommandHandler).toHaveBeenCalledWith(mockBot);
    });
  });

  describe('handleCommand', () => {
    it('should handle moderator channel commands', async () => {
      mockBot.getUserValidator().canUseModerator.mockReturnValue(true);
      mockMessage.content = '!forcevote msg123';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await commandRouter.handleCommand(mockMessage, true);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('moderator channel'));
      expect(mockProposalHandler.handleModeratorCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!forcevote msg123'
      );
      consoleSpy.mockRestore();
    });

    it('should handle member channel commands', async () => {
      mockBot.getUserValidator().hasRole.mockReturnValue(true);
      mockMessage.content = '!proposals';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await commandRouter.handleCommand(mockMessage, false);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('member channel'));
      expect(mockProposalHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!proposals'
      );
      consoleSpy.mockRestore();
    });

    it('should handle member not found in guild', async () => {
      mockGuild.members.cache.clear();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await commandRouter.handleCommand(mockMessage, false);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Could not find your membership'));
      expect(consoleSpy).toHaveBeenCalledWith('Member not found in guild cache');
      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      mockGuild.members.cache.get = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await commandRouter.handleCommand(mockMessage, false);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('error occurred'));
      expect(consoleSpy).toHaveBeenCalledWith('Error handling command:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('handleModeratorCommand', () => {
    it('should require moderator permissions', async () => {
      mockBot.getUserValidator().canUseModerator.mockReturnValue(false);
      
      await commandRouter.handleModeratorCommand(mockMessage, mockMember, '!forcevote msg123', false);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('moderator role'));
    });

    it('should route proposal commands', async () => {
      await commandRouter.handleModeratorCommand(mockMessage, mockMember, '!forcevote msg123', true);
      
      expect(mockProposalHandler.handleModeratorCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!forcevote msg123'
      );
    });

    it('should route voteinfo commands', async () => {
      await commandRouter.handleModeratorCommand(mockMessage, mockMember, '!voteinfo msg123', true);
      
      expect(mockProposalHandler.handleModeratorCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!voteinfo msg123'
      );
    });

    it('should route event commands', async () => {
      await commandRouter.handleModeratorCommand(mockMessage, mockMember, '!addevent test', true);
      
      expect(mockEventHandler.handleModeratorCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!addevent test'
      );
    });

    it('should route removeevent commands', async () => {
      await commandRouter.handleModeratorCommand(mockMessage, mockMember, '!removeevent test', true);
      
      expect(mockEventHandler.handleModeratorCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!removeevent test'
      );
    });

    it('should route bot control commands', async () => {
      await commandRouter.handleModeratorCommand(mockMessage, mockMember, '!boton test123', true);
      
      expect(mockBotControlHandler.handleModeratorCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!boton test123'
      );
    });

    it('should handle help command', async () => {
      await commandRouter.handleModeratorCommand(mockMessage, mockMember, '!help', true);
      
      expect(mockAdminHandler.handleModeratorCommand).toHaveBeenCalledWith(mockMessage, mockMember, '!help');
    });

    it('should handle unknown commands', async () => {
      await commandRouter.handleModeratorCommand(mockMessage, mockMember, '!unknown', true);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Unknown moderator command'));
    });
  });

  describe('handleMemberCommand', () => {
    it('should require member role', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!proposals', false);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('member role'));
    });

    it('should route proposal commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!proposals', true);
      
      expect(mockProposalHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!proposals'
      );
    });

    it('should route propose commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!propose test', true);
      
      expect(mockProposalHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!propose test'
      );
    });

    it('should route activevotes commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!activevotes', true);
      
      expect(mockProposalHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!activevotes'
      );
    });

    it('should route moderators commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!moderators', true);
      
      expect(mockProposalHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!moderators'
      );
    });

    it('should route voteinfo commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!voteinfo msg123', true);
      
      expect(mockProposalHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!voteinfo msg123'
      );
    });

    it('should route event commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!events', true);
      
      expect(mockEventHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!events'
      );
    });

    it('should route events with arguments', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!events London', true);
      
      expect(mockEventHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!events London'
      );
    });

    it('should route clearevents commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!clearevents', true);
      
      expect(mockEventHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!clearevents'
      );
    });

    it('should route bot control commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!boton test123', true);
      
      expect(mockBotControlHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!boton test123'
      );
    });

    it('should route ping commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!ping', true);
      
      expect(mockAdminHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!ping'
      );
    });

    it('should route help commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!help', true);
      
      expect(mockAdminHandler.handleMemberCommand).toHaveBeenCalledWith(
        mockMessage, mockMember, '!help'
      );
    });

    it('should handle unknown commands', async () => {
      await commandRouter.handleMemberCommand(mockMessage, mockMember, '!unknown', true);
      
      expect(mockMessage.reply).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    });
  });

  describe('utility methods', () => {
    describe('createProgressBar', () => {
      it('should create progress bar with correct filled/empty ratio', () => {
        const progressBar = commandRouter.createProgressBar(3, 5, 8);
        expect(progressBar).toBe('████░░░░'); // 3/5 * 8 = 4.8 -> 4 filled, 4 empty
      });

      it('should handle full progress', () => {
        const progressBar = commandRouter.createProgressBar(5, 5, 8);
        expect(progressBar).toBe('████████'); // All filled
      });

      it('should handle zero progress', () => {
        const progressBar = commandRouter.createProgressBar(0, 5, 8);
        expect(progressBar).toBe('░░░░░░░░'); // All empty
      });

      it('should handle over-progress', () => {
        const progressBar = commandRouter.createProgressBar(10, 5, 8);
        expect(progressBar).toBe('████████'); // Capped at full
      });
    });

    describe('formatUserMentions', () => {
      it('should replace user mentions with display names', () => {
        const text = 'Hello <@123456> and <@!789012>';
        mockGuild.members.cache.set('123456', { displayName: 'User1' });
        mockGuild.members.cache.set('789012', { displayName: 'User2' });
        
        const result = commandRouter.formatUserMentions(text, mockGuild);
        expect(result).toBe('Hello @User1 and @User2');
      });

      it('should handle missing members', () => {
        const text = 'Hello <@123456>';
        
        const result = commandRouter.formatUserMentions(text, mockGuild);
        expect(result).toBe('Hello <@123456>'); // Unchanged if member not found
      });

      it('should handle null/undefined inputs', () => {
        expect(commandRouter.formatUserMentions(null, mockGuild)).toBeNull();
        expect(commandRouter.formatUserMentions('test', null)).toBe('test');
      });
    });

    describe('calculateTimeRemaining', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-01T12:00:00Z')); // Fixed time
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should calculate time remaining correctly', () => {
        const futureTime = Date.now() + (2 * 60 * 60 * 1000) + (30 * 60 * 1000); // 2h 30m
        const result = commandRouter.calculateTimeRemaining(futureTime);
        expect(result).toBe('2h 30m');
      });

      it('should handle minutes only', () => {
        const futureTime = Date.now() + (45 * 60 * 1000); // 45m
        const result = commandRouter.calculateTimeRemaining(futureTime);
        expect(result).toBe('45m');
      });

      it('should handle past time', () => {
        const pastTime = Date.now() - (60 * 1000); // 1 minute ago
        const result = commandRouter.calculateTimeRemaining(pastTime);
        expect(result).toBe('Voting ended');
      });

      it('should handle zero time', () => {
        const currentTime = Date.now();
        const result = commandRouter.calculateTimeRemaining(currentTime);
        expect(result).toBe('Voting ended');
      });
    });
  });
});