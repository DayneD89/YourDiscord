const ActionExecutor = require('../../src/ActionExecutor');
const MockBot = require('../helpers/mockBot');
const { MockMember, MockGuild } = require('../helpers/mockDiscord');

describe('ActionExecutor', () => {
  let actionExecutor;
  let mockBot;
  let mockMember;
  let mockGuild;

  beforeEach(() => {
    mockBot = new MockBot();
    actionExecutor = new ActionExecutor(mockBot);
    
    mockMember = new MockMember();
    mockGuild = new MockGuild();
    
    // Mock roles in guild
    const mockRole = {
      id: '123456789012345681',
      name: 'TestRole'
    };
    const memberRole = {
      id: mockBot.getMemberRoleId(),
      name: 'member'
    };
    
    mockGuild.roles.cache.set(mockRole.id, mockRole);
    mockGuild.roles.cache.set(memberRole.id, memberRole);
  });

  describe('executeAction', () => {
    it('should execute AddRole action successfully', async () => {
      const action = "AddRole(user_id,'TestRole')";
      
      mockBot.userValidator.canAct.mockReturnValue({ canAct: true });
      
      await actionExecutor.executeAction(action, mockMember, mockGuild);

      expect(mockMember.roles.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestRole' })
      );
    });

    it('should execute RemoveRole action successfully', async () => {
      const action = "RemoveRole(user_id,'TestRole')";
      
      mockBot.userValidator.canAct.mockReturnValue({ canAct: true });
      mockMember.roles.cache.set('123456789012345681', {});
      
      await actionExecutor.executeAction(action, mockMember, mockGuild);

      expect(mockMember.roles.remove).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestRole' })
      );
    });

    it('should handle unknown action gracefully', async () => {
      const action = "UnknownAction(user_id,'TestRole')";
      
      await actionExecutor.executeAction(action, mockMember, mockGuild);

      expect(mockMember.roles.add).not.toHaveBeenCalled();
      expect(mockMember.roles.remove).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const action = "AddRole(user_id,'TestRole')";
      
      mockBot.userValidator.canAct.mockImplementation(() => {
        throw new Error('Validation error');
      });
      
      await actionExecutor.executeAction(action, mockMember, mockGuild);

      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });
  });

  describe('executeAddRole', () => {
    it('should add role when user is eligible', async () => {
      mockBot.userValidator.canAct.mockReturnValue({ canAct: true });
      
      await actionExecutor.executeAddRole('TestRole', mockMember, mockGuild);

      expect(mockMember.roles.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestRole' })
      );
    });

    it('should not add role when user is not eligible', async () => {
      mockBot.userValidator.canAct.mockReturnValue({ 
        canAct: false, 
        reason: 'User is timed out' 
      });
      
      await actionExecutor.executeAddRole('TestRole', mockMember, mockGuild);

      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('should add member role without eligibility check', async () => {
      // Don't set up canAct mock - should not be called for member role
      
      await actionExecutor.executeAddRole('member', mockMember, mockGuild);

      expect(mockBot.userValidator.canAct).not.toHaveBeenCalled();
      expect(mockMember.roles.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'member' })
      );
    });

    it('should not add role if user already has it', async () => {
      mockBot.userValidator.canAct.mockReturnValue({ canAct: true });
      mockMember.roles.cache.set('123456789012345681', {});
      
      await actionExecutor.executeAddRole('TestRole', mockMember, mockGuild);

      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });

    it('should handle non-existent role gracefully', async () => {
      mockBot.userValidator.canAct.mockReturnValue({ canAct: true });
      
      await actionExecutor.executeAddRole('NonExistentRole', mockMember, mockGuild);

      expect(mockMember.roles.add).not.toHaveBeenCalled();
    });
  });

  describe('executeRemoveRole', () => {
    beforeEach(() => {
      // Set up user to have the role initially
      mockMember.roles.cache.set('123456789012345681', {});
    });

    it('should remove role when user is eligible', async () => {
      mockBot.userValidator.canAct.mockReturnValue({ canAct: true });
      
      await actionExecutor.executeRemoveRole('TestRole', mockMember, mockGuild);

      expect(mockMember.roles.remove).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestRole' })
      );
    });

    it('should not remove role when user is not eligible', async () => {
      mockBot.userValidator.canAct.mockReturnValue({ 
        canAct: false, 
        reason: 'User is not a member' 
      });
      
      await actionExecutor.executeRemoveRole('TestRole', mockMember, mockGuild);

      expect(mockMember.roles.remove).not.toHaveBeenCalled();
    });

    it('should remove member role without eligibility check', async () => {
      mockMember.roles.cache.set(mockBot.getMemberRoleId(), {});
      
      await actionExecutor.executeRemoveRole('member', mockMember, mockGuild);

      expect(mockBot.userValidator.canAct).not.toHaveBeenCalled();
      expect(mockMember.roles.remove).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'member' })
      );
    });

    it('should not remove role if user does not have it', async () => {
      mockBot.userValidator.canAct.mockReturnValue({ canAct: true });
      mockMember.roles.cache.clear(); // Remove all roles
      
      await actionExecutor.executeRemoveRole('TestRole', mockMember, mockGuild);

      expect(mockMember.roles.remove).not.toHaveBeenCalled();
    });

    it('should handle non-existent role gracefully', async () => {
      mockBot.userValidator.canAct.mockReturnValue({ canAct: true });
      
      await actionExecutor.executeRemoveRole('NonExistentRole', mockMember, mockGuild);

      expect(mockMember.roles.remove).not.toHaveBeenCalled();
    });
  });

  describe('findRole', () => {
    it('should find role by name', () => {
      const role = actionExecutor.findRole('TestRole', mockGuild);
      
      expect(role).toBeDefined();
      expect(role.name).toBe('TestRole');
    });

    it('should find member role by ID when requested', () => {
      const role = actionExecutor.findRole('member', mockGuild);
      
      expect(role).toBeDefined();
      expect(role.id).toBe(mockBot.getMemberRoleId());
    });

    it('should return undefined for non-existent role', () => {
      const role = actionExecutor.findRole('NonExistentRole', mockGuild);
      
      expect(role).toBeUndefined();
    });

    it('should prioritize ID lookup for member role over name lookup', () => {
      // Add a role with name "member" but different ID
      const fakeRole = { id: 'fake-id', name: 'member' };
      mockGuild.roles.cache.set(fakeRole.id, fakeRole);
      
      const role = actionExecutor.findRole('member', mockGuild);
      
      // Should return the role with the configured member ID, not the one with name "member"
      expect(role.id).toBe(mockBot.getMemberRoleId());
    });
  });
});