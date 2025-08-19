const { Client, GatewayIntentBits } = require('discord.js');

const ConfigurationResolver = require('./core/ConfigurationResolver');
const ComponentOrchestrator = require('./core/ComponentOrchestrator');
const BotLifecycleManager = require('./core/BotLifecycleManager');
const BotStateController = require('./core/BotStateController');

/**
 * DiscordReactionBot - Main bot coordinator class
 * Orchestrates specialized components for a clean, maintainable architecture
 * Now focused purely on coordination and high-level bot lifecycle management
 */
class DiscordReactionBot {
    constructor() {
        // Discord client with necessary intents for reaction roles and proposal system
        // These specific intents allow reading reactions, messages, and managing member roles
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,               // Access to guild info
                GatewayIntentBits.GuildMessages,        // Read messages for commands
                GatewayIntentBits.GuildMessageReactions, // Monitor reaction events
                GatewayIntentBits.MessageContent,       // Access message text for proposal parsing
                GatewayIntentBits.GuildMembers          // Role management capabilities
            ]
        });

        // Runtime configuration loaded from deployment
        // These values come from terraform and vary per deployment environment
        this.config = null;
        this.guildId = null;
        this.botToken = null;
        this.runId = null;
        this.moderatorRoleId = null;
        this.memberRoleId = null;
        this.commandChannelId = null;
        this.memberCommandChannelId = null;
        this.eventsTable = null;
        this.reminderIntervals = null;
        
        // Initialize specialized component managers
        this.configResolver = new ConfigurationResolver();
        this.componentOrchestrator = new ComponentOrchestrator(this);
        this.lifecycleManager = new BotLifecycleManager(this);
        this.stateController = new BotStateController(this.client);
        
        // Initialize components and setup event handlers
        this.componentOrchestrator.initializeComponents();
        this.lifecycleManager.setupEventHandlers();
    }

    /**
     * Initialize the bot with runtime configuration and start Discord connection
     */
    async initialize() {
        try {
            // Load and validate runtime configuration
            const runtimeConfig = await this.configResolver.loadConfiguration();
            
            // Extract configuration values
            this.extractConfigurationValues(runtimeConfig);
            
            // Initialize components that require configuration
            await this.componentOrchestrator.initializeConfigurableComponents(runtimeConfig);

            // Connect to Discord and start processing events
            // Bot becomes active and responsive after this point
            console.log('Logging into Discord...');
            await this.client.login(this.botToken);
            console.log('Bot initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize bot:', error);
            process.exit(1);
        }
    }

    /**
     * Extract configuration values from runtime config
     */
    extractConfigurationValues(runtimeConfig) {
        // Extract Discord-specific configuration values
        // These IDs are unique to each Discord server and deployment
        this.guildId = runtimeConfig.guildId;
        this.botToken = runtimeConfig.botToken;
        this.runId = runtimeConfig.runId || 'unknown';
        this.moderatorRoleId = runtimeConfig.moderatorRoleId;
        this.memberRoleId = runtimeConfig.memberRoleId;
        this.commandChannelId = runtimeConfig.commandChannelId;
        this.memberCommandChannelId = runtimeConfig.memberCommandChannelId;
        this.eventsTable = runtimeConfig.eventsTable;
        this.reminderIntervals = runtimeConfig.reminderIntervals;
    }

    // Getter methods for controlled access to bot configuration and components
    // These provide a clean interface for other modules to access bot state
    // without exposing the internal structure or allowing direct modification
    getGuildId() { return this.guildId; }
    getRunId() { return this.runId; }
    getModeratorRoleId() { return this.moderatorRoleId; }
    getMemberRoleId() { return this.memberRoleId; }
    getCommandChannelId() { return this.commandChannelId; }
    getMemberCommandChannelId() { return this.memberCommandChannelId; }
    getEventsTable() { return this.eventsTable; }
    getReminderIntervals() { return this.reminderIntervals; }
    
    // Component access methods
    getConfig() { return this.configManager.getConfig(); }
    getConfigManager() { return this.configManager; }
    getProposalManager() { return this.proposalManager; }
    getUserValidator() { return this.userValidator; }
    getEventManager() { return this.eventManager; }

    // Bot state management delegation
    enableBot(botId) { 
        return this.stateController.enableBot(botId); 
    }
    
    disableBot(botId) { 
        return this.stateController.disableBot(botId); 
    }
    
    isBotEnabled(botId) { 
        return this.stateController.isBotEnabled(botId); 
    }
    
    isThisBotEnabled() { 
        return this.stateController.isThisBotEnabled(); 
    }
    
    getBotId() { 
        return this.stateController.getBotId(); 
    }

    /**
     * Cleanup method for graceful shutdown
     */
    async cleanup() {
        await this.componentOrchestrator.cleanup();
        this.client.destroy();
        console.log('✅ DiscordReactionBot cleaned up');
    }
}

module.exports = DiscordReactionBot;