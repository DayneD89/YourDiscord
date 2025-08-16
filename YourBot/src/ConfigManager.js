const AWS = require('aws-sdk');

class ConfigManager {
    constructor() {
        this.s3 = new AWS.S3();
        this.config = null;
        this.bucketName = null;
        this.configKey = null;
    }

    async initialize(bucketName, guildId, defaultConfig = []) {
        this.bucketName = bucketName || process.env.S3_BUCKET || 'your-default-bucket';
        this.configKey = `bot/discord-bot-config-${guildId}.json`;

        console.log(`S3 Bucket: ${this.bucketName}`);
        console.log(`S3 Key: ${this.configKey}`);

        await this.loadConfig(defaultConfig);
    }

    async loadConfig(defaultConfig = []) {
        try {
            console.log('Loading config from S3...');
            const response = await this.s3.getObject({
                Bucket: this.bucketName,
                Key: this.configKey
            }).promise();
            
            this.config = JSON.parse(response.Body.toString());
            console.log(`✅ LOADED ${this.config.length} configurations from S3:`, this.config);
        } catch (error) {
            if (error.code === 'NoSuchKey') {
                console.log('No existing config found in S3, using default');
                this.config = defaultConfig;
                console.log(`✅ USING DEFAULT CONFIG with ${this.config.length} items:`, this.config);
                await this.saveConfig();
            } else {
                console.error('Error loading config from S3:', error);
                console.log('Falling back to default config due to S3 error');
                this.config = defaultConfig;
                console.log(`✅ FALLBACK CONFIG with ${this.config.length} items:`, this.config);
            }
        }
    }

    async saveConfig() {
        try {
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

    getConfig() {
        console.log(`DEBUG: getConfig() called, returning ${this.config ? this.config.length : 'null'} items`);
        return this.config;
    }

    addConfig(newConfig) {
        // Validate required fields
        const requiredFields = ['from', 'action'];
        const hasRequiredFields = requiredFields.every(field => 
            newConfig.hasOwnProperty(field)
        );

        if (!hasRequiredFields) {
            throw new Error('Config must have at least "from" and "action" fields.');
        }

        // Check for duplicates
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
        const initialLength = this.config.length;
        this.config = this.config.filter(item => 
            !(item.from === messageId && item.action === action)
        );

        if (this.config.length === initialLength) {
            throw new Error('No config found with the specified message ID and action.');
        }

        return this.saveConfig();
    }

    findConfig(messageId, action) {
        return this.config.find(item => 
            item.from === messageId && item.action === action
        );
    }
}

module.exports = ConfigManager;