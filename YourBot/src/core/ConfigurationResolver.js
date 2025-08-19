const fs = require('fs').promises;

/**
 * ConfigurationResolver - Handles runtime configuration loading and validation
 * Manages deployment-specific settings from terraform-generated config files
 */
class ConfigurationResolver {
    constructor() {
        this.config = null;
    }

    /**
     * Load and validate runtime configuration from deployment
     */
    async loadConfiguration() {
        try {
            // Load runtime configuration created during deployment
            // This file contains Discord IDs, tokens, and channel mappings specific to this deployment
            console.log('Loading runtime configuration...');
            const runtimeConfig = JSON.parse(await fs.readFile('runtime.config.json', 'utf8'));
            
            // Validate required configuration fields
            this.validateConfiguration(runtimeConfig);
            
            // Store validated configuration
            this.config = runtimeConfig;
            
            // Log configuration summary for verification
            this.logConfigurationSummary(runtimeConfig);
            
            return runtimeConfig;
        } catch (error) {
            console.error('Failed to load runtime configuration:', error);
            throw error;
        }
    }

    /**
     * Validate that all required configuration fields are present
     */
    validateConfiguration(config) {
        const requiredFields = [
            'guildId',
            'botToken', 
            'moderatorRoleId',
            'memberRoleId',
            'commandChannelId',
            'memberCommandChannelId',
            'dynamodbTable',
            'eventsTable'
        ];

        const missingFields = requiredFields.filter(field => !config[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
        }

        // Validate reminder intervals
        if (!config.reminderIntervals) {
            throw new Error('Reminder intervals not configured in runtime config');
        }

        const requiredIntervals = ['weekReminder', 'dayReminder'];
        const missingIntervals = requiredIntervals.filter(interval => !config.reminderIntervals[interval]);
        
        if (missingIntervals.length > 0) {
            throw new Error(`Missing reminder intervals: ${missingIntervals.join(', ')}`);
        }
    }

    /**
     * Log configuration summary for deployment verification
     */
    logConfigurationSummary(config) {
        console.log(`Guild ID: ${config.guildId}`);
        console.log(`Bot Run ID: ${config.runId || 'unknown'}`);
        console.log(`Moderator Command Channel ID: ${config.commandChannelId}`);
        console.log(`Member Command Channel ID: ${config.memberCommandChannelId}`);
        console.log(`Proposal config loaded with types:`, Object.keys(config.proposalConfig || {}));
        console.log(`Event management table: ${config.eventsTable}`);
        console.log(`Reminder intervals: ${config.reminderIntervals.weekReminder/60000}min, ${config.reminderIntervals.dayReminder/60000}min`);
    }

    /**
     * Get a specific configuration value
     */
    get(key) {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }
        return this.config[key];
    }

    /**
     * Get the full configuration object
     */
    getAll() {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }
        return this.config;
    }

    /**
     * Check if configuration is loaded
     */
    isLoaded() {
        return this.config !== null;
    }
}

module.exports = ConfigurationResolver;