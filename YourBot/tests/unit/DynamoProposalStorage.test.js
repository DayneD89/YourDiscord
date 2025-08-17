const DynamoProposalStorage = require('../../src/DynamoProposalStorage');

// Mock AWS SDK DocumentClient
jest.mock('aws-sdk', () => {
  const mockDocumentClient = {
    put: jest.fn(),
    get: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    describeTable: jest.fn()
  };
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDocumentClient)
    },
    __mockDocumentClient: mockDocumentClient
  };
});

const AWS = require('aws-sdk');

describe('DynamoProposalStorage', () => {
  let storage;
  let mockDynamoDB;
  const mockTableName = 'test-proposals-table';
  const mockGuildId = '123456789012345678';

  beforeEach(() => {
    storage = new DynamoProposalStorage();
    mockDynamoDB = AWS.__mockDocumentClient;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with null table name and guild ID', () => {
      expect(storage.tableName).toBeNull();
      expect(storage.guildId).toBeNull();
      expect(storage.dynamodb).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should set table name and guild ID correctly', async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });

      await storage.initialize(mockTableName, mockGuildId);

      expect(storage.tableName).toBe(mockTableName);
      expect(storage.guildId).toBe(mockGuildId);
      expect(mockDynamoDB.describeTable).toHaveBeenCalledWith({
        TableName: mockTableName
      });
    });

    it('should use environment variable for table name if not provided', async () => {
      process.env.DYNAMODB_PROPOSALS_TABLE = 'env-table-name';
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: 'env-table-name' } })
      });

      await storage.initialize(null, mockGuildId);

      expect(storage.tableName).toBe('env-table-name');
      delete process.env.DYNAMODB_PROPOSALS_TABLE;
    });

    it('should throw error if table access verification fails', async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('Table not found'))
      });

      await expect(storage.initialize(mockTableName, mockGuildId))
        .rejects.toThrow('Cannot access DynamoDB table test-proposals-table: Table not found');
    });
  });

  describe('addProposal', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should add proposal with correct structure', async () => {
      const messageId = 'msg123';
      const proposalData = {
        content: 'Test proposal',
        status: 'voting',
        author_id: 'user123'
      };

      mockDynamoDB.put.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      await storage.addProposal(messageId, proposalData);

      expect(mockDynamoDB.put).toHaveBeenCalledWith({
        TableName: mockTableName,
        Item: expect.objectContaining({
          guild_id: mockGuildId,
          message_id: messageId,
          content: 'Test proposal',
          status: 'voting',
          author_id: 'user123',
          ttl: expect.any(Number),
          created_at: expect.any(String),
          updated_at: expect.any(String)
        }),
        ConditionExpression: 'attribute_not_exists(message_id)'
      });
    });

    it('should throw error if proposal already exists', async () => {
      const messageId = 'msg123';
      const proposalData = { content: 'Test proposal' };

      const conditionalError = new Error('Conditional check failed');
      conditionalError.code = 'ConditionalCheckFailedException';
      
      mockDynamoDB.put.mockReturnValue({
        promise: jest.fn().mockRejectedValue(conditionalError)
      });

      await expect(storage.addProposal(messageId, proposalData))
        .rejects.toThrow('Proposal msg123 already exists');
    });

    it('should re-throw other DynamoDB errors', async () => {
      const messageId = 'msg123';
      const proposalData = { content: 'Test proposal' };

      mockDynamoDB.put.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });

      await expect(storage.addProposal(messageId, proposalData))
        .rejects.toThrow('DynamoDB error');
    });
  });

  describe('getProposal', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should retrieve proposal by message ID', async () => {
      const messageId = 'msg123';
      const mockProposal = { message_id: messageId, content: 'Test proposal' };

      mockDynamoDB.get.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Item: mockProposal })
      });

      const result = await storage.getProposal(messageId);

      expect(mockDynamoDB.get).toHaveBeenCalledWith({
        TableName: mockTableName,
        Key: {
          guild_id: mockGuildId,
          message_id: messageId
        }
      });
      expect(result).toBe(mockProposal);
    });

    it('should return null if proposal not found', async () => {
      const messageId = 'msg123';

      mockDynamoDB.get.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      const result = await storage.getProposal(messageId);

      expect(result).toBeNull();
    });

    it('should return null on DynamoDB errors', async () => {
      const messageId = 'msg123';

      mockDynamoDB.get.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });

      const result = await storage.getProposal(messageId);

      expect(result).toBeNull();
    });
  });

  describe('getAllProposals', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should retrieve all proposals for guild', async () => {
      const mockProposals = [
        { message_id: 'msg1', content: 'Proposal 1' },
        { message_id: 'msg2', content: 'Proposal 2' }
      ];

      mockDynamoDB.query.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Items: mockProposals })
      });

      const result = await storage.getAllProposals();

      expect(mockDynamoDB.query).toHaveBeenCalledWith({
        TableName: mockTableName,
        KeyConditionExpression: 'guild_id = :guildId',
        ExpressionAttributeValues: {
          ':guildId': mockGuildId
        }
      });
      expect(result).toBe(mockProposals);
    });

    it('should return empty array on DynamoDB errors', async () => {
      mockDynamoDB.query.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });

      const result = await storage.getAllProposals();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveVotes', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should retrieve active voting proposals using status index', async () => {
      const mockActiveVotes = [
        { message_id: 'msg1', status: 'voting' },
        { message_id: 'msg2', status: 'voting' }
      ];

      mockDynamoDB.query.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Items: mockActiveVotes })
      });

      const result = await storage.getActiveVotes();

      expect(mockDynamoDB.query).toHaveBeenCalledWith({
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
      expect(result).toBe(mockActiveVotes);
    });

    it('should return empty array on DynamoDB errors', async () => {
      mockDynamoDB.query.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });

      const result = await storage.getActiveVotes();

      expect(result).toEqual([]);
    });
  });

  describe('getProposalsByType', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should retrieve proposals by type using type index', async () => {
      const proposalType = 'policy';
      const mockProposals = [
        { message_id: 'msg1', proposal_type: 'policy' },
        { message_id: 'msg2', proposal_type: 'policy' }
      ];

      mockDynamoDB.query.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Items: mockProposals })
      });

      const result = await storage.getProposalsByType(proposalType);

      expect(mockDynamoDB.query).toHaveBeenCalledWith({
        TableName: mockTableName,
        IndexName: 'type-index',
        KeyConditionExpression: 'guild_id = :guildId AND proposal_type = :type',
        ExpressionAttributeValues: {
          ':guildId': mockGuildId,
          ':type': proposalType
        }
      });
      expect(result).toBe(mockProposals);
    });
  });

  describe('updateProposal', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should update proposal with correct expression', async () => {
      const messageId = 'msg123';
      const updates = {
        yes_votes: 5,
        no_votes: 2,
        status: 'completed'
      };

      mockDynamoDB.update.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      await storage.updateProposal(messageId, updates);

      expect(mockDynamoDB.update).toHaveBeenCalledWith({
        TableName: mockTableName,
        Key: {
          guild_id: mockGuildId,
          message_id: messageId
        },
        UpdateExpression: expect.stringContaining('SET #updated_at = :updated_at'),
        ExpressionAttributeNames: expect.objectContaining({
          '#updated_at': 'updated_at'
        }),
        ExpressionAttributeValues: expect.objectContaining({
          ':updated_at': expect.any(String)
        }),
        ConditionExpression: 'attribute_exists(message_id)'
      });
    });

    it('should throw error if proposal does not exist', async () => {
      const messageId = 'msg123';
      const updates = { yes_votes: 5 };

      const conditionalError = new Error('Conditional check failed');
      conditionalError.code = 'ConditionalCheckFailedException';
      
      mockDynamoDB.update.mockReturnValue({
        promise: jest.fn().mockRejectedValue(conditionalError)
      });

      await expect(storage.updateProposal(messageId, updates))
        .rejects.toThrow('Proposal msg123 not found');
    });
  });

  describe('deleteProposal', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should delete proposal successfully', async () => {
      const messageId = 'msg123';

      mockDynamoDB.delete.mockReturnValue({
        promise: jest.fn().mockResolvedValue({})
      });

      await storage.deleteProposal(messageId);

      expect(mockDynamoDB.delete).toHaveBeenCalledWith({
        TableName: mockTableName,
        Key: {
          guild_id: mockGuildId,
          message_id: messageId
        },
        ConditionExpression: 'attribute_exists(message_id)'
      });
    });

    it('should throw error if proposal does not exist', async () => {
      const messageId = 'msg123';

      const conditionalError = new Error('Conditional check failed');
      conditionalError.code = 'ConditionalCheckFailedException';
      
      mockDynamoDB.delete.mockReturnValue({
        promise: jest.fn().mockRejectedValue(conditionalError)
      });

      await expect(storage.deleteProposal(messageId))
        .rejects.toThrow('Proposal msg123 not found');
    });
  });

  describe('getExpiringVotes', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should retrieve expiring votes using end-time index', async () => {
      const beforeTime = '2023-01-01T12:00:00Z';
      const mockExpiringVotes = [
        { message_id: 'msg1', end_time: '2023-01-01T11:00:00Z', status: 'voting' }
      ];

      mockDynamoDB.query.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Items: mockExpiringVotes })
      });

      const result = await storage.getExpiringVotes(beforeTime);

      expect(mockDynamoDB.query).toHaveBeenCalledWith({
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
      expect(result).toBe(mockExpiringVotes);
    });
  });

  describe('getProposalStats', () => {
    beforeEach(async () => {
      mockDynamoDB.describeTable.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Table: { TableName: mockTableName } })
      });
      await storage.initialize(mockTableName, mockGuildId);
    });

    it('should calculate correct statistics', async () => {
      const mockProposals = [
        { status: 'voting', proposal_type: 'policy' },
        { status: 'passed', proposal_type: 'policy' },
        { status: 'failed', proposal_type: 'governance' },
        { status: 'passed', proposal_type: 'governance' }
      ];

      mockDynamoDB.query.mockReturnValue({
        promise: jest.fn().mockResolvedValue({ Items: mockProposals })
      });

      const result = await storage.getProposalStats();

      expect(result).toEqual({
        total: 4,
        active: 1,
        passed: 2,
        failed: 1,
        byType: {
          policy: 2,
          governance: 2
        }
      });
    });

    it('should return zero stats on error', async () => {
      mockDynamoDB.query.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });

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