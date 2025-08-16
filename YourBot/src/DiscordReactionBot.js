const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs').promises;

const ConfigManager = require('./ConfigManager');
const EventHandlers = require('./EventHandlers');
const CommandHandler = require('./CommandHandler');
const UserValidator = require('./UserValidator');
const ProposalManager = require('./ProposalManager');

class DiscordReactionBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers
            ]
        });

        // Bot configuration
        this.config = null;
        this.guildId = null;
        this.botToken = null;
        this.moderatorRoleId = null;
        this.memberRoleId = null;
        this.commandChannelId = null;
        this.memberCommandChannelId = null;
        
        // Initialize managers
        this.configManager = new ConfigManager();
        this.userValidator = new UserValidator();
        this.proposalManager = new ProposalManager(this);
        this.eventHandlers = new EventHandlers(this);
        this.commandHandler = new CommandHandler(this);
        
        this.setupEventHandlers();
    }

    async initialize() {
        try {
            // Load runtime config
            console.log('Loading runtime configuration...');
            const runtimeConfig = JSON.parse(await fs.readFile('runtime.config.json', 'utf8'));
            
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

            // Initialize config manager
            await this.configManager.initialize(
                runtimeConfig.s3Bucket,
                this.guildId,
                runtimeConfig.config
            );

            // Initialize proposal manager
            await this.proposalManager.initialize(
                runtimeConfig.s3Bucket,
                this.guildId,
                runtimeConfig.proposalConfig
            );

            // Login to Discord
            console.log('Logging into Discord...');
            await this.client.login(this.botToken);
            console.log('Bot initialized successfully');
        } catch (error) {
            console.error('Failed to initialize bot:', error);
            process.exit(1);
        }
    }

    setupEventHandlers() {
        this.client.once('ready', async () => {
            console.log(`Bot logged in as ${this.client.user.tag}`);
            console.log(`Monitoring guild: ${this.guildId}`);
            console.log(`Moderator command channel: ${this.commandChannelId}`);
            console.log(`Member command channel: ${this.memberCommandChannelId}`);
            console.log(`Moderator role ID: ${this.moderatorRoleId}`);
            console.log(`Member role ID: ${this.memberRoleId}`);
            
            // Log proposal configuration
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
                
                // Pre-cache messages to ensure reaction events work
                await this.preCacheMessages(currentConfig);
            }

            // Pre-cache vote messages
            if (activeVotes.length > 0) {
                console.log('Pre-caching active vote messages...');
                await this.preCacheVoteMessages(activeVotes);
            }
        });

        this.client.on('messageReactionAdd', (reaction, user) => {
            this.eventHandlers.handleReactionAdd(reaction, user);
        });

        this.client.on('messageReactionRemove', (reaction, user) => {
            this.eventHandlers.handleReactionRemove(reaction, user);
        });

        this.client.on('messageCreate', (message) => {
            this.eventHandlers.handleMessage(message);
        });

        this.client.on('error', (error) => {
            console.error('Discord client error:', error);
        });

        this.client.on('warn', (warning) => {
            console.warn('Discord client warning:', warning);
        });

        // Graceful shutdown
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

    // Getter methods for other modules
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
    async preCacheMessages(config) {
        console.log('🔄 Pre-caching monitored messages...');
        const guild = this.client.guilds.cache.get(this.guildId);
        
        if (!guild) {
            console.log('❌ Guild not found for pre-caching');
            return;
        }

        // Get unique message IDs to avoid duplicates
        const uniqueMessageIds = [...new Set(config.map(cfg => cfg.from))];
        console.log(`Found ${uniqueMessageIds.length} unique messages to cache from ${config.length} configs`);

        for (const messageId of uniqueMessageIds) {
            let messageFound = false;

            console.log(`🔍 Searching for message ${messageId}...`);

            // Search through all text channels
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
                        // Message not in this channel, continue
                    }
                }
            }

            if (!messageFound) {
                console.log(`⚠️  Message ${messageId} not found in any channel`);
            }
        }
        
        console.log('✅ Pre-caching complete');
    }

    async preCacheVoteMessages(activeVotes) {
        const guild = this.client.guilds.cache.get(this.guildId);
        
        if (!guild) {
            console.log('❌ Guild not found for vote pre-caching');
            return;
        }

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