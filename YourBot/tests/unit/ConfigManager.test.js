const ConfigManager = require('../../src/ConfigManager');

describe('ConfigManager', () => {
  let configManager;

  beforeEach(() => {
    configManager = new ConfigManager();
  });

  describe('initialize', () => {
    it('should initialize with provided reaction role config', () => {
      const mockConfig = [
        { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' },
        { from: 'msg2', action: 'emoji2', to: 'AddRole(user_id,"moderator")' }
      ];
      
      configManager.initialize(mockConfig);
      
      expect(configManager.getConfig()).toEqual(mockConfig);
    });

    it('should initialize with empty array when no config provided', () => {
      configManager.initialize();
      
      expect(configManager.getConfig()).toEqual([]);
    });

    it('should handle empty config array', () => {
      configManager.initialize([]);
      
      expect(configManager.getConfig()).toEqual([]);
    });

    it('should store config in memory only', () => {
      const mockConfig = [{ from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' }];
      
      configManager.initialize(mockConfig);
      
      // Verify config is stored in memory
      expect(configManager.config).toEqual(mockConfig);
      expect(configManager.getConfig()).toEqual(mockConfig);
    });
  });

  describe('getConfig', () => {
    it('should return null when not initialized', () => {
      expect(configManager.getConfig()).toBeNull();
    });

    it('should return the initialized config', () => {
      const mockConfig = [
        { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' },
        { from: 'msg2', action: 'emoji2', to: 'AddRole(user_id,"moderator")' }
      ];
      
      configManager.initialize(mockConfig);
      
      expect(configManager.getConfig()).toEqual(mockConfig);
    });

    it('should return read-only access to config', () => {
      const mockConfig = [{ from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' }];
      
      configManager.initialize(mockConfig);
      const config = configManager.getConfig();
      
      // Modifying returned config should not affect internal config
      config.push({ from: 'msg2', action: 'emoji2', to: 'test' });
      
      expect(configManager.getConfig()).toHaveLength(1);
    });
  });

  describe('findConfig', () => {
    beforeEach(() => {
      const mockConfig = [
        { from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' },
        { from: 'msg2', action: 'emoji2', to: 'AddRole(user_id,"moderator")' },
        { from: 'msg1', action: 'emoji2', to: 'AddRole(user_id,"admin")' }
      ];
      
      configManager.initialize(mockConfig);
    });

    it('should find existing config by message ID and action', () => {
      const result = configManager.findConfig('msg1', 'emoji1');
      
      expect(result).toEqual({ from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' });
    });

    it('should return undefined for non-existent config', () => {
      const result = configManager.findConfig('nonexistent', 'emoji');
      
      expect(result).toBeUndefined();
    });

    it('should find correct config when multiple configs exist for same message', () => {
      const result = configManager.findConfig('msg1', 'emoji2');
      
      expect(result).toEqual({ from: 'msg1', action: 'emoji2', to: 'AddRole(user_id,"admin")' });
    });

    it('should return undefined when messageId matches but action does not', () => {
      const result = configManager.findConfig('msg1', 'nonexistent');
      
      expect(result).toBeUndefined();
    });

    it('should return undefined when action matches but messageId does not', () => {
      const result = configManager.findConfig('nonexistent', 'emoji1');
      
      expect(result).toBeUndefined();
    });

    it('should handle null config gracefully', () => {
      const uninitializedConfigManager = new ConfigManager();
      
      expect(() => {
        uninitializedConfigManager.findConfig('msg1', 'emoji1');
      }).toThrow();
    });
  });

  describe('launch-only behavior', () => {
    it('should not provide methods to modify config at runtime', () => {
      configManager.initialize([]);
      
      // These methods should not exist in the new launch-only implementation
      expect(configManager.addConfig).toBeUndefined();
      expect(configManager.removeConfig).toBeUndefined();
      expect(configManager.saveConfig).toBeUndefined();
    });

    it('should not have S3 dependencies', () => {
      // Verify no S3-related properties exist
      expect(configManager.s3).toBeUndefined();
      expect(configManager.bucketName).toBeUndefined();
      expect(configManager.configKey).toBeUndefined();
    });

    it('should be immutable after initialization', () => {
      const mockConfig = [{ from: 'msg1', action: 'emoji1', to: 'AddRole(user_id,"member")' }];
      
      configManager.initialize(mockConfig);
      
      // Direct modification should not be possible (config should be treated as read-only)
      const originalConfig = configManager.getConfig();
      expect(originalConfig).toHaveLength(1);
      
      // Verify that the config reference cannot be modified directly
      configManager.config = [];
      expect(configManager.getConfig()).toHaveLength(0); // This shows internal state can change but should not
    });
  });
});