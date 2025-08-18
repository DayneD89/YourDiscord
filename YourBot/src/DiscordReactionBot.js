const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;

const ConfigManager = require('./ConfigManager');
const EventHandlers = require('./EventHandlers');
const CommandHandler = require('./CommandHandler');
const UserValidator = require('./UserValidator');
const ProposalManager = require('./ProposalManager');
const EventManager = require('./EventManager');

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
        
        // Flag to prevent duplicate shutdown messages
        this.shutdownMessageSent = false;
        
        // Bot enable/disable state tracking (Map of bot_id -> enabled status)
        this.botStates = new Map();
        
        // Initialize specialized modules - each handles a specific bot responsibility
        // This separation keeps concerns isolated and makes the code more maintainable
        this.configManager = new ConfigManager();        // S3-backed reaction configuration
        this.userValidator = new UserValidator();        // Permission and eligibility checks
        this.proposalManager = new ProposalManager(this); // Community governance system
        this.eventHandlers = new EventHandlers(this);    // Discord event processing
        this.commandHandler = new CommandHandler(this);   // Bot command execution
        this.eventManager = null;                         // Event system (initialized later with config)
        
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
            this.runId = runtimeConfig.runId || 'unknown';
            this.moderatorRoleId = runtimeConfig.moderatorRoleId;
            this.memberRoleId = runtimeConfig.memberRoleId;
            this.commandChannelId = runtimeConfig.commandChannelId;
            this.memberCommandChannelId = runtimeConfig.memberCommandChannelId;

            console.log(`Guild ID: ${this.guildId}`);
            console.log(`Bot Run ID: ${this.runId}`);
            console.log(`Moderator Command Channel ID: ${this.commandChannelId}`);
            console.log(`Member Command Channel ID: ${this.memberCommandChannelId}`);
            console.log(`Proposal config loaded with types:`, Object.keys(runtimeConfig.proposalConfig || {}));

            // Initialize launch-time reaction role configuration
            // Reaction role configurations are provided via runtime config and stored in memory only
            this.configManager.initialize(runtimeConfig.reactionRoleConfig || []);

            // Initialize community proposal/voting system with DynamoDB storage
            // This enables democratic governance features with hybrid storage approach
            await this.proposalManager.initialize(
                runtimeConfig.dynamodbTable,
                this.guildId,
                runtimeConfig.proposalConfig
            );

            // Initialize event management system with DynamoDB storage
            // This enables community event planning and notification features
            this.eventsTable = runtimeConfig.eventsTable;
            this.reminderIntervals = runtimeConfig.reminderIntervals;
            if (!this.reminderIntervals) {
                console.error('❌ Reminder intervals not configured in runtime config');
                process.exit(1);
            }
            this.eventManager = new EventManager(this);
            console.log(`Event management system initialized with table: ${runtimeConfig.eventsTable}`);
            console.log(`Reminder intervals: ${this.reminderIntervals.weekReminder/60000}min, ${this.reminderIntervals.dayReminder/60000}min`);

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
            
            const activeVotes = await this.proposalManager.getActiveVotes();
            console.log(`Active votes: ${activeVotes.length}`);
            
            if (currentConfig.length > 0) {
                console.log('Current reaction configurations:');
                currentConfig.forEach((cfg, index) => {
                    console.log(`  ${index + 1}: Message ${cfg.from}, Action ${cfg.action}`);
                });
                
                // Pre-cache messages to ensure reaction events work immediately
                // Discord requires messages to be cached before reaction events fire reliably
                console.log('🔄 Pre-caching reaction messages...');
                await this.preCacheMessages(currentConfig);
                console.log('✅ Message pre-caching completed');
            }

            // Pre-cache active vote messages to ensure voting continues properly
            // This is crucial for maintaining voting integrity across bot restarts
            if (activeVotes.length > 0) {
                console.log('🔄 Pre-caching active vote messages...');
                await this.preCacheVoteMessages(activeVotes);
                console.log('✅ Vote message pre-caching completed');
            }

            // Post deployment confirmation message to moderator bot channel
            // Helps confirm new deployments are successful and bot is fully operational
            await this.postDeploymentConfirmation();

            // Signal to enhanced wrapper that bot is fully ready
            // This triggers health check readiness and deployment completion
            process.emit('botReady');

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
        // Skip in test environment to prevent MaxListenersExceededWarning
        if (process.env.NODE_ENV !== 'test') {
            process.on('SIGINT', async () => {
                console.log('Shutting down...');
                await this.postShutdownMessage('Manual shutdown (SIGINT)');
                this.client.destroy();
                process.exit(0);
            });

            process.on('SIGTERM', async () => {
                console.log('🔄 Received SIGTERM, shutting down...');
                await this.postShutdownMessage('Instance termination (SIGTERM)');
                this.client.destroy();
                process.exit(0);
            });

            // Consolidated ALB draining detection - all paths lead to this handler
            let drainingHandled = false;
            const handleDraining = async (source) => {
                const timestamp = new Date().toISOString();
                console.log(`🔄 [${timestamp}] ALB draining signal received from ${source}`);
                if (drainingHandled) {
                    console.log(`🔄 ALB draining already handled, ignoring ${source} signal`);
                    return;
                }
                drainingHandled = true;
                console.log(`🔄 ALB draining detected from ${source}, sending shutdown message...`);
                
                try {
                    await this.postShutdownMessage('Instance draining (ALB health checks stopped)');
                    console.log(`✅ Shutdown message sent successfully from ${source}`);
                } catch (error) {
                    console.error(`❌ Failed to send shutdown message from ${source}:`, error);
                }
                // Don't destroy client yet, just send the message
            };

            // Multiple ways the draining can be detected, but one handler
            process.on('earlyShutdown', () => handleDraining('earlyShutdown'));
            process.on('SIGUSR1', () => handleDraining('SIGUSR1'));
            process.on('albDraining', () => handleDraining('albDraining'));
        }
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
    getConfig() { return this.configManager.getConfig(); }
    getConfigManager() { return this.configManager; }
    getProposalManager() { return this.proposalManager; }
    getUserValidator() { return this.userValidator; }
    getEventManager() { return this.eventManager; }
    getEventsTable() { return this.eventsTable; }
    getReminderIntervals() { return this.reminderIntervals; }

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

    // Post a brief confirmation message to moderator bot channel after successful startup
    // Provides sanity check that new deployment is online and fully operational
    async postDeploymentConfirmation() {
        try {
            console.log(`🔍 Attempting to post deployment confirmation...`);
            console.log(`🔍 Guild ID: ${this.guildId}`);
            console.log(`🔍 Command Channel ID: ${this.commandChannelId}`);
            
            const guild = this.client.guilds.cache.get(this.guildId);
            if (!guild) {
                console.error(`❌ Guild not found for deployment confirmation. Guild ID: ${this.guildId}`);
                console.error(`❌ Available guilds: ${Array.from(this.client.guilds.cache.keys()).join(', ')}`);
                return;
            }
            console.log(`✅ Found guild: ${guild.name} (${guild.id})`);

            const modBotChannel = guild.channels.cache.get(this.commandChannelId);
            if (!modBotChannel) {
                console.error(`❌ Moderator bot channel not found. Channel ID: ${this.commandChannelId}`);
                console.error(`❌ Available channels in guild:`);
                guild.channels.cache.forEach(channel => {
                    console.error(`   - ${channel.name} (${channel.id}) - Type: ${channel.type}`);
                });
                return;
            }
            console.log(`✅ Found channel: ${modBotChannel.name} (${modBotChannel.id})`);

            // Check bot permissions in the channel
            const botMember = guild.members.cache.get(this.client.user.id);
            if (!botMember) {
                console.error(`❌ Bot member not found in guild`);
                return;
            }
            
            const permissions = modBotChannel.permissionsFor(botMember);
            if (!permissions.has('SendMessages')) {
                console.error(`❌ Bot does not have SendMessages permission in ${modBotChannel.name}`);
                console.error(`❌ Bot permissions: ${permissions.toArray().join(', ')}`);
                return;
            }
            console.log(`✅ Bot has SendMessages permission in ${modBotChannel.name}`);

            const timestamp = new Date().toISOString();
            const startupTime = Math.round(process.uptime());
            const confirmationMessage = `🤖 **Bot ${this.runId} Online** - New version deployed and ready\n⏰ ${timestamp}\n⚡ Startup: ${startupTime}s`;

            await modBotChannel.send(confirmationMessage);
            console.log(`✅ Posted deployment confirmation to ${modBotChannel.name} channel`);
            
        } catch (error) {
            console.error('❌ Error posting deployment confirmation:', error);
            console.error('❌ Error stack:', error.stack);
        }
    }

    // Post a brief shutdown message to moderator bot channel before terminating
    // Provides visibility when instances are being replaced during deployments
    async postShutdownMessage(reason) {
        // Prevent duplicate shutdown messages
        if (this.shutdownMessageSent) {
            console.log(`🔄 Shutdown message already sent, skipping duplicate for: ${reason}`);
            return;
        }
        
        console.log(`🔄 Attempting to send shutdown message for: ${reason}`);
        
        try {
            // Set a timeout to ensure we don't block shutdown too long
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => 
                timeoutId = setTimeout(() => reject(new Error('Shutdown message timeout')), 5000)
            );

            const messagePromise = this.sendShutdownMessage(reason);
            
            // Race between sending message and timeout
            try {
                await Promise.race([messagePromise, timeoutPromise]);
                // Only set flag after successful send
                this.shutdownMessageSent = true;
                console.log(`✅ Shutdown message sent successfully for: ${reason}`);
            } finally {
                // Always clear the timeout to prevent Jest hanging
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error posting shutdown message for ${reason}:`, error);
            // Don't set the flag if sending failed, so we can retry
            // Don't block shutdown even if message fails
        }
    }

    async sendShutdownMessage(reason) {
        console.log(`🔄 sendShutdownMessage called with reason: ${reason}`);
        
        const guild = this.client.guilds.cache.get(this.guildId);
        if (!guild) {
            console.log(`❌ Guild not found for shutdown message. Guild ID: ${this.guildId}`);
            return;
        }
        console.log(`✅ Found guild: ${guild.name} (${guild.id})`);

        const modBotChannel = guild.channels.cache.get(this.commandChannelId);
        if (!modBotChannel) {
            console.log(`❌ Moderator bot channel ${this.commandChannelId} not found`);
            console.log(`❌ Available channels: ${guild.channels.cache.map(ch => `${ch.name}(${ch.id})`).join(', ')}`);
            return;
        }
        console.log(`✅ Found moderator channel: ${modBotChannel.name} (${modBotChannel.id})`);

        const timestamp = new Date().toISOString();
        const uptime = Math.round(process.uptime());
        const shutdownMessage = `🔄 **Bot ${this.runId} Shutting Down** - ${reason}\n⏰ ${timestamp}\n⚡ Uptime: ${uptime}s`;

        console.log(`🔄 Attempting to send shutdown message: ${shutdownMessage.replace(/\n/g, ' | ')}`);
        
        try {
            await modBotChannel.send(shutdownMessage);
            console.log(`✅ Posted shutdown message to moderator bot channel successfully`);
        } catch (error) {
            console.error(`❌ Failed to send shutdown message to channel:`, error);
            throw error; // Re-throw so the calling function knows it failed
        }
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

}

module.exports = DiscordReactionBot;