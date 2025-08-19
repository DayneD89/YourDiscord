const EventValidator = require('../../src/validators/EventValidator');

describe('EventValidator', () => {
  let eventValidator;
  let mockBot;

  beforeEach(() => {
    mockBot = {
      getBotId: jest.fn()
    };
    eventValidator = new EventValidator(mockBot);
  });

  describe('constructor', () => {
    it('should initialize with bot reference', () => {
      expect(eventValidator.bot).toBe(mockBot);
    });
  });

  describe('validateEventData', () => {
    it('should return error if event name is missing', () => {
      const eventData = {
        region: 'London',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateEventData(eventData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event name is required');
    });

    it('should return error if event name is empty string', () => {
      const eventData = {
        name: '   ',
        region: 'London',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateEventData(eventData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event name is required');
    });

    it('should return error if region is missing', () => {
      const eventData = {
        name: 'Test Event',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateEventData(eventData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Region is required');
    });

    it('should return error if region is empty string', () => {
      const eventData = {
        name: 'Test Event',
        region: '   ',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateEventData(eventData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Region is required');
    });

    it('should return error if event date is missing', () => {
      const eventData = {
        name: 'Test Event',
        region: 'London'
      };

      const result = eventValidator.validateEventData(eventData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event date is required');
    });

    it('should return error if event name is too long', () => {
      const eventData = {
        name: 'A'.repeat(101), // 101 characters
        region: 'London',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateEventData(eventData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event name must be 100 characters or less');
    });

    it('should return error if event date is invalid', () => {
      const eventData = {
        name: 'Test Event',
        region: 'London',
        eventDate: 'invalid-date'
      };

      // Mock validateEventDate to return invalid
      jest.spyOn(eventValidator, 'validateEventDate').mockReturnValue({
        valid: false,
        error: 'Invalid date format'
      });

      const result = eventValidator.validateEventData(eventData);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });

    it('should return valid for correct event data', () => {
      const eventData = {
        name: 'Test Event',
        region: 'London',
        eventDate: '2025-12-25 10:00'
      };

      // Mock validateEventDate to return valid
      jest.spyOn(eventValidator, 'validateEventDate').mockReturnValue({
        valid: true
      });

      const result = eventValidator.validateEventData(eventData);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateEventDate', () => {
    it('should return error for invalid date format', () => {
      const result = eventValidator.validateEventDate('invalid-date');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date format. Use YYYY-MM-DD HH:MM');
    });

    it('should return error for date without time', () => {
      const result = eventValidator.validateEventDate('2025-12-25');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date format. Use YYYY-MM-DD HH:MM');
    });

    it('should return error for invalid date values', () => {
      const result = eventValidator.validateEventDate('2025-13-99 25:75');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date. Please check the date and time are correct');
    });

    it('should return error for dates in the past', () => {
      const pastDate = '2020-01-01 10:00';
      const result = eventValidator.validateEventDate(pastDate);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Event date must be at least 5 minutes in the future');
    });

    it('should return valid for future dates in correct format', () => {
      const futureDate = '2025-12-25 10:00';
      const result = eventValidator.validateEventDate(futureDate);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle dates with single digit hours', () => {
      const futureDate = '2025-12-25 9:00';
      const result = eventValidator.validateEventDate(futureDate);

      expect(result.valid).toBe(true);
    });

    it('should handle timezone conversion correctly', () => {
      // Test that dates are properly converted to UK time
      const futureDate = '2025-09-15 14:30'; // Far enough future date
      const result = eventValidator.validateEventDate(futureDate);

      expect(result.valid).toBe(true);
    });

    it('should handle error gracefully', () => {
      // Mock Date constructor to throw error by passing completely invalid input
      const result = eventValidator.validateEventDate(null);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date format. Use YYYY-MM-DD HH:MM');
    });

    it('should return error for dates too far in the future', () => {
      // Create a date more than 1 year in the future
      const farFutureDate = new Date();
      farFutureDate.setFullYear(farFutureDate.getFullYear() + 2);
      const farFutureDateStr = farFutureDate.toISOString().substring(0, 16).replace('T', ' ');

      const result = eventValidator.validateEventDate(farFutureDateStr);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event date cannot be more than 1 year in the future');
    });
  });

  describe('findRoleByName', () => {
    let mockGuild;

    beforeEach(() => {
      mockGuild = {
        roles: {
          cache: new Map([
            ['role1', { name: 'London', id: 'role1' }],
            ['role2', { name: 'manchester', id: 'role2' }],
            ['role3', { name: 'North East', id: 'role3' }]
          ])
        }
      };
      
      // Mock find method
      mockGuild.roles.cache.find = jest.fn((predicate) => {
        for (const role of mockGuild.roles.cache.values()) {
          if (predicate(role)) return role;
        }
        return undefined;
      });
    });

    it('should find role by exact name match', () => {
      const role = eventValidator.findRoleByName(mockGuild, 'London');
      expect(role).toEqual({ name: 'London', id: 'role1' });
    });

    it('should find role by case-insensitive match', () => {
      const role = eventValidator.findRoleByName(mockGuild, 'LONDON');
      expect(role).toEqual({ name: 'London', id: 'role1' });
    });

    it('should find role with lowercase input', () => {
      const role = eventValidator.findRoleByName(mockGuild, 'manchester');
      expect(role).toEqual({ name: 'manchester', id: 'role2' });
    });

    it('should return null for non-existent role', () => {
      const role = eventValidator.findRoleByName(mockGuild, 'NonExistentRole');
      expect(role).toBe(undefined);
    });

    it('should return null for null guild', () => {
      const role = eventValidator.findRoleByName(null, 'London');
      expect(role).toBe(null);
    });

    it('should return null for null role name', () => {
      const role = eventValidator.findRoleByName(mockGuild, null);
      expect(role).toBe(null);
    });

    it('should return null for undefined role name', () => {
      const role = eventValidator.findRoleByName(mockGuild, undefined);
      expect(role).toBe(null);
    });
  });

  describe('validateRole', () => {
    let mockGuild;

    beforeEach(() => {
      mockGuild = {
        roles: {
          cache: new Map([
            ['role1', { name: 'London', id: 'role1' }]
          ])
        }
      };
      
      mockGuild.roles.cache.find = jest.fn((predicate) => {
        for (const role of mockGuild.roles.cache.values()) {
          if (predicate(role)) return role;
        }
        return undefined;
      });
    });

    it('should return error if role name is not provided', () => {
      const result = eventValidator.validateRole(mockGuild, null, 'region');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('region is required');
    });

    it('should return error if role name is empty', () => {
      const result = eventValidator.validateRole(mockGuild, '', 'location');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('location is required');
    });

    it('should return error if role is not found', () => {
      const result = eventValidator.validateRole(mockGuild, 'NonExistentRole', 'region');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('region role "NonExistentRole" not found in server. Please check the role name and ensure it exists.');
    });

    it('should return valid result with role if found', () => {
      const result = eventValidator.validateRole(mockGuild, 'London', 'region');
      
      expect(result.valid).toBe(true);
      expect(result.role).toEqual({ name: 'London', id: 'role1' });
    });

    it('should use default role type', () => {
      const result = eventValidator.validateRole(mockGuild, null);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('role is required');
    });
  });

  describe('validateEventLink', () => {
    it('should return valid for null link', () => {
      const result = eventValidator.validateEventLink(null);
      
      expect(result.valid).toBe(true);
    });

    it('should return valid for undefined link', () => {
      const result = eventValidator.validateEventLink(undefined);
      
      expect(result.valid).toBe(true);
    });

    it('should return valid for empty string link', () => {
      const result = eventValidator.validateEventLink('');
      
      expect(result.valid).toBe(true);
    });

    it('should return valid for HTTP URL', () => {
      const result = eventValidator.validateEventLink('http://example.com/event');
      
      expect(result.valid).toBe(true);
    });

    it('should return valid for HTTPS URL', () => {
      const result = eventValidator.validateEventLink('https://facebook.com/events/123');
      
      expect(result.valid).toBe(true);
    });

    it('should return error for non-HTTP/HTTPS protocol', () => {
      const result = eventValidator.validateEventLink('ftp://example.com/file');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event link must be a valid HTTP or HTTPS URL');
    });

    it('should return error for invalid URL format', () => {
      const result = eventValidator.validateEventLink('not-a-url');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format for event link');
    });

    it('should return error for malformed URL', () => {
      const result = eventValidator.validateEventLink('https://');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL format for event link');
    });
  });

  describe('validateRemovalCriteria', () => {
    it('should return error if name is missing', () => {
      const criteria = {
        region: 'London',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateRemovalCriteria(criteria);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event name is required for removal');
    });

    it('should return error if region is missing', () => {
      const criteria = {
        name: 'Test Event',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateRemovalCriteria(criteria);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Region is required for removal');
    });

    it('should return error if eventDate is missing', () => {
      const criteria = {
        name: 'Test Event',
        region: 'London'
      };

      const result = eventValidator.validateRemovalCriteria(criteria);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Event date is required for removal');
    });

    it('should return valid for complete criteria', () => {
      const criteria = {
        name: 'Test Event',
        region: 'London',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateRemovalCriteria(criteria);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle optional location in criteria', () => {
      const criteria = {
        name: 'Test Event',
        region: 'London',
        location: 'Central London',
        eventDate: '2025-12-25 10:00'
      };

      const result = eventValidator.validateRemovalCriteria(criteria);

      expect(result.valid).toBe(true);
    });
  });
});