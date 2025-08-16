const WithdrawalProcessor = require('../../src/WithdrawalProcessor');

describe('WithdrawalProcessor', () => {
  let withdrawalProcessor;
  let mockBot;
  let mockGuild;
  let mockChannel;
  let mockMessage;

  beforeEach(() => {
    // Mock message
    mockMessage = {
      id: 'resolution123',
      content: 'RESOLUTION PASSED: Test resolution content for withdrawal testing'
    };

    // Mock channel
    mockChannel = {
      id: 'resolutions123',
      messages: {
        fetch: jest.fn().mockResolvedValue(new Map([
          ['resolution123', mockMessage]
        ]))
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

    const mockProposalConfig = {
      policy: {
        resolutionsChannelId: 'resolutions123',
        supportThreshold: 5
      }
    };

    withdrawalProcessor = new WithdrawalProcessor(mockBot, mockProposalConfig);
  });

  describe('constructor', () => {
    it('should initialize with bot and proposal config', () => {
      expect(withdrawalProcessor.bot).toBe(mockBot);
      expect(withdrawalProcessor.proposalConfig).toBeDefined();
    });
  });

  describe('parseWithdrawalTarget', () => {
    const mockConfig = {
      resolutionsChannelId: 'resolutions123'
    };

    it('should find matching resolution for valid withdrawal request', async () => {
      const withdrawalContent = '**Withdraw**: Test resolution content';
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        withdrawalContent, 
        'policy', 
        mockConfig
      );

      expect(result).toBeDefined();
      expect(result.messageId).toBe('resolution123');
      expect(result.channelId).toBe('resolutions123');
      expect(result.content).toBe('RESOLUTION PASSED: Test resolution content for withdrawal testing');
    });

    it('should return null for content without withdrawal format', async () => {
      const invalidContent = 'This is not a withdrawal request';
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        invalidContent, 
        'policy', 
        mockConfig
      );

      expect(result).toBeNull();
    });

    it('should return null when resolutions channel not found', async () => {
      mockGuild.channels.cache.get.mockReturnValue(null);
      const withdrawalContent = '**Withdraw**: Test resolution content';
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        withdrawalContent, 
        'policy', 
        mockConfig
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Resolutions channel resolutions123 not found')
      );
      
      consoleSpy.mockRestore();
    });

    it('should return null when no matching resolution found', async () => {
      const withdrawalContent = '**Withdraw**: Non-existent resolution';
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        withdrawalContent, 
        'policy', 
        mockConfig
      );

      expect(result).toBeNull();
    });

    it('should handle channel fetch errors gracefully', async () => {
      mockChannel.messages.fetch.mockRejectedValue(new Error('Fetch failed'));
      const withdrawalContent = '**Withdraw**: Test resolution';
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        withdrawalContent, 
        'policy', 
        mockConfig
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error parsing withdrawal target:', expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should skip non-resolution messages', async () => {
      const nonResolutionMessage = {
        id: 'msg456',
        content: 'This is not a resolution message'
      };
      
      mockChannel.messages.fetch.mockResolvedValue(new Map([
        ['msg456', nonResolutionMessage]
      ]));
      
      const withdrawalContent = '**Withdraw**: Test resolution';
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        withdrawalContent, 
        'policy', 
        mockConfig
      );

      expect(result).toBeNull();
    });
  });

  describe('isMatchingResolution', () => {
    it('should match exact resolution content', () => {
      const resolutionContent = 'RESOLUTION PASSED: Implement new bot features';
      const withdrawalRequest = 'Implement new bot features';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should match partial resolution content', () => {
      const resolutionContent = 'RESOLUTION PASSED: Long detailed resolution about implementing new bot features for the community';
      const withdrawalRequest = 'new bot features';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should be case insensitive', () => {
      const resolutionContent = 'RESOLUTION PASSED: Implement New Bot Features';
      const withdrawalRequest = 'implement new bot features';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should handle discord link format', () => {
      const resolutionContent = 'RESOLUTION PASSED: Implement new bot features';
      const withdrawalRequest = 'https://discord.com/channels/123/456/789 Implement new bot features';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should not match unrelated content', () => {
      const resolutionContent = 'RESOLUTION PASSED: Implement new bot features';
      const withdrawalRequest = 'completely different content';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(false);
    });

    it('should handle special characters and punctuation', () => {
      const resolutionContent = 'RESOLUTION PASSED: Update server rules & guidelines';
      const withdrawalRequest = 'Update server rules and guidelines';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should match using policy extraction strategy', () => {
      const resolutionContent = 'RESOLUTION PASSED: **Policy**: Implement new moderation rules for community safety';
      const withdrawalRequest = 'moderation rules';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should match using governance extraction strategy', () => {
      const resolutionContent = 'RESOLUTION PASSED: **Governance**: Change voting duration to 48 hours';
      const withdrawalRequest = 'voting duration';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should match using keyword overlap strategy', () => {
      const resolutionContent = 'RESOLUTION PASSED: Establish community guidelines for respectful discourse and collaboration';
      const withdrawalRequest = 'community guidelines respectful discourse';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should reject matches below 60% keyword overlap threshold', () => {
      const resolutionContent = 'RESOLUTION PASSED: Implement new bot features';
      const withdrawalRequest = 'completely different unrelated content policy';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(false);
    });

    it('should handle reverse policy matching', () => {
      const resolutionContent = 'RESOLUTION PASSED: **Policy**: Short policy text';
      const withdrawalRequest = 'This is a longer withdrawal request that contains the short policy text mentioned here';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should filter out short words in keyword matching', () => {
      const resolutionContent = 'RESOLUTION PASSED: The new bot will help with moderation tasks';
      const withdrawalRequest = 'bot moderation tasks';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      expect(result).toBe(true);
    });

    it('should handle empty withdrawal request', () => {
      const resolutionContent = 'RESOLUTION PASSED: Some policy content';
      const withdrawalRequest = '';
      
      const result = withdrawalProcessor.isMatchingResolution(resolutionContent, withdrawalRequest);
      
      // Empty string is included in any string, so this returns true
      expect(result).toBe(true);
    });
  });

  describe('processWithdrawal', () => {
    let mockProposal;
    let mockNotificationChannel;

    beforeEach(() => {
      mockProposal = {
        proposalType: 'policy',
        authorId: 'author123',
        completedAt: new Date().toISOString(),
        finalYes: 6,
        finalNo: 2,
        content: '**Withdraw**: Test policy resolution',
        targetResolution: {
          messageId: 'resolution123',
          channelId: 'resolutions123',
          content: 'RESOLUTION PASSED: Test resolution content',
          originalContent: 'Test policy content'
        }
      };

      mockNotificationChannel = {
        id: 'resolutions123',
        send: jest.fn().mockResolvedValue(undefined)
      };
    });

    it('should successfully process withdrawal', async () => {
      const mockTargetMessage = {
        delete: jest.fn().mockResolvedValue()
      };
      
      mockChannel.messages = {
        fetch: jest.fn().mockResolvedValue(mockTargetMessage)
      };

      // Mock the same channel for both operations since they use the same channel ID
      mockGuild.channels.cache.get.mockReturnValue(mockNotificationChannel);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await withdrawalProcessor.processWithdrawal(mockProposal, mockGuild);

      expect(mockNotificationChannel.send).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Withdrawal notification posted to resolutions123'
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle missing target resolution gracefully', async () => {
      const proposalWithoutTarget = {};
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await withdrawalProcessor.processWithdrawal(proposalWithoutTarget, mockGuild);

      expect(consoleSpy).toHaveBeenCalledWith(
        'No target resolution found for withdrawal'
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle message deletion errors gracefully', async () => {
      const mockTargetMessage = {
        delete: jest.fn().mockRejectedValue(new Error('Delete failed'))
      };
      
      mockChannel.messages = {
        fetch: jest.fn().mockResolvedValue(mockTargetMessage)
      };

      mockGuild.channels.cache.get.mockReturnValue(mockNotificationChannel);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await withdrawalProcessor.processWithdrawal(mockProposal, mockGuild);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not delete target resolution:', expect.any(Error)
      );
      // Should still post notification despite deletion failure
      expect(mockNotificationChannel.send).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle message fetch errors gracefully', async () => {
      mockChannel.messages = {
        fetch: jest.fn().mockRejectedValue(new Error('Message not found'))
      };

      mockGuild.channels.cache.get.mockReturnValue(mockNotificationChannel);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await withdrawalProcessor.processWithdrawal(mockProposal, mockGuild);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Could not delete target resolution:', expect.any(Error)
      );
      // Should still post notification despite fetch failure
      expect(mockNotificationChannel.send).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should post withdrawal notification with correct content', async () => {
      mockGuild.channels.cache.get.mockReturnValue(mockNotificationChannel);
      
      await withdrawalProcessor.processWithdrawal(mockProposal, mockGuild);

      expect(mockNotificationChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('🗑️ **WITHDRAWN POLICY RESOLUTION**')
      );
      expect(mockNotificationChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('<@author123>')
      );
      expect(mockNotificationChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('✅ 6 - ❌ 2')
      );
      expect(mockNotificationChannel.send).toHaveBeenCalledWith(
        expect.stringContaining('Test policy content')
      );
    });

    it('should handle general processing errors', async () => {
      // Simulate error by making guild undefined
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await withdrawalProcessor.processWithdrawal(mockProposal, null);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error processing withdrawal:', expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('extractOriginalResolution', () => {
    it('should extract resolution content correctly', () => {
      const resolutionContent = '**Resolution:** This is the policy content\n**Author:** test';
      
      const result = withdrawalProcessor.extractOriginalResolution(resolutionContent);
      
      expect(result).toBe('This is the policy content');
    });

    it('should handle multiline resolution content', () => {
      const resolutionContent = '**Resolution:** Multi-line policy\ncontent here\n**Status:** Active';
      
      const result = withdrawalProcessor.extractOriginalResolution(resolutionContent);
      
      expect(result).toBe('Multi-line policy\ncontent here');
    });

    it('should return full content as fallback', () => {
      const resolutionContent = 'No standard format here';
      
      const result = withdrawalProcessor.extractOriginalResolution(resolutionContent);
      
      expect(result).toBe('No standard format here');
    });

    it('should handle empty resolution content', () => {
      const resolutionContent = '';
      
      const result = withdrawalProcessor.extractOriginalResolution(resolutionContent);
      
      expect(result).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle empty withdrawal content', async () => {
      const withdrawalContent = '**Withdraw**: ';
      const mockConfig = { resolutionsChannelId: 'resolutions123' };
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        withdrawalContent, 
        'policy', 
        mockConfig
      );

      // Empty withdrawal content will still find matches since empty string matches anything
      expect(result).not.toBeNull();
      expect(result.messageId).toBe('resolution123');
    });

    it('should handle malformed withdrawal format', async () => {
      const withdrawalContent = 'Withdraw: Missing asterisks';
      const mockConfig = { resolutionsChannelId: 'resolutions123' };
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        withdrawalContent, 
        'policy', 
        mockConfig
      );

      expect(result).toBeNull();
    });

    it('should handle empty resolutions channel', async () => {
      mockChannel.messages.fetch.mockResolvedValue(new Map());
      
      const withdrawalContent = '**Withdraw**: Test resolution';
      const mockConfig = { resolutionsChannelId: 'resolutions123' };
      
      const result = await withdrawalProcessor.parseWithdrawalTarget(
        withdrawalContent, 
        'policy', 
        mockConfig
      );

      expect(result).toBeNull();
    });
  });
});