const ProposalStorage = require('../../src/ProposalStorage');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockS3 = {
    getObject: jest.fn(),
    putObject: jest.fn()
  };
  
  return {
    S3: jest.fn(() => mockS3),
    __mockS3: mockS3
  };
});

const AWS = require('aws-sdk');

describe('ProposalStorage', () => {
  let proposalStorage;
  let mockS3;
  const mockBucketName = 'test-bucket';
  const mockGuildId = '123456789012345678';
  const mockProposalsKey = `bot/proposals-${mockGuildId}.json`;

  beforeEach(() => {
    proposalStorage = new ProposalStorage();
    mockS3 = AWS.__mockS3;
    
    // Reset all mocks
    jest.clearAllMocks();
    mockS3.getObject.mockClear();
    mockS3.putObject.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with empty proposals map and null bucket', () => {
      expect(proposalStorage.proposals).toBeInstanceOf(Map);
      expect(proposalStorage.proposals.size).toBe(0);
      expect(proposalStorage.bucketName).toBeNull();
      expect(proposalStorage.proposalsKey).toBeNull();
    });

    it('should have S3 instance defined', () => {
      expect(proposalStorage.s3).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should set bucket name and proposals key correctly', async () => {
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from('{}')
        })
      });

      await proposalStorage.initialize(mockBucketName, mockGuildId);

      expect(proposalStorage.bucketName).toBe(mockBucketName);
      expect(proposalStorage.proposalsKey).toBe(mockProposalsKey);
    });

    it('should use environment variable for bucket if not provided', async () => {
      process.env.S3_BUCKET = 'env-bucket';
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from('{}')
        })
      });

      await proposalStorage.initialize(null, mockGuildId);

      expect(proposalStorage.bucketName).toBe('env-bucket');
      
      delete process.env.S3_BUCKET;
    });

    it('should use default bucket if none provided', async () => {
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from('{}')
        })
      });

      await proposalStorage.initialize(null, mockGuildId);

      expect(proposalStorage.bucketName).toBe('your-default-bucket');
    });

    it('should call loadProposals during initialization', async () => {
      const loadProposalsSpy = jest.spyOn(proposalStorage, 'loadProposals');
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from('{}')
        })
      });

      await proposalStorage.initialize(mockBucketName, mockGuildId);

      expect(loadProposalsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadProposals', () => {
    beforeEach(async () => {
      proposalStorage.bucketName = mockBucketName;
      proposalStorage.proposalsKey = mockProposalsKey;
    });

    it('should load existing proposals from S3', async () => {
      const mockProposals = {
        'msg123': { 
          messageId: 'msg123', 
          content: 'Test proposal', 
          status: 'voting' 
        },
        'msg456': { 
          messageId: 'msg456', 
          content: 'Another proposal', 
          status: 'passed' 
        }
      };

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(mockProposals))
        })
      });

      await proposalStorage.loadProposals();

      expect(proposalStorage.proposals.size).toBe(2);
      expect(proposalStorage.proposals.get('msg123')).toEqual(mockProposals.msg123);
      expect(proposalStorage.proposals.get('msg456')).toEqual(mockProposals.msg456);
    });

    it('should handle NoSuchKey error gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const noSuchKeyError = new Error('The specified key does not exist.');
      noSuchKeyError.code = 'NoSuchKey';

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(noSuchKeyError)
      });

      await proposalStorage.loadProposals();

      expect(proposalStorage.proposals.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('No existing proposals found in S3');
      
      consoleSpy.mockRestore();
    });

    it('should handle S3 errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const s3Error = new Error('S3 connection error');

      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(s3Error)
      });

      await proposalStorage.loadProposals();

      expect(proposalStorage.proposals.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Error loading proposals from S3:', s3Error);
      
      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from('invalid json')
        })
      });

      await proposalStorage.loadProposals();

      expect(proposalStorage.proposals.size).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith('Error loading proposals from S3:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('saveProposals', () => {
    beforeEach(() => {
      proposalStorage.bucketName = mockBucketName;
      proposalStorage.proposalsKey = mockProposalsKey;
    });

    it('should save proposals to S3 with correct parameters', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const testProposal = { 
        messageId: 'msg123', 
        content: 'Test proposal', 
        status: 'voting' 
      };
      
      proposalStorage.proposals.set('msg123', testProposal);
      
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({})
      });

      await proposalStorage.saveProposals();

      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: mockBucketName,
        Key: mockProposalsKey,
        Body: JSON.stringify({ msg123: testProposal }, null, 2),
        ContentType: 'application/json',
        Metadata: {
          'last-updated': expect.any(String)
        }
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Proposals saved to S3: 1 items');
      consoleSpy.mockRestore();
    });

    it('should handle S3 save errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const s3Error = new Error('S3 save failed');

      mockS3.putObject.mockReturnValue({
        promise: () => Promise.reject(s3Error)
      });

      await expect(proposalStorage.saveProposals()).rejects.toThrow('S3 save failed');
      expect(consoleSpy).toHaveBeenCalledWith('Error saving proposals to S3:', s3Error);
      
      consoleSpy.mockRestore();
    });

    it('should save empty proposals map correctly', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({})
      });

      await proposalStorage.saveProposals();

      expect(mockS3.putObject).toHaveBeenCalledWith({
        Bucket: mockBucketName,
        Key: mockProposalsKey,
        Body: JSON.stringify({}, null, 2),
        ContentType: 'application/json',
        Metadata: {
          'last-updated': expect.any(String)
        }
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('addProposal', () => {
    beforeEach(() => {
      proposalStorage.bucketName = mockBucketName;
      proposalStorage.proposalsKey = mockProposalsKey;
      
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({})
      });
    });

    it('should add proposal to map and save to S3', async () => {
      const proposalData = { 
        messageId: 'msg123', 
        content: 'Test proposal', 
        status: 'voting' 
      };

      await proposalStorage.addProposal('msg123', proposalData);

      expect(proposalStorage.proposals.get('msg123')).toEqual(proposalData);
      expect(mockS3.putObject).toHaveBeenCalled();
    });

    it('should return promise from saveProposals', async () => {
      const proposalData = { messageId: 'msg123', content: 'Test' };
      
      const result = proposalStorage.addProposal('msg123', proposalData);
      
      expect(result).toBeInstanceOf(Promise);
      await result; // Ensure it resolves
    });
  });

  describe('getProposal', () => {
    it('should return proposal for valid message ID', () => {
      const proposalData = { messageId: 'msg123', content: 'Test proposal' };
      proposalStorage.proposals.set('msg123', proposalData);

      const result = proposalStorage.getProposal('msg123');

      expect(result).toEqual(proposalData);
    });

    it('should return undefined for non-existent message ID', () => {
      const result = proposalStorage.getProposal('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllProposals', () => {
    it('should return all proposals as array', () => {
      const proposal1 = { messageId: 'msg123', content: 'Proposal 1' };
      const proposal2 = { messageId: 'msg456', content: 'Proposal 2' };
      
      proposalStorage.proposals.set('msg123', proposal1);
      proposalStorage.proposals.set('msg456', proposal2);

      const result = proposalStorage.getAllProposals();

      expect(result).toHaveLength(2);
      expect(result).toContain(proposal1);
      expect(result).toContain(proposal2);
    });

    it('should return empty array when no proposals exist', () => {
      const result = proposalStorage.getAllProposals();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveVotes', () => {
    it('should return only proposals with voting status', () => {
      const votingProposal = { messageId: 'msg123', status: 'voting' };
      const passedProposal = { messageId: 'msg456', status: 'passed' };
      const failedProposal = { messageId: 'msg789', status: 'failed' };
      
      proposalStorage.proposals.set('msg123', votingProposal);
      proposalStorage.proposals.set('msg456', passedProposal);
      proposalStorage.proposals.set('msg789', failedProposal);

      const result = proposalStorage.getActiveVotes();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(votingProposal);
    });

    it('should return empty array when no active votes', () => {
      const passedProposal = { messageId: 'msg456', status: 'passed' };
      proposalStorage.proposals.set('msg456', passedProposal);

      const result = proposalStorage.getActiveVotes();

      expect(result).toEqual([]);
    });
  });

  describe('getProposalsByType', () => {
    it('should return proposals filtered by type', () => {
      const policyProposal = { messageId: 'msg123', proposalType: 'policy' };
      const governanceProposal = { messageId: 'msg456', proposalType: 'governance' };
      const anotherPolicyProposal = { messageId: 'msg789', proposalType: 'policy' };
      
      proposalStorage.proposals.set('msg123', policyProposal);
      proposalStorage.proposals.set('msg456', governanceProposal);
      proposalStorage.proposals.set('msg789', anotherPolicyProposal);

      const result = proposalStorage.getProposalsByType('policy');

      expect(result).toHaveLength(2);
      expect(result).toContain(policyProposal);
      expect(result).toContain(anotherPolicyProposal);
      expect(result).not.toContain(governanceProposal);
    });

    it('should return empty array for non-existent type', () => {
      const policyProposal = { messageId: 'msg123', proposalType: 'policy' };
      proposalStorage.proposals.set('msg123', policyProposal);

      const result = proposalStorage.getProposalsByType('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('updateProposal', () => {
    beforeEach(() => {
      proposalStorage.bucketName = mockBucketName;
      proposalStorage.proposalsKey = mockProposalsKey;
      
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({})
      });
    });

    it('should update existing proposal and save to S3', async () => {
      const originalProposal = { 
        messageId: 'msg123', 
        content: 'Test proposal', 
        status: 'voting' 
      };
      const updates = { status: 'passed', finalYes: 10, finalNo: 3 };
      
      proposalStorage.proposals.set('msg123', originalProposal);

      await proposalStorage.updateProposal('msg123', updates);

      const updatedProposal = proposalStorage.proposals.get('msg123');
      expect(updatedProposal.status).toBe('passed');
      expect(updatedProposal.finalYes).toBe(10);
      expect(updatedProposal.finalNo).toBe(3);
      expect(updatedProposal.messageId).toBe('msg123'); // Original data preserved
      expect(mockS3.putObject).toHaveBeenCalled();
    });

    it('should return resolved promise for non-existent proposal', async () => {
      const result = await proposalStorage.updateProposal('nonexistent', { status: 'passed' });

      expect(result).toBeUndefined();
      expect(mockS3.putObject).not.toHaveBeenCalled();
    });

    it('should preserve original proposal data when updating', async () => {
      const originalProposal = { 
        messageId: 'msg123', 
        content: 'Test proposal', 
        status: 'voting',
        authorId: 'user123'
      };
      
      proposalStorage.proposals.set('msg123', originalProposal);

      await proposalStorage.updateProposal('msg123', { status: 'passed' });

      const updatedProposal = proposalStorage.proposals.get('msg123');
      expect(updatedProposal.content).toBe('Test proposal');
      expect(updatedProposal.authorId).toBe('user123');
      expect(updatedProposal.status).toBe('passed');
    });
  });
});