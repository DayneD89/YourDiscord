/**
 * ConfigManager - Launch-time reaction role configuration management
 * 
 * Manages the static reaction role configurations that are loaded at bot startup.
 * Provides read-only access to configurations for role assignment actions.
 * 
 * Architecture rationale:
 * - Launch-time loading ensures configuration consistency during bot lifetime
 * - In-memory storage provides fast access without external dependencies
 * - Read-only access prevents accidental modification of critical configurations
 * - Array-based storage enables efficient lookup and iteration
 * 
 * Configuration format:
 * - from: Discord message ID to monitor
 * - emoji: Emoji that triggers the action
 * - action: Role assignment action to execute
 * - description: Human-readable description for admin reference
 */
class ConfigManager {
    constructor() {
        this.config = null;         // In-memory configuration loaded at launch
    }

    /**
     * Initialize reaction role configurations from deployment parameters
     * 
     * Loads and validates reaction role configurations provided via userdata.
     * Configuration becomes immutable after initialization.
     * 
     * @param {Array} reactionRoleConfig - Array of reaction role configuration objects
     */
    initialize(reactionRoleConfig = []) {
        // Store configuration provided via deployment userdata for runtime use
        // These configurations define which reactions trigger which role actions
        console.log(`Loading ${reactionRoleConfig.length} reaction role configurations from launch parameters`);
        this.config = reactionRoleConfig;
        console.log(`✅ LOADED ${this.config.length} reaction role configurations:`, this.config);
    }


    // Return current configuration for other modules to use
    // This provides read-only access to prevent accidental modification
    getConfig() {
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