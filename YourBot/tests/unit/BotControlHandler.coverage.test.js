const BotControlHandler = require('../../src/handlers/BotControlHandler');

describe('BotControlHandler - Coverage Tests', () => {
    let handler;
    let mockBot;
    let mockMessage;

    beforeEach(() => {
        const mockGuild = {
            members: {
                cache: {
                    get: jest.fn().mockReturnValue({
                        permissions: {
                            has: jest.fn().mockReturnValue(true)
                        }
                    })
                }
            }
        };

        mockMessage = {
            reply: jest.fn().mockResolvedValue(),
            author: { tag: 'testuser', id: 'user123' },
            guild: mockGuild
        };

        mockBot = {
            getRunId: jest.fn().mockReturnValue('test-run-123'),
            getBotId: jest.fn().mockReturnValue('bot-123'),
            enableBot: jest.fn(),
            disableBot: jest.fn()
        };

        handler = new BotControlHandler(mockBot);
        
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
    });

    describe('handleBotOn - validation and flow coverage', () => {
        it('should handle invalid run ID format', async () => {
            await handler.handleBotOn(mockMessage, 'invalid id!');

            expect(mockMessage.reply).toHaveBeenCalledWith(
                '❌ Invalid run ID format. Please provide a valid run ID from Terraform.'
            );
        });

        it('should silently ignore commands for different bot instances', async () => {
            await handler.handleBotOn(mockMessage, 'different-run-id');

            expect(console.log).toHaveBeenCalledWith(
                'Ignoring !boton command for different bot instance. Current: test-run-123, Requested: different-run-id'
            );
            expect(mockMessage.reply).not.toHaveBeenCalled();
        });
    });

    describe('handleBotOff - validation and flow coverage', () => {
        it('should handle invalid run ID format', async () => {
            await handler.handleBotOff(mockMessage, 'invalid@id');

            expect(mockMessage.reply).toHaveBeenCalledWith(
                '❌ Invalid run ID format. Please provide a valid run ID from Terraform.'
            );
        });

        it('should silently ignore commands for different bot instances', async () => {
            await handler.handleBotOff(mockMessage, 'other-instance');

            expect(console.log).toHaveBeenCalledWith(
                'Ignoring !botoff command for different bot instance. Current: test-run-123, Requested: other-instance'
            );
            expect(mockMessage.reply).not.toHaveBeenCalled();
        });
    });

    describe('edge cases for run ID validation', () => {
        it('should reject run ID that is too short', async () => {
            await handler.handleBotOn(mockMessage, 'ab');

            expect(mockMessage.reply).toHaveBeenCalledWith(
                '❌ Invalid run ID format. Please provide a valid run ID from Terraform.'
            );
        });

        it('should reject run ID that is too long', async () => {
            const longRunId = 'a'.repeat(51);
            await handler.handleBotOff(mockMessage, longRunId);

            expect(mockMessage.reply).toHaveBeenCalledWith(
                '❌ Invalid run ID format. Please provide a valid run ID from Terraform.'
            );
        });

        it('should accept valid run ID with dashes and underscores', async () => {
            mockBot.getRunId.mockReturnValue('valid-run_id-123');
            
            await handler.handleBotOn(mockMessage, 'valid-run_id-123');

            expect(mockBot.enableBot).toHaveBeenCalledWith('bot-123');
            expect(mockMessage.reply).toHaveBeenCalledWith(
                expect.stringContaining('✅ **Bot Control Update**')
            );
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
});