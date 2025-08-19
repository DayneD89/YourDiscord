/**
 * BotStateController - Handles bot enable/disable state management
 * Manages individual bot instance states for multi-bot deployments
 */
class BotStateController {
    constructor(client) {
        this.client = client;
        // Bot enable/disable state tracking (Map of bot_id -> enabled status)
        this.botStates = new Map();
    }

    /**
     * Enable a bot by ID - allows the bot to respond to commands
     */
    enableBot(botId) {
        this.botStates.set(botId, true);
        console.log(`✅ Bot ${botId} enabled`);
    }

    /**
     * Disable a bot by ID - bot will ignore all commands
     */
    disableBot(botId) {
        this.botStates.set(botId, false);
        console.log(`❌ Bot ${botId} disabled`);
    }

    /**
     * Check if a bot is enabled (defaults to true if not set)
     */
    isBotEnabled(botId) {
        return this.botStates.get(botId) !== false;
    }

    /**
     * Check if this current bot instance is enabled
     */
    isThisBotEnabled() {
        if (!this.client || !this.client.user) {
            return true; // Default to enabled if client not ready
        }
        return this.isBotEnabled(this.client.user.id);
    }

    /**
     * Get the current bot's ID
     */
    getBotId() {
        return this.client?.user?.id || null;
    }

    /**
     * Get all bot states
     */
    getAllBotStates() {
        return new Map(this.botStates);
    }

    /**
     * Clear all bot states
     */
    clearAllStates() {
        this.botStates.clear();
        console.log('🧹 All bot states cleared');
    }

    /**
     * Get state statistics
     */
    getStateStats() {
        const total = this.botStates.size;
        const enabled = Array.from(this.botStates.values()).filter(state => state === true).length;
        const disabled = total - enabled;
        
        return {
            total,
            enabled,
            disabled
        };
    }
}

module.exports = BotStateController;