const ProposalParser = require('../../src/ProposalParser');
const { MockMessage, MockUser } = require('../helpers/mockDiscord');

describe('ProposalParser', () => {
  let parser;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      policy: {
        debateChannelId: '123456789012345683',
        voteChannelId: '123456789012345684',
        resolutionsChannelId: '123456789012345685',
        supportThreshold: 3,
        voteDuration: 86400000, // 24 hours
        formats: ['Policy', 'Administrative']
      },
      community: {
        debateChannelId: '123456789012345686',
        voteChannelId: '123456789012345687',
        resolutionsChannelId: '123456789012345688',
        supportThreshold: 5,
        voteDuration: 172800000, // 48 hours
        formats: ['Community', 'Event']
      }
    };
    
    parser = new ProposalParser(mockConfig);
  });

  describe('getProposalType', () => {
    it('should identify policy proposal with Policy format', () => {
      const content = '**Policy**: We should implement new moderation guidelines';
      const result = parser.getProposalType('123456789012345683', content);

      expect(result).toBeDefined();
      expect(result.type).toBe('policy');
      expect(result.config).toBe(mockConfig.policy);
      expect(result.isWithdrawal).toBe(false);
    });

    it('should identify policy proposal with Administrative format', () => {
      const content = '**Administrative**: Update server structure';
      const result = parser.getProposalType('123456789012345683', content);

      expect(result).toBeDefined();
      expect(result.type).toBe('policy');
      expect(result.config).toBe(mockConfig.policy);
      expect(result.isWithdrawal).toBe(false);
    });

    it('should identify community proposal', () => {
      const content = '**Community**: Host monthly gaming events';
      const result = parser.getProposalType('123456789012345686', content);

      expect(result).toBeDefined();
      expect(result.type).toBe('community');
      expect(result.config).toBe(mockConfig.community);
      expect(result.isWithdrawal).toBe(false);
    });

    it('should identify withdrawal proposal', () => {
      const content = '**Withdraw**: Previous policy about moderation';
      const result = parser.getProposalType('123456789012345683', content);

      expect(result).toBeDefined();
      expect(result.type).toBe('policy');
      expect(result.config).toBe(mockConfig.policy);
      expect(result.isWithdrawal).toBe(true);
    });

    it('should handle case insensitive formats', () => {
      const content = '**policy**: Lower case format test';
      const result = parser.getProposalType('123456789012345683', content);

      expect(result).toBeDefined();
      expect(result.type).toBe('policy');
    });

    it('should handle whitespace around content', () => {
      const content = '  **Policy**: Proposal with leading/trailing whitespace  ';
      const result = parser.getProposalType('123456789012345683', content);

      expect(result).toBeDefined();
      expect(result.type).toBe('policy');
    });

    it('should return null for wrong channel', () => {
      const content = '**Policy**: Valid format but wrong channel';
      const result = parser.getProposalType('wrong-channel-id', content);

      expect(result).toBeNull();
    });

    it('should return null for invalid format', () => {
      const content = 'Invalid format without proper markdown';
      const result = parser.getProposalType('123456789012345683', content);

      expect(result).toBeNull();
    });

    it('should return null for unsupported format in channel', () => {
      const content = '**UnsupportedFormat**: This format is not allowed';
      const result = parser.getProposalType('123456789012345683', content);

      expect(result).toBeNull();
    });

    it('should return null for empty config', () => {
      const emptyParser = new ProposalParser({});
      const content = '**Policy**: Valid format but no config';
      const result = emptyParser.getProposalType('123456789012345683', content);

      expect(result).toBeNull();
    });
  });

  describe('isValidProposalFormat', () => {
    it('should return true for valid proposal format', () => {
      const content = '**Policy**: Valid proposal content';
      const result = parser.isValidProposalFormat('123456789012345683', content);

      expect(result).toBe(true);
    });

    it('should return false for invalid proposal format', () => {
      const content = 'Invalid proposal content';
      const result = parser.isValidProposalFormat('123456789012345683', content);

      expect(result).toBe(false);
    });

    it('should return false for wrong channel', () => {
      const content = '**Policy**: Valid format but wrong channel';
      const result = parser.isValidProposalFormat('wrong-channel-id', content);

      expect(result).toBe(false);
    });
  });

  describe('createVoteMessage', () => {
    let mockMessage;
    let mockUser;

    beforeEach(() => {
      mockUser = new MockUser({ tag: 'TestUser#1234' });
      mockMessage = new MockMessage({
        author: mockUser,
        content: '**Policy**: Implement new community guidelines for better moderation'
      });
    });

    it('should create standard vote message', () => {
      const result = parser.createVoteMessage(mockMessage, 'policy', mockConfig.policy, false);

      expect(result).toContain('🗳️ **POLICY VOTING PHASE**');
      expect(result).toContain('**Proposed by:** TestUser#1234');
      expect(result).toContain('**Type:** policy');
      expect(result).toContain('**Original Proposal:**');
      expect(result).toContain(mockMessage.content);
      expect(result).toContain('✅ React with ✅ to SUPPORT this proposal');
      expect(result).toContain('❌ React with ❌ to OPPOSE this proposal');
      expect(result).toContain('**Voting ends:**');
      expect(result).toContain('React below to cast your vote!');
      expect(result).not.toContain('withdrawal');
    });

    it('should create withdrawal vote message', () => {
      mockMessage.content = '**Withdraw**: Previous policy about moderation guidelines';
      const result = parser.createVoteMessage(mockMessage, 'policy', mockConfig.policy, true);

      expect(result).toContain('🗳️ **POLICY WITHDRAWAL VOTING PHASE**');
      expect(result).toContain('**Type:** policy (withdrawal)');
      expect(result).toContain('✅ React with ✅ to SUPPORT withdrawing this resolution');
      expect(result).toContain('❌ React with ❌ to OPPOSE withdrawal (keep the resolution)');
    });

    it('should include correct timestamp for voting deadline', () => {
      const now = Date.now();
      const result = parser.createVoteMessage(mockMessage, 'policy', mockConfig.policy, false);
      
      // Extract timestamp from the message
      const timestampMatch = result.match(/<t:(\d+):F>/);
      expect(timestampMatch).toBeTruthy();
      
      const timestamp = parseInt(timestampMatch[1]) * 1000; // Convert back to milliseconds
      const expectedEnd = now + mockConfig.policy.voteDuration;
      
      // Allow for small time difference (test execution time)
      expect(timestamp).toBeGreaterThan(expectedEnd - 1000);
      expect(timestamp).toBeLessThan(expectedEnd + 1000);
    });

    it('should handle different proposal types', () => {
      const result = parser.createVoteMessage(mockMessage, 'community', mockConfig.community, false);

      expect(result).toContain('🗳️ **COMMUNITY VOTING PHASE**');
      expect(result).toContain('**Type:** community');
    });

    it('should handle long proposal content', () => {
      const longContent = '**Policy**: ' + 'A'.repeat(1000) + ' very long proposal content';
      mockMessage.content = longContent;
      
      const result = parser.createVoteMessage(mockMessage, 'policy', mockConfig.policy, false);

      expect(result).toContain(longContent);
    });
  });

  describe('extractOriginalResolution', () => {
    it('should extract resolution content from standard format', () => {
      const resolutionContent = `**PASSED POLICY RESOLUTION**

**Proposed by:** <@123456789>
**Type:** policy
**Passed on:** <t:1234567890:F>
**Final Vote:** ✅ 15 - ❌ 3

**Resolution:**
We should implement new community guidelines for better moderation and user experience.

*This resolution is now active policy.*`;

      const result = parser.extractOriginalResolution(resolutionContent);

      expect(result).toBe('We should implement new community guidelines for better moderation and user experience.');
    });

    it('should handle resolution with multiple lines', () => {
      const resolutionContent = `**Resolution:**
This is a multi-line resolution
that spans several lines
and should be extracted properly.

*This resolution is now active policy.*`;

      const result = parser.extractOriginalResolution(resolutionContent);

      expect(result).toBe(`This is a multi-line resolution
that spans several lines
and should be extracted properly.`);
    });

    it('should return full content when no resolution section found', () => {
      const resolutionContent = 'This is just plain text without resolution markers';

      const result = parser.extractOriginalResolution(resolutionContent);

      expect(result).toBe(resolutionContent);
    });

    it('should handle empty resolution content', () => {
      const resolutionContent = '**Resolution:**\n\n*This resolution is now active policy.*';

      const result = parser.extractOriginalResolution(resolutionContent);

      expect(result).toBe('*This resolution is now active policy.*');
    });

    it('should handle resolution at end of content', () => {
      const resolutionContent = `**PASSED POLICY RESOLUTION**

**Resolution:**
Final resolution content`;

      const result = parser.extractOriginalResolution(resolutionContent);

      expect(result).toBe('Final resolution content');
    });
  });
});