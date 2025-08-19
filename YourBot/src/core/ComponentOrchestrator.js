const ConfigManager = require('../managers/ConfigManager');
const EventHandlers = require('../handlers/EventHandlers');
const CommandRouter = require('../handlers/CommandRouter');
const UserValidator = require('../validators/UserValidator');
const ProposalManager = require('../managers/ProposalManager');
const EventManager = require('../managers/EventManager');

/**
 * ComponentOrchestrator - Manages initialization and dependencies of specialized modules
 * Ensures proper dependency injection and initialization order
 */
class ComponentOrchestrator {
    constructor(bot) {
        this.bot = bot;
        this.components = {};
    }

    /**
     * Initialize all specialized components in the correct order
     */
    initializeComponents() {
        // Initialize specialized modules - each handles a specific bot responsibility
        // This separation keeps concerns isolated and makes the code more maintainable
        this.components.configManager = new ConfigManager();        // S3-backed reaction configuration
        this.components.userValidator = new UserValidator();        // Permission and eligibility checks
        this.components.proposalManager = new ProposalManager(this.bot); // Community governance system
        this.components.eventHandlers = new EventHandlers(this.bot);    // Discord event processing
        this.components.commandRouter = new CommandRouter(this.bot);     // Bot command routing to specialized handlers
        this.components.eventManager = null;                         // Event system (initialized later with config)

        // Attach components to bot for easy access
        this.attachComponentsToBot();

        console.log('✅ All components initialized successfully');
    }

    /**
     * Initialize components that require runtime configuration
     */
    async initializeConfigurableComponents(runtimeConfig) {
        try {
            // Initialize launch-time reaction role configuration
            // Reaction role configurations are provided via runtime config and stored in memory only
            await this.components.configManager.initialize(runtimeConfig.reactionRoleConfig || []);
            console.log('✅ Config manager initialized');

            // Initialize community proposal/voting system with DynamoDB storage
            // This enables democratic governance features with hybrid storage approach
            await this.components.proposalManager.initialize(
                runtimeConfig.dynamodbTable,
                runtimeConfig.guildId,
                runtimeConfig.proposalConfig
            );
            console.log('✅ Proposal manager initialized');

            // Initialize event management system with DynamoDB storage
            // This enables community event planning and notification features
            this.components.eventManager = new EventManager(this.bot);
            this.bot.eventManager = this.components.eventManager;
            console.log(`✅ Event management system initialized with table: ${runtimeConfig.eventsTable}`);

        } catch (error) {
            console.error('❌ Failed to initialize configurable components:', error);
            throw error;
        }
    }

    /**
     * Attach components to bot instance for easy access
     */
    attachComponentsToBot() {
        // Attach components to bot for access by other modules
        this.bot.configManager = this.components.configManager;
        this.bot.userValidator = this.components.userValidator;
        this.bot.proposalManager = this.components.proposalManager;
        this.bot.eventHandlers = this.components.eventHandlers;
        this.bot.commandRouter = this.components.commandRouter;
        this.bot.eventManager = this.components.eventManager;
    }

    /**
     * Get a specific component
     */
    getComponent(name) {
        return this.components[name];
    }

    /**
     * Get all components
     */
    getAllComponents() {
        return this.components;
    }

    /**
     * Check if a component is initialized
     */
    isComponentInitialized(name) {
        return this.components[name] !== null && this.components[name] !== undefined;
    }

    /**
     * Clean up all components
     */
    async cleanup() {
        // Cleanup event manager if it exists
        if (this.components.eventManager && typeof this.components.eventManager.cleanup === 'function') {
            this.components.eventManager.cleanup();
        }

        console.log('✅ Components cleaned up');
    }
}

module.exports = ComponentOrchestrator;