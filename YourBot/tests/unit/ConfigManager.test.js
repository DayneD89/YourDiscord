const ConfigManager = require('../../src/ConfigManager');

// Mock AWS SDK entirely
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

describe('ConfigManager', () => {
  let configManager;
  const mockBucketName = 'test-bucket';
  const mockGuildId = '123456789012345678';
  const mockConfigKey = `bot/discord-bot-config-${mockGuildId}.json`;

  beforeEach(() => {
    configManager = new ConfigManager();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Get the mock S3 instance
    const mockS3 = AWS.__mockS3;
    mockS3.getObject.mockClear();
    mockS3.putObject.mockClear();
  });

  describe('initialize', () => {
    it('should set bucket name and config key correctly', async () => {
      const mockConfig = [{ from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' }];
      
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(mockConfig))
        })
      });

      await configManager.initialize(mockBucketName, mockGuildId);

      expect(configManager.bucketName).toBe(mockBucketName);
      expect(configManager.configKey).toBe(mockConfigKey);
    });

    it('should use environment variable for bucket if not provided', async () => {
      process.env.S3_BUCKET = 'env-bucket';
      
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify([]))
        })
      });

      await configManager.initialize(null, mockGuildId);

      expect(configManager.bucketName).toBe('env-bucket');
      
      delete process.env.S3_BUCKET;
    });

    it('should use default bucket if none provided', async () => {
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify([]))
        })
      });

      await configManager.initialize(null, mockGuildId);

      expect(configManager.bucketName).toBe('your-default-bucket');
    });
  });

  describe('loadConfig', () => {
    it('should load existing config from S3', async () => {
      const mockConfig = [
        { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' },
        { from: 'msg2', action: 'emoji2', to: 'AddRole(user_id,"moderator")' }
      ];

      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(mockConfig))
        })
      });

      await configManager.initialize(mockBucketName, mockGuildId);

      expect(configManager.getConfig()).toEqual(mockConfig);
    });

    it('should use default config when S3 key does not exist', async () => {
      const defaultConfig = [{ from: 'default', action: 'default', to: 'default' }];
      
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => {
          const error = new Error('The specified key does not exist.');
          error.code = 'NoSuchKey';
          return Promise.reject(error);
        }
      });

      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({})
      });

      await configManager.initialize(mockBucketName, mockGuildId, defaultConfig);

      expect(configManager.getConfig()).toEqual(defaultConfig);
    });

    it('should use default config when S3 error occurs', async () => {
      const defaultConfig = [{ from: 'fallback', action: 'fallback', to: 'fallback' }];
      
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.reject(new Error('S3 connection error'))
      });

      await configManager.initialize(mockBucketName, mockGuildId, defaultConfig);

      expect(configManager.getConfig()).toEqual(defaultConfig);
    });
  });

  describe('saveConfig', () => {
    beforeEach(async () => {
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify([]))
        })
      });
      
      await configManager.initialize(mockBucketName, mockGuildId);
    });

    it('should save config to S3 with correct parameters', async () => {
      let savedParams;
      
      const mockS3 = AWS.__mockS3;
      mockS3.putObject.mockImplementation((params) => {
        savedParams = params;
        return {
          promise: () => Promise.resolve({})
        };
      });

      configManager.config = [{ from: 'test', action: 'test', to: 'test' }];
      await configManager.saveConfig();

      expect(savedParams.Bucket).toBe(mockBucketName);
      expect(savedParams.Key).toBe(mockConfigKey);
      expect(savedParams.ContentType).toBe('application/json');
      expect(JSON.parse(savedParams.Body)).toEqual(configManager.config);
      expect(savedParams.Metadata['last-updated']).toBeDefined();
    });

    it('should throw error when S3 save fails', async () => {
      const mockS3 = AWS.__mockS3;
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.reject(new Error('S3 save failed'))
      });

      await expect(configManager.saveConfig()).rejects.toThrow('S3 save failed');
    });
  });

  describe('getConfig', () => {
    it('should return current config', async () => {
      const testConfig = [{ from: 'test', action: 'test', to: 'test' }];
      
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(testConfig))
        })
      });

      await configManager.initialize(mockBucketName, mockGuildId);

      expect(configManager.getConfig()).toEqual(testConfig);
    });

    it('should return null if config not initialized', () => {
      expect(configManager.getConfig()).toBeNull();
    });
  });

  describe('addConfig', () => {
    beforeEach(async () => {
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify([]))
        })
      });
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({})
      });
      
      await configManager.initialize(mockBucketName, mockGuildId);
    });

    it('should add valid config successfully', async () => {
      const newConfig = { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' };
      
      await configManager.addConfig(newConfig);

      expect(configManager.getConfig()).toContain(newConfig);
    });

    it('should throw error for config missing required fields', async () => {
      const invalidConfig = { from: 'msg1' }; // missing action

      await expect(configManager.addConfig(invalidConfig)).rejects.toThrow(
        'Config must have at least "from" and "action" fields.'
      );
    });

    it('should throw error for duplicate config', async () => {
      const config1 = { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' };
      const config2 = { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"moderator")' };
      
      await configManager.addConfig(config1);
      
      await expect(configManager.addConfig(config2)).rejects.toThrow(
        'A config with the same message ID and action already exists.'
      );
    });
  });

  describe('removeConfig', () => {
    beforeEach(async () => {
      const initialConfig = [
        { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' },
        { from: 'msg2', action: 'emoji2', to: 'AddRole(user_id,"moderator")' }
      ];
      
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(initialConfig))
        })
      });
      mockS3.putObject.mockReturnValue({
        promise: () => Promise.resolve({})
      });
      
      await configManager.initialize(mockBucketName, mockGuildId);
    });

    it('should remove existing config successfully', async () => {
      const initialLength = configManager.getConfig().length;
      
      await configManager.removeConfig('msg1', 'emoji1');

      expect(configManager.getConfig().length).toBe(initialLength - 1);
      expect(configManager.findConfig('msg1', 'emoji1')).toBeUndefined();
    });

    it('should throw error when config not found', async () => {
      await expect(configManager.removeConfig('nonexistent', 'emoji')).rejects.toThrow(
        'No config found with the specified message ID and action.'
      );
    });
  });

  describe('findConfig', () => {
    beforeEach(async () => {
      const testConfig = [
        { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' },
        { from: 'msg2', action: 'emoji2', to: 'AddRole(user_id,"moderator")' }
      ];
      
      const mockS3 = AWS.__mockS3;
      mockS3.getObject.mockReturnValue({
        promise: () => Promise.resolve({
          Body: Buffer.from(JSON.stringify(testConfig))
        })
      });
      
      await configManager.initialize(mockBucketName, mockGuildId);
    });

    it('should find existing config by message ID and action', () => {
      const found = configManager.findConfig('msg1', 'emoji1');
      
      expect(found).toBeDefined();
      expect(found.from).toBe('msg1');
      expect(found.action).toBe('emoji1');
    });

    it('should return undefined for non-existent config', () => {
      const found = configManager.findConfig('nonexistent', 'emoji');
      
      expect(found).toBeUndefined();
    });
  });
});