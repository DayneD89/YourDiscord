// Test AWS SDK v3 migration for DynamoProposalStorage
// This is a focused test to verify the AWS SDK v3 migration works correctly

// Mock AWS SDK v3 clients
const mockSend = jest.fn();
const mockDynamoDBClientSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: mockDynamoDBClientSend
  })),
  DescribeTableCommand: jest.fn()
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: mockSend
    })
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  QueryCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn()
}));

const DynamoProposalStorage = require('../../src/DynamoProposalStorage');
const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

describe('DynamoProposalStorage AWS SDK v3 Migration', () => {
  let storage;
  const mockTableName = 'test-proposals-table';
  const mockGuildId = '123456789012345678';

  beforeEach(() => {
    storage = new DynamoProposalStorage();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize AWS SDK v3 clients', () => {
      expect(storage.tableName).toBeNull();
      expect(storage.guildId).toBeNull();
      expect(storage.dynamodb).toBeDefined();
      expect(storage.dynamodbClient).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should initialize with AWS SDK v3 DescribeTableCommand', async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });

      await storage.initialize(mockTableName, mockGuildId);

      expect(storage.tableName).toBe(mockTableName);
      expect(storage.guildId).toBe(mockGuildId);
      expect(mockDynamoDBClientSend).toHaveBeenCalled();
      expect(DescribeTableCommand).toHaveBeenCalledWith({ TableName: mockTableName });
    });

    it('should handle DescribeTable errors', async () => {
      const error = new Error('Table not found');
      mockDynamoDBClientSend.mockRejectedValue(error);

      await expect(storage.initialize(mockTableName, mockGuildId))
        .rejects.toThrow('Cannot access DynamoDB table test-proposals-table: Table not found');
    });

    it('should use environment variable for table name if not provided', async () => {
      process.env.DYNAMODB_PROPOSALS_TABLE = 'env-table-name';
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: 'env-table-name' } });

      await storage.initialize(null, mockGuildId);

      expect(storage.tableName).toBe('env-table-name');
      delete process.env.DYNAMODB_PROPOSALS_TABLE;
    });
  });

  describe('addProposal', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should use AWS SDK v3 PutCommand', async () => {
      const messageId = 'msg123';
      const proposalData = {
        content: 'Test proposal',
        status: 'voting',
        author_id: 'user123'
      };

      mockSend.mockResolvedValue({});

      await storage.addProposal(messageId, proposalData);

      expect(mockSend).toHaveBeenCalled();
      expect(PutCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        Item: expect.objectContaining({
          guild_id: mockGuildId,
          message_id: messageId,
          content: 'Test proposal',
          status: 'voting',
          author_id: 'user123'
        }),
        ConditionExpression: 'attribute_not_exists(message_id)'
      });
    });

    it('should handle ConditionalCheckFailedException', async () => {
      const messageId = 'msg123';
      const proposalData = { content: 'Test proposal' };

      const conditionalError = new Error('ConditionalCheckFailedException');
      conditionalError.code = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(conditionalError);

      await expect(storage.addProposal(messageId, proposalData))
        .rejects.toThrow('Proposal msg123 already exists');
    });

    it('should re-throw other DynamoDB errors', async () => {
      const messageId = 'msg123';
      const proposalData = { content: 'Test proposal' };

      const dbError = new Error('DynamoDB service error');
      mockSend.mockRejectedValue(dbError);

      await expect(storage.addProposal(messageId, proposalData))
        .rejects.toThrow('DynamoDB service error');
    });
  });

  describe('getProposal', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should use AWS SDK v3 GetCommand', async () => {
      const messageId = 'msg123';
      const mockProposal = { 
        guild_id: mockGuildId, 
        message_id: messageId, 
        content: 'Test proposal' 
      };
      
      mockSend.mockResolvedValue({ Item: mockProposal });

      const result = await storage.getProposal(messageId);

      expect(result).toEqual(mockProposal);
      expect(mockSend).toHaveBeenCalled();
      expect(GetCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        Key: {
          guild_id: mockGuildId,
          message_id: messageId
        }
      });
    });

    it('should return null when proposal not found', async () => {
      const messageId = 'msg123';
      
      mockSend.mockResolvedValue({}); // No Item property

      const result = await storage.getProposal(messageId);

      expect(result).toBeNull();
    });

    it('should return null on DynamoDB errors', async () => {
      const messageId = 'msg123';

      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await storage.getProposal(messageId);

      expect(result).toBeNull();
    });
  });

  describe('getAllProposals', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should use AWS SDK v3 QueryCommand', async () => {
      const mockProposals = [
        { guild_id: mockGuildId, message_id: 'msg1', content: 'Proposal 1' },
        { guild_id: mockGuildId, message_id: 'msg2', content: 'Proposal 2' }
      ];
      
      mockSend.mockResolvedValue({ Items: mockProposals });

      const result = await storage.getAllProposals();

      expect(result).toEqual(mockProposals);
      expect(mockSend).toHaveBeenCalled();
      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        KeyConditionExpression: 'guild_id = :guildId',
        ExpressionAttributeValues: {
          ':guildId': mockGuildId
        }
      });
    });

    it('should return empty array on DynamoDB errors', async () => {
      mockSend.mockRejectedValue(new Error('DynamoDB error'));

      const result = await storage.getAllProposals();

      expect(result).toEqual([]);
    });
  });

  describe('updateProposal', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should use AWS SDK v3 UpdateCommand', async () => {
      const messageId = 'msg123';
      const updates = { status: 'completed', votes: 10 };
      
      mockSend.mockResolvedValue({});

      await storage.updateProposal(messageId, updates);

      expect(mockSend).toHaveBeenCalled();
      expect(UpdateCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        Key: {
          guild_id: mockGuildId,
          message_id: messageId
        },
        UpdateExpression: expect.stringContaining('SET'),
        ExpressionAttributeNames: expect.any(Object),
        ExpressionAttributeValues: expect.any(Object),
        ConditionExpression: 'attribute_exists(message_id)'
      });
    });

    it('should handle ConditionalCheckFailedException in update', async () => {
      const messageId = 'msg123';
      const updates = { status: 'completed' };

      const conditionalError = new Error('ConditionalCheckFailedException');
      conditionalError.code = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(conditionalError);

      await expect(storage.updateProposal(messageId, updates))
        .rejects.toThrow('Proposal msg123 not found');
    });

    it('should re-throw other update errors', async () => {
      const messageId = 'msg123';
      const updates = { status: 'completed' };

      const dbError = new Error('Update failed');
      mockSend.mockRejectedValue(dbError);

      await expect(storage.updateProposal(messageId, updates))
        .rejects.toThrow('Update failed');
    });
  });

  describe('deleteProposal', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should use AWS SDK v3 DeleteCommand', async () => {
      const messageId = 'msg123';
      
      mockSend.mockResolvedValue({});

      await storage.deleteProposal(messageId);

      expect(mockSend).toHaveBeenCalled();
      expect(DeleteCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        Key: {
          guild_id: mockGuildId,
          message_id: messageId
        },
        ConditionExpression: 'attribute_exists(message_id)'
      });
    });

    it('should handle ConditionalCheckFailedException in delete', async () => {
      const messageId = 'msg123';

      const conditionalError = new Error('ConditionalCheckFailedException');
      conditionalError.code = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValue(conditionalError);

      await expect(storage.deleteProposal(messageId))
        .rejects.toThrow('Proposal msg123 not found');
    });

    it('should re-throw other delete errors', async () => {
      const messageId = 'msg123';

      const dbError = new Error('Delete failed');
      mockSend.mockRejectedValue(dbError);

      await expect(storage.deleteProposal(messageId))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('getActiveVotes', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should retrieve active voting proposals', async () => {
      const mockActiveVotes = [
        { guild_id: mockGuildId, message_id: 'msg1', status: 'voting' },
        { guild_id: mockGuildId, message_id: 'msg2', status: 'voting' }
      ];
      
      mockSend.mockResolvedValue({ Items: mockActiveVotes });

      const result = await storage.getActiveVotes();

      expect(result).toEqual(mockActiveVotes);
      expect(mockSend).toHaveBeenCalled();
      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        IndexName: 'status-index',
        KeyConditionExpression: 'guild_id = :guildId AND #status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':guildId': mockGuildId,
          ':status': 'voting'
        }
      });
    });

    it('should return empty array on getActiveVotes error', async () => {
      mockSend.mockRejectedValue(new Error('Query failed'));

      const result = await storage.getActiveVotes();

      expect(result).toEqual([]);
    });
  });

  describe('getProposalsByType', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should retrieve proposals by type', async () => {
      const proposalType = 'policy';
      const mockProposals = [
        { guild_id: mockGuildId, message_id: 'msg1', proposal_type: 'policy' }
      ];
      
      mockSend.mockResolvedValue({ Items: mockProposals });

      const result = await storage.getProposalsByType(proposalType);

      expect(result).toEqual(mockProposals);
      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        IndexName: 'type-index',
        KeyConditionExpression: 'guild_id = :guildId AND proposal_type = :type',
        ExpressionAttributeValues: {
          ':guildId': mockGuildId,
          ':type': proposalType
        }
      });
    });

    it('should return empty array on error', async () => {
      mockSend.mockRejectedValue(new Error('Query failed'));

      const result = await storage.getProposalsByType('policy');

      expect(result).toEqual([]);
    });
  });

  describe('getExpiringVotes', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should retrieve expiring votes before specified time', async () => {
      const beforeTime = '2025-08-18T12:00:00Z';
      const mockExpiringVotes = [
        { 
          guild_id: mockGuildId, 
          message_id: 'msg1', 
          status: 'voting',
          end_time: '2025-08-18T11:30:00Z'
        },
        { 
          guild_id: mockGuildId, 
          message_id: 'msg2', 
          status: 'voting',
          end_time: '2025-08-18T11:45:00Z'
        }
      ];
      
      mockSend.mockResolvedValue({ Items: mockExpiringVotes });

      const result = await storage.getExpiringVotes(beforeTime);

      expect(result).toEqual(mockExpiringVotes);
      expect(mockSend).toHaveBeenCalled();
      expect(QueryCommand).toHaveBeenCalledWith({
        TableName: mockTableName,
        IndexName: 'end-time-index',
        KeyConditionExpression: 'guild_id = :guildId AND end_time <= :endTime',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':guildId': mockGuildId,
          ':endTime': beforeTime,
          ':status': 'voting'
        }
      });
    });

    it('should return empty array on getExpiringVotes error', async () => {
      const beforeTime = '2025-08-18T12:00:00Z';
      mockSend.mockRejectedValue(new Error('Query failed'));

      const result = await storage.getExpiringVotes(beforeTime);

      expect(result).toEqual([]);
    });
  });

  describe('getProposalStats', () => {
    beforeEach(async () => {
      mockDynamoDBClientSend.mockResolvedValue({ Table: { TableName: mockTableName } });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should calculate and return proposal statistics', async () => {
      const mockAllProposals = [
        { 
          guild_id: mockGuildId, 
          message_id: 'msg1', 
          status: 'voting',
          proposal_type: 'policy'
        },
        { 
          guild_id: mockGuildId, 
          message_id: 'msg2', 
          status: 'passed',
          proposal_type: 'policy'
        },
        { 
          guild_id: mockGuildId, 
          message_id: 'msg3', 
          status: 'failed',
          proposal_type: 'governance'
        },
        { 
          guild_id: mockGuildId, 
          message_id: 'msg4', 
          status: 'voting',
          proposal_type: 'governance'
        }
      ];
      
      mockSend.mockResolvedValue({ Items: mockAllProposals });

      const result = await storage.getProposalStats();

      expect(result).toEqual({
        total: 4,
        active: 2,
        passed: 1,
        failed: 1,
        byType: {
          policy: 2,
          governance: 2
        }
      });
    });

    it('should handle proposals with no type', async () => {
      const mockAllProposals = [
        { 
          guild_id: mockGuildId, 
          message_id: 'msg1', 
          status: 'voting'
          // No proposal_type field
        }
      ];
      
      mockSend.mockResolvedValue({ Items: mockAllProposals });

      const result = await storage.getProposalStats();

      expect(result).toEqual({
        total: 1,
        active: 1,
        passed: 0,
        failed: 0,
        byType: {
          unknown: 1
        }
      });
    });

    it('should return default stats on error', async () => {
      mockSend.mockRejectedValue(new Error('Query failed'));

      const result = await storage.getProposalStats();

      expect(result).toEqual({
        total: 0,
        active: 0,
        passed: 0,
        failed: 0,
        byType: {}
      });
    });
  });
});