const UserValidator = require('../../src/validators/UserValidator');
const { MockUser, MockMember } = require('../helpers/mockDiscord');
const { PermissionFlagsBits } = require('discord.js');

describe('UserValidator', () => {
  let validator;
  const mockMemberRoleId = '123456789012345679';
  const mockModeratorRoleId = '123456789012345680';

  beforeEach(() => {
    validator = new UserValidator();
  });

  describe('canAct', () => {
    it('should allow valid member to act', () => {
      const mockUser = new MockUser({ bot: false });
      const mockMember = new MockMember({ 
        user: mockUser,
        roles: [[mockMemberRoleId, {}]]
      });
      mockMember.isCommunicationDisabled = jest.fn(() => false);

      const result = validator.canAct(mockMember, mockMemberRoleId);

      expect(result.canAct).toBe(true);
    });

    it('should deny bot users', () => {
      const mockUser = new MockUser({ bot: true });
      const mockMember = new MockMember({ 
        user: mockUser,
        roles: [[mockMemberRoleId, {}]]
      });

      const result = validator.canAct(mockMember, mockMemberRoleId);

      expect(result.canAct).toBe(false);
      expect(result.reason).toBe('User is a bot');
    });

    it('should deny users without member role', () => {
      const mockUser = new MockUser({ bot: false });
      const mockMember = new MockMember({ 
        user: mockUser,
        roles: [] // No roles
      });

      const result = validator.canAct(mockMember, mockMemberRoleId);

      expect(result.canAct).toBe(false);
      expect(result.reason).toBe('User is not a member');
    });

    it('should deny timed out users', () => {
      const mockUser = new MockUser({ bot: false });
      const mockMember = new MockMember({ 
        user: mockUser,
        roles: [[mockMemberRoleId, {}]]
      });
      mockMember.isCommunicationDisabled = jest.fn(() => true);

      const result = validator.canAct(mockMember, mockMemberRoleId);

      expect(result.canAct).toBe(false);
      expect(result.reason).toBe('User is currently timed out');
    });
  });

  describe('canUseModerator', () => {
    it('should allow user with moderator role', () => {
      const mockMember = new MockMember({ 
        roles: [[mockModeratorRoleId, {}]],
        hasPermissions: false
      });

      const result = validator.canUseModerator(mockMember, mockModeratorRoleId);

      expect(result).toBe(true);
    });

    it('should allow user with ManageRoles permission', () => {
      const mockMember = new MockMember({ 
        roles: [],
        hasPermissions: true
      });
      mockMember.permissions.has = jest.fn((permission) => 
        permission === PermissionFlagsBits.ManageRoles
      );

      const result = validator.canUseModerator(mockMember, mockModeratorRoleId);

      expect(result).toBe(true);
    });

    it('should allow user with both moderator role and permissions', () => {
      const mockMember = new MockMember({ 
        roles: [[mockModeratorRoleId, {}]],
        hasPermissions: true
      });
      mockMember.permissions.has = jest.fn((permission) => 
        permission === PermissionFlagsBits.ManageRoles
      );

      const result = validator.canUseModerator(mockMember, mockModeratorRoleId);

      expect(result).toBe(true);
    });

    it('should deny user without moderator role or permissions', () => {
      const mockMember = new MockMember({ 
        roles: [],
        hasPermissions: false
      });

      const result = validator.canUseModerator(mockMember, mockModeratorRoleId);

      expect(result).toBe(false);
    });

    it('should handle null moderator role ID', () => {
      const mockMember = new MockMember({ 
        roles: [],
        hasPermissions: false
      });

      const result = validator.canUseModerator(mockMember, null);

      expect(result).toBe(false);
    });
  });

  describe('isBot', () => {
    it('should return true for bot users', () => {
      const mockUser = new MockUser({ bot: true });

      const result = validator.isBot(mockUser);

      expect(result).toBe(true);
    });

    it('should return false for human users', () => {
      const mockUser = new MockUser({ bot: false });

      const result = validator.isBot(mockUser);

      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should return true when user has the role', () => {
      const testRoleId = '987654321098765432';
      const mockMember = new MockMember({ 
        roles: [[testRoleId, {}]]
      });

      const result = validator.hasRole(mockMember, testRoleId);

      expect(result).toBe(true);
    });

    it('should return false when user does not have the role', () => {
      const testRoleId = '987654321098765432';
      const mockMember = new MockMember({ 
        roles: []
      });

      const result = validator.hasRole(mockMember, testRoleId);

      expect(result).toBe(false);
    });

    it('should return false when user has different roles', () => {
      const testRoleId = '987654321098765432';
      const otherRoleId = '123456789012345678';
      const mockMember = new MockMember({ 
        roles: [[otherRoleId, {}]]
      });

      const result = validator.hasRole(mockMember, testRoleId);

      expect(result).toBe(false);
    });
  });
});