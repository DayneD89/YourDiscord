const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;

const ConfigManager = require('./ConfigManager');
const EventHandlers = require('./EventHandlers');
const CommandHandler = require('./CommandHandler');
const UserValidator = require('./UserValidator');
const ProposalManager = require('./ProposalManager');

// Main bot coordinator class - orchestrates all bot components
// Handles Discord client setup, configuration loading, and module initialization
// This class acts as the central hub connecting all specialized modules
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
        this.moderatorRoleId = null;
        this.memberRoleId = null;
        this.commandChannelId = null;
        this.memberCommandChannelId = null;
        
        // Initialize specialized modules - each handles a specific bot responsibility
        // This separation keeps concerns isolated and makes the code more maintainable
        this.configManager = new ConfigManager();        // S3-backed reaction configuration
        this.userValidator = new UserValidator();        // Permission and eligibility checks
        this.proposalManager = new ProposalManager(this); // Community governance system
        this.eventHandlers = new EventHandlers(this);    // Discord event processing
        this.commandHandler = new CommandHandler(this);   // Bot command execution
        
        this.setupEventHandlers();
    }

    async initialize() {
        try {
            // Load runtime configuration created during deployment
            // This file contains Discord IDs, tokens, and channel mappings specific to this deployment
            console.log('Loading runtime configuration...');
            const runtimeConfig = JSON.parse(await fs.readFile('runtime.config.json', 'utf8'));
            
            // Extract Discord-specific configuration values
            // These IDs are unique to each Discord server and deployment
            this.guildId = runtimeConfig.guildId;
            this.botToken = runtimeConfig.botToken;
            this.moderatorRoleId = runtimeConfig.moderatorRoleId;
            this.memberRoleId = runtimeConfig.memberRoleId;
            this.commandChannelId = runtimeConfig.commandChannelId;
            this.memberCommandChannelId = runtimeConfig.memberCommandChannelId;

            console.log(`Guild ID: ${this.guildId}`);
            console.log(`Moderator Command Channel ID: ${this.commandChannelId}`);
            console.log(`Member Command Channel ID: ${this.memberCommandChannelId}`);
            console.log(`Proposal config loaded with types:`, Object.keys(runtimeConfig.proposalConfig || {}));

            // Initialize S3-backed configuration manager
            // Reaction configurations are stored in S3 for persistence across deployments
            await this.configManager.initialize(
                runtimeConfig.s3Bucket,
                this.guildId,
                runtimeConfig.config
            );

            // Initialize community proposal/voting system
            // This enables democratic governance features for the community
            await this.proposalManager.initialize(
                runtimeConfig.s3Bucket,
                this.guildId,
                runtimeConfig.proposalConfig
            );

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

    setupEventHandlers() {
        // 'ready' event fires once when bot successfully connects and is operational
        // This is the ideal place for startup tasks and status verification
        this.client.once('ready', async () => {
            console.log(`Bot logged in as ${this.client.user.tag}`);
            console.log(`Monitoring guild: ${this.guildId}`);
            console.log(`Moderator command channel: ${this.commandChannelId}`);
            console.log(`Member command channel: ${this.memberCommandChannelId}`);
            console.log(`Moderator role ID: ${this.moderatorRoleId}`);
            console.log(`Member role ID: ${this.memberRoleId}`);
            
            // Display current proposal system configuration for verification
            // This helps administrators confirm the bot is monitoring the right channels
            if (this.proposalManager.proposalConfig) {
                console.log('Proposal types configured:');
                Object.entries(this.proposalManager.proposalConfig).forEach(([type, config]) => {
                    console.log(`  ${type}: ${config.supportThreshold} reactions, ${config.voteDuration}ms duration`);
                    console.log(`    Debate: ${config.debateChannelId}, Vote: ${config.voteChannelId}, Resolutions: ${config.resolutionsChannelId}`);
                });
            }
            
            const currentConfig = this.configManager.getConfig();
            console.log(`Reaction configurations loaded: ${currentConfig.length}`);
            
            const activeVotes = this.proposalManager.getActiveVotes();
            console.log(`Active votes: ${activeVotes.length}`);
            
            if (currentConfig.length > 0) {
                console.log('Current reaction configurations:');
                currentConfig.forEach((cfg, index) => {
                    console.log(`  ${index + 1}: Message ${cfg.from}, Action ${cfg.action}`);
                });
                
                // Pre-cache messages to ensure reaction events work immediately
                // Discord requires messages to be cached before reaction events fire reliably
                await this.preCacheMessages(currentConfig);
            }

            // Pre-cache active vote messages to ensure voting continues properly
            // This is crucial for maintaining voting integrity across bot restarts
            if (activeVotes.length > 0) {
                console.log('Pre-caching active vote messages...');
                await this.preCacheVoteMessages(activeVotes);
            }
        });

        // Core Discord event handlers - delegate to specialized modules for processing
        // This keeps the main bot class focused on coordination rather than implementation
        
        this.client.on('messageReactionAdd', (reaction, user) => {
            this.eventHandlers.handleReactionAdd(reaction, user);
        });

        this.client.on('messageReactionRemove', (reaction, user) => {
            this.eventHandlers.handleReactionRemove(reaction, user);
        });

        this.client.on('messageCreate', (message) => {
            this.eventHandlers.handleMessage(message);
        });

        // Error handling for Discord connection issues
        // These events help track bot health and connectivity problems
        this.client.on('error', (error) => {
            console.error('Discord client error:', error);
        });

        this.client.on('warn', (warning) => {
            console.warn('Discord client warning:', warning);
        });

        // Graceful shutdown handlers for clean deployments
        // These ensure the bot disconnects properly and doesn't leave hanging connections
        process.on('SIGINT', () => {
            console.log('Shutting down...');
            this.client.destroy();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('Received SIGTERM, shutting down...');
            this.client.destroy();
            process.exit(0);
        });
    }

    // Getter methods for controlled access to bot configuration and components
    // These provide a clean interface for other modules to access bot state
    // without exposing the internal structure or allowing direct modification
    getGuildId() { return this.guildId; }
    getModeratorRoleId() { return this.moderatorRoleId; }
    getMemberRoleId() { return this.memberRoleId; }
    getCommandChannelId() { return this.commandChannelId; }
    getMemberCommandChannelId() { return this.memberCommandChannelId; }
    getConfig() { return this.configManager.getConfig(); }
    getConfigManager() { return this.configManager; }
    getProposalManager() { return this.proposalManager; }
    getUserValidator() { return this.userValidator; }

    // Pre-cache messages that we're monitoring for reactions
    // Discord requires messages to be in cache before reaction events will fire properly
    // This prevents missed reactions on bot restart and ensures reliable role assignment
    async preCacheMessages(config) {
        console.log('🔄 Pre-caching monitored messages...');
        const guild = this.client.guilds.cache.get(this.guildId);
        
        if (!guild) {
            console.log('❌ Guild not found for pre-caching');
            return;
        }

        // Extract unique message IDs to avoid fetching the same message multiple times
        // Multiple configs might reference the same message with different reactions
        const uniqueMessageIds = [...new Set(config.map(cfg => cfg.from))];
        console.log(`Found ${uniqueMessageIds.length} unique messages to cache from ${config.length} configs`);

        for (const messageId of uniqueMessageIds) {
            let messageFound = false;

            console.log(`🔍 Searching for message ${messageId}...`);

            // Search through all text channels since we don't know which channel contains each message
            // This brute-force approach is necessary because message IDs don't encode channel information
            for (const [channelId, channel] of guild.channels.cache) {
                if (channel.isTextBased()) {
                    try {
                        const message = await channel.messages.fetch(messageId);
                        if (message) {
                            console.log(`✅ Cached message ${messageId} from #${channel.name}`);
                            messageFound = true;
                            break;
                        }
                    } catch (err) {
                        // Message not in this channel, continue searching
                    }
                }
            }

            if (!messageFound) {
                console.log(`⚠️  Message ${messageId} not found in any channel`);
            }
        }
        
        console.log('✅ Pre-caching complete');
    }

    // Pre-cache active vote messages to maintain voting functionality across restarts
    // Vote messages must be cached for reaction counting and vote processing to work properly
    async preCacheVoteMessages(activeVotes) {
        const guild = this.client.guilds.cache.get(this.guildId);
        
        if (!guild) {
            console.log('❌ Guild not found for vote pre-caching');
            return;
        }

        // Cache each active vote message so the bot can continue processing votes
        // This is essential for democracy to function across bot deployments
        for (const vote of activeVotes) {
            try {
                const voteChannel = guild.channels.cache.get(vote.voteChannelId);
                if (voteChannel) {
                    await voteChannel.messages.fetch(vote.voteMessageId);
                    console.log(`✅ Cached vote message ${vote.voteMessageId}`);
                }
            } catch (error) {
                console.log(`⚠️  Could not cache vote message ${vote.voteMessageId}`);
            }
        }
    }
}

module.exports = DiscordReactionBot;