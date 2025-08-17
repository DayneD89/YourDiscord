// Manages reaction role configurations with launch-time initialization
// Handles loading and validating bot reaction configurations from userdata
// Configuration is set at launch time and cannot be modified at runtime
class ConfigManager {
    constructor() {
        this.config = null;         // In-memory configuration loaded at launch
    }

    initialize(reactionRoleConfig = []) {
        // Load reaction role configuration from launch parameters
        // Configuration is provided via userdata and stored in memory only
        console.log(`Loading ${reactionRoleConfig.length} reaction role configurations from launch parameters`);
        this.config = reactionRoleConfig;
        console.log(`✅ LOADED ${this.config.length} reaction role configurations:`, this.config);
    }


    // Return current configuration for other modules to use
    // This provides read-only access to prevent accidental modification
    getConfig() {
        console.log(`DEBUG: getConfig() called, returning ${this.config ? this.config.length : 'null'} items`);
        return this.config ? [...this.config] : this.config;
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