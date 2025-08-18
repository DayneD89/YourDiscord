const ModeratorProcessor = require('../../src/ModeratorProcessor');

// Mock Discord.js structures
const mockBot = {
    getModeratorRoleId: jest.fn().mockReturnValue('123456789012345678')
};

const mockProposalConfig = {
    moderator: {
        debateChannelId: '111111111111111111',
        voteChannelId: '222222222222222222',
        resolutionsChannelId: '333333333333333333',
        supportThreshold: 1,
        formats: ['**Add Moderator**:', '**Remove Moderator**:']
    }
};

describe('ModeratorProcessor', () => {
    let processor;

    beforeEach(() => {
        processor = new ModeratorProcessor(mockBot, mockProposalConfig);
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with bot and proposal config', () => {
            expect(processor.bot).toBe(mockBot);
            expect(processor.proposalConfig).toBe(mockProposalConfig);
        });
    });

    describe('parseModeratorProposal', () => {
        it('should parse add moderator proposal with Discord mention', () => {
            const content = '**Add Moderator**: <@123456789012345678>';
            const result = processor.parseModeratorProposal(content);
            
            expect(result).toEqual({
                action: 'add',
                userId: '123456789012345678',
                targetText: '<@123456789012345678>'
            });
        });

        it('should parse add moderator proposal with nickname mention', () => {
            const content = '**Add Moderator**: <@!123456789012345678>';
            const result = processor.parseModeratorProposal(content);
            
            expect(result).toEqual({
                action: 'add',
                userId: '123456789012345678',
                targetText: '<@!123456789012345678>'
            });
        });

        it('should parse add moderator proposal with raw user ID', () => {
            const content = '**Add Moderator**: 123456789012345678';
            const result = processor.parseModeratorProposal(content);
            
            expect(result).toEqual({
                action: 'add',
                userId: '123456789012345678',
                targetText: '123456789012345678'
            });
        });

        it('should parse remove moderator proposal with Discord mention', () => {
            const content = '**Remove Moderator**: <@987654321098765432>';
            const result = processor.parseModeratorProposal(content);
            
            expect(result).toEqual({
                action: 'remove',
                userId: '987654321098765432',
                targetText: '<@987654321098765432>'
            });
        });

        it('should handle case insensitive format matching', () => {
            const content = '**add moderator**: <@123456789012345678>';
            const result = processor.parseModeratorProposal(content);
            
            expect(result).toEqual({
                action: 'add',
                userId: '123456789012345678',
                targetText: '<@123456789012345678>'
            });
        });

        it('should return null for invalid proposal format', () => {
            const content = 'This is not a valid moderator proposal';
            const result = processor.parseModeratorProposal(content);
            
            expect(result).toBeNull();
        });

        it('should return null for proposal with invalid user ID', () => {
            const content = '**Add Moderator**: invalid_user_id';
            const result = processor.parseModeratorProposal(content);
            
            expect(result).toBeNull();
        });

        it('should handle whitespace in proposal text', () => {
            const content = '**Add Moderator**:   <@123456789012345678>   ';
            const result = processor.parseModeratorProposal(content);
            
            expect(result).toEqual({
                action: 'add',
                userId: '123456789012345678',
                targetText: '<@123456789012345678>'
            });
        });
    });

    describe('extractUserId', () => {
        it('should extract user ID from Discord mention format', () => {
            const result = processor.extractUserId('<@123456789012345678>');
            expect(result).toBe('123456789012345678');
        });

        it('should extract user ID from nickname mention format', () => {
            const result = processor.extractUserId('<@!987654321098765432>');
            expect(result).toBe('987654321098765432');
        });

        it('should extract user ID from raw ID format', () => {
            const result = processor.extractUserId('555666777888999000');
            expect(result).toBe('555666777888999000');
        });

        it('should return null for invalid formats', () => {
            expect(processor.extractUserId('not_a_user_id')).toBeNull();
            expect(processor.extractUserId('@username')).toBeNull();
            expect(processor.extractUserId('<@12345>')).toBeNull(); // Too short
            expect(processor.extractUserId('')).toBeNull();
        });

        it('should handle edge case user IDs', () => {
            // Test minimum length (17 digits)
            expect(processor.extractUserId('12345678901234567')).toBe('12345678901234567');
            // Test maximum length (19 digits)
            expect(processor.extractUserId('1234567890123456789')).toBe('1234567890123456789');
        });
    });

    describe('processModeratorAction', () => {
        let mockGuild, mockMember, mockRole, mockRoleCache, mockMemberCache;

        beforeEach(() => {
            // Setup mock Discord structures
            mockRoleCache = new Map();
            mockMemberCache = new Map();
            
            mockRole = {
                id: '123456789012345678',
                name: 'Moderator'
            };
            mockRoleCache.set('123456789012345678', mockRole);

            mockMember = {
                id: '987654321098765432',
                displayName: 'TestUser',
                roles: {
                    cache: mockMemberCache,
                    add: jest.fn().mockResolvedValue(),
                    remove: jest.fn().mockResolvedValue()
                }
            };

            mockGuild = {
                members: {
                    fetch: jest.fn().mockResolvedValue(mockMember)
                },
                roles: {
                    cache: mockRoleCache
                }
            };
        });

        it('should add moderator role successfully', async () => {
            const proposal = {
                message_id: 'test_message_123',
                content: '**Add Moderator**: <@987654321098765432>'
            };

            // Member doesn't have the role yet
            mockMemberCache.has = jest.fn().mockReturnValue(false);

            const result = await processor.processModeratorAction(proposal, mockGuild);

            expect(result).toBe(true);
            expect(mockGuild.members.fetch).toHaveBeenCalledWith('987654321098765432');
            expect(mockMember.roles.add).toHaveBeenCalledWith(mockRole);
            expect(mockMember.roles.remove).not.toHaveBeenCalled();
        });

        it('should remove moderator role successfully', async () => {
            const proposal = {
                message_id: 'test_message_456',
                content: '**Remove Moderator**: <@987654321098765432>'
            };

            // Member has the role
            mockMemberCache.has = jest.fn().mockReturnValue(true);

            const result = await processor.processModeratorAction(proposal, mockGuild);

            expect(result).toBe(true);
            expect(mockGuild.members.fetch).toHaveBeenCalledWith('987654321098765432');
            expect(mockMember.roles.remove).toHaveBeenCalledWith(mockRole);
            expect(mockMember.roles.add).not.toHaveBeenCalled();
        });

        it('should handle adding role when user already has it', async () => {
            const proposal = {
                message_id: 'test_message_789',
                content: '**Add Moderator**: <@987654321098765432>'
            };

            // Member already has the role
            mockMemberCache.has = jest.fn().mockReturnValue(true);

            const result = await processor.processModeratorAction(proposal, mockGuild);

            expect(result).toBe(true);
            expect(mockMember.roles.add).not.toHaveBeenCalled();
            expect(mockMember.roles.remove).not.toHaveBeenCalled();
        });

        it('should handle removing role when user does not have it', async () => {
            const proposal = {
                message_id: 'test_message_101',
                content: '**Remove Moderator**: <@987654321098765432>'
            };

            // Member doesn't have the role
            mockMemberCache.has = jest.fn().mockReturnValue(false);

            const result = await processor.processModeratorAction(proposal, mockGuild);

            expect(result).toBe(true);
            expect(mockMember.roles.add).not.toHaveBeenCalled();
            expect(mockMember.roles.remove).not.toHaveBeenCalled();
        });

        it('should return false for invalid proposal content', async () => {
            const proposal = {
                message_id: 'test_message_invalid',
                content: 'Not a valid moderator proposal'
            };

            const result = await processor.processModeratorAction(proposal, mockGuild);

            expect(result).toBe(false);
            expect(mockGuild.members.fetch).not.toHaveBeenCalled();
        });

        it('should return false when member is not found', async () => {
            const proposal = {
                message_id: 'test_message_notfound',
                content: '**Add Moderator**: <@999999999999999999>'
            };

            mockGuild.members.fetch.mockRejectedValue(new Error('Member not found'));

            const result = await processor.processModeratorAction(proposal, mockGuild);

            expect(result).toBe(false);
            expect(mockMember.roles.add).not.toHaveBeenCalled();
        });

        it('should return false when moderator role is not found', async () => {
            const proposal = {
                message_id: 'test_message_norole',
                content: '**Add Moderator**: <@987654321098765432>'
            };

            // Clear the role cache so role is not found
            mockRoleCache.clear();

            const result = await processor.processModeratorAction(proposal, mockGuild);

            expect(result).toBe(false);
            expect(mockMember.roles.add).not.toHaveBeenCalled();
        });

        it('should handle Discord API errors gracefully', async () => {
            const proposal = {
                message_id: 'test_message_error',
                content: '**Add Moderator**: <@987654321098765432>'
            };

            mockMemberCache.has = jest.fn().mockReturnValue(false);
            mockMember.roles.add.mockRejectedValue(new Error('Discord API Error'));

            const result = await processor.processModeratorAction(proposal, mockGuild);

            expect(result).toBe(false);
        });
    });

    describe('getActionSummary', () => {
        it('should return correct summary for add moderator action', () => {
            const content = '**Add Moderator**: <@123456789012345678>';
            const result = processor.getActionSummary(content);
            
            expect(result).toBe('Add <@123456789012345678> as moderator');
        });

        it('should return correct summary for remove moderator action', () => {
            const content = '**Remove Moderator**: <@987654321098765432>';
            const result = processor.getActionSummary(content);
            
            expect(result).toBe('Remove <@987654321098765432> from moderator role');
        });

        it('should return unknown action for invalid content', () => {
            const content = 'Invalid proposal content';
            const result = processor.getActionSummary(content);
            
            expect(result).toBe('Unknown moderator action');
        });

        it('should handle various mention formats in summary', () => {
            const content1 = '**Add Moderator**: 123456789012345678';
            const content2 = '**Remove Moderator**: <@!987654321098765432>';
            
            expect(processor.getActionSummary(content1)).toBe('Add 123456789012345678 as moderator');
            expect(processor.getActionSummary(content2)).toBe('Remove <@!987654321098765432> from moderator role');
        });
    });
});