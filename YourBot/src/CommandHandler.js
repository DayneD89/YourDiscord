class CommandHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async handleCommand(message) {
        try {
            console.log(`Handling command from ${message.author.tag}`);
            
            const guild = message.guild;
            const member = guild.members.cache.get(message.author.id);

            if (!member) {
                console.log('Member not found in guild cache');
                await message.reply('Error: Could not find your membership in this server.');
                return;
            }

            // Check if user can use moderator commands
            if (!this.bot.getUserValidator().canUseModerator(member, this.bot.getModeratorRoleId())) {
                await message.reply('❌ You need the moderator role or "Manage Roles" permission to use bot commands.');
                return;
            }

            const content = message.content.trim();
            console.log(`Processing command: "${content}"`);

            if (content.startsWith('!addconfig ')) {
                await this.handleAddConfig(message, content.substring(11));
            } else if (content.startsWith('!removeconfig ')) {
                await this.handleRemoveConfig(message, content.substring(14));
            } else if (content === '!viewconfig') {
                await this.handleViewConfig(message);
            } else if (content === '!help') {
                await this.handleHelp(message);
            } else {
                await message.reply('❓ Unknown command. Type `!help` for available commands.');
            }

        } catch (error) {
            console.error('Error handling command:', error);
            await message.reply('❌ An error occurred while processing your command.');
        }
    }

    async handleAddConfig(message, configJson) {
        try {
            const newConfig = JSON.parse(configJson);
            await this.bot.getConfigManager().addConfig(newConfig);
            
            console.log('Added new config:', newConfig);
            await message.reply(`✅ Config added successfully! Total configs: ${this.bot.getConfig().length}`);

        } catch (error) {
            console.error('Error adding config:', error);
            if (error instanceof SyntaxError) {
                await message.reply('❌ Invalid JSON format. Please check your config and try again.');
            } else {
                await message.reply(`❌ ${error.message}`);
            }
        }
    }

    async handleRemoveConfig(message, params) {
        try {
            const [messageId, action] = params.split(' ');
            
            if (!messageId || !action) {
                await message.reply('❌ Usage: `!removeconfig <message_id> <action>`');
                return;
            }

            await this.bot.getConfigManager().removeConfig(messageId, action);
            
            console.log(`Removed config for message ${messageId} with action ${action}`);
            await message.reply(`✅ Config removed successfully! Remaining configs: ${this.bot.getConfig().length}`);

        } catch (error) {
            console.error('Error removing config:', error);
            await message.reply(`❌ ${error.message}`);
        }
    }

    async handleViewConfig(message) {
        try {
            const config = this.bot.getConfig();
            
            if (config.length === 0) {
                await message.reply('📋 No configurations currently set.');
                return;
            }

            // Create a formatted display with message links
            let configDisplay = `📋 **Current Configuration** (${config.length} items):\n\n`;
            
            for (let i = 0; i < config.length; i++) {
                const cfg = config[i];
                configDisplay += `**${i + 1}.** React ${cfg.action} on message \`${cfg.from}\`\n`;
                
                // Try to find the channel for this message
                try {
                    const guild = message.guild;
                    let foundChannel = null;
                    
                    // Search through channels to find the message
                    for (const [channelId, channel] of guild.channels.cache) {
                        if (channel.isTextBased()) {
                            try {
                                await channel.messages.fetch(cfg.from);
                                foundChannel = channel;
                                break;
                            } catch (err) {
                                // Message not in this channel, continue searching
                            }
                        }
                    }
                    
                    if (foundChannel) {
                        configDisplay += `   🔗 <https://discord.com/channels/${this.bot.getGuildId()}/${foundChannel.id}/${cfg.from}>\n`;
                    } else {
                        configDisplay += `   📍 Message ID: \`${cfg.from}\` (channel not found)\n`;
                    }
                } catch (err) {
                    configDisplay += `   📍 Message ID: \`${cfg.from}\`\n`;
                }
                
                if (cfg.to) configDisplay += `   ➕ Add: \`${cfg.to}\`\n`;
                if (cfg.unto) configDisplay += `   ➖ Remove: \`${cfg.unto}\`\n`;
                configDisplay += '\n';
            }

            // If the display is too long, fall back to simpler format
            if (configDisplay.length > 1900) {
                let simpleDisplay = `📋 **Current Configuration** (${config.length} items):\n\n`;
                config.forEach((cfg, index) => {
                    simpleDisplay += `**${index + 1}.** Message \`${cfg.from}\` → ${cfg.action}\n`;
                    if (cfg.to) simpleDisplay += `   ➕ \`${cfg.to}\`\n`;
                    if (cfg.unto) simpleDisplay += `   ➖ \`${cfg.unto}\`\n`;
                    simpleDisplay += '\n';
                });
                
                if (simpleDisplay.length > 1900) {
                    // Ultimate fallback to JSON
                    const configText = JSON.stringify(config, null, 2);
                    const chunks = this.splitMessage(configText, 1900);
                    await message.reply(`📋 Current configuration (${config.length} items):`);
                    
                    for (const chunk of chunks) {
                        await message.channel.send(`\`\`\`json\n${chunk}\n\`\`\``);
                    }
                } else {
                    await message.reply(simpleDisplay);
                }
            } else {
                await message.reply(configDisplay);
            }

        } catch (error) {
            console.error('Error viewing config:', error);
            await message.reply('❌ An error occurred while retrieving the config.');
        }
    }

    async handleHelp(message) {
        const helpText = `**🤖 Bot Commands** (This channel only, requires moderator role):

\`!addconfig <json>\` - Add a new reaction config
Example: \`!addconfig {"from": "123456789", "action": "✅", "to": "AddRole(user_id,'member')", "unto": "RemoveRole(user_id,'member')"}\`

\`!removeconfig <message_id> <action>\` - Remove a config
Example: \`!removeconfig 123456789 ✅\`

\`!viewconfig\` - View current configuration

\`!help\` - Show this help message

**📝 Config Structure:**
- \`from\`: Message ID to watch for reactions
- \`action\`: Emoji to react with
- \`to\`: Action when reaction is added (optional)
- \`unto\`: Action when reaction is removed (optional)

**⚙️ Available Actions:**
- \`AddRole(user_id,'role_name')\`
- \`RemoveRole(user_id,'role_name')\`

**💾 Note:** All config changes are automatically saved to S3 and persist across restarts.`;

        await message.reply(helpText);
    }

    splitMessage(text, maxLength) {
        const chunks = [];
        let currentChunk = '';
        const lines = text.split('\n');

        for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxLength) {
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = '';
                }
            }
            currentChunk += (currentChunk ? '\n' : '') + line;
        }

        if (currentChunk) {
            chunks.push(currentChunk);
        }

        return chunks;
    }
}

module.exports = CommandHandler;