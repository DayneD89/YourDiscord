const AWS = require('aws-sdk');

// Manages reaction role configurations with S3 persistence
// Handles loading, saving, and validating bot reaction configurations
// S3 storage ensures configurations survive bot restarts and deployments
class ConfigManager {
    constructor() {
        this.s3 = new AWS.S3();
        this.config = null;         // In-memory cache of current configuration
        this.bucketName = null;     // S3 bucket for persistent storage
        this.configKey = null;      // S3 object key for this guild's config
    }

    async initialize(bucketName, guildId, defaultConfig = []) {
        // Setup S3 storage paths - each guild gets its own configuration file
        // This allows the same bot deployment to serve multiple Discord servers
        this.bucketName = bucketName || process.env.S3_BUCKET || 'your-default-bucket';
        this.configKey = `bot/discord-bot-config-${guildId}.json`;

        console.log(`S3 Bucket: ${this.bucketName}`);
        console.log(`S3 Key: ${this.configKey}`);

        await this.loadConfig(defaultConfig);
    }

    async loadConfig(defaultConfig = []) {
        try {
            // Attempt to load existing configuration from S3
            // This preserves configurations across bot deployments and restarts
            console.log('Loading config from S3...');
            const response = await this.s3.getObject({
                Bucket: this.bucketName,
                Key: this.configKey
            }).promise();
            
            this.config = JSON.parse(response.Body.toString());
            console.log(`✅ LOADED ${this.config.length} configurations from S3:`, this.config);
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                // First-time setup - no config exists yet, use default
                console.log('No existing config found in S3, using default');
                this.config = defaultConfig;
                console.log(`✅ USING DEFAULT CONFIG with ${this.config.length} items:`, this.config);
                await this.saveConfig();
            } else {
                // S3 error - fall back gracefully to prevent bot failure
                console.error('Error loading config from S3:', error);
                console.log('Falling back to default config due to S3 error');
                this.config = defaultConfig;
                console.log(`✅ FALLBACK CONFIG with ${this.config.length} items:`, this.config);
            }
        }
    }

    async saveConfig() {
        try {
            // Persist configuration changes to S3 for durability
            // Includes metadata for tracking when configurations were last modified
            console.log('Saving config to S3...');
            await this.s3.putObject({
                Bucket: this.bucketName,
                Key: this.configKey,
                Body: JSON.stringify(this.config, null, 2),
                ContentType: 'application/json',
                Metadata: {
                    'last-updated': new Date().toISOString()
                }
            }).promise();
            console.log(`Config saved to S3: ${this.config.length} configurations`);
        } catch (error) {
            console.error('Error saving config to S3:', error);
            throw error;
        }
    }

    // Return current configuration for other modules to use
    // This provides read-only access to prevent accidental modification
    getConfig() {
        console.log(`DEBUG: getConfig() called, returning ${this.config ? this.config.length : 'null'} items`);
        return this.config;
    }

    addConfig(newConfig) {
        // Validate required fields to prevent invalid configurations
        // Message ID and reaction emoji are minimum requirements for reaction roles
        const requiredFields = ['from', 'action'];
        const hasRequiredFields = requiredFields.every(field => 
            newConfig.hasOwnProperty(field)
        );

        if (!hasRequiredFields) {
            throw new Error('Config must have at least "from" and "action" fields.');
        }

        // Prevent duplicate configurations which would cause conflicts
        // Same message + same reaction should only have one behavior
        const duplicate = this.config.find(item => 
            item.from === newConfig.from && item.action === newConfig.action
        );

        if (duplicate) {
            throw new Error('A config with the same message ID and action already exists.');
        }

        this.config.push(newConfig);
        return this.saveConfig();
    }

    removeConfig(messageId, action) {
        // Remove specific reaction configuration
        // Validates that the configuration exists before attempting removal
        const initialLength = this.config.length;
        this.config = this.config.filter(item => 
            !(item.from === messageId && item.action === action)
        );

        if (this.config.length === initialLength) {
            throw new Error('No config found with the specified message ID and action.');
        }

        return this.saveConfig();
    }

    // Find specific configuration for a message and reaction combination
    // Used by event handlers to determine what action to take on reactions
    findConfig(messageId, action) {
        return this.config.find(item => 
            item.from === messageId && item.action === action
        );
    }
}

module.exports = ConfigManager;