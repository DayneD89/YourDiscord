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

            // Existing config commands
            if (content.startsWith('!addconfig ')) {
                await this.handleAddConfig(message, content.substring(11));
            } else if (content.startsWith('!removeconfig ')) {
                await this.handleRemoveConfig(message, content.substring(14));
            } else if (content === '!viewconfig') {
                await this.handleViewConfig(message);
            }
            // New proposal commands
            else if (content === '!proposals') {
                await this.handleViewProposals(message);
            } else if (content === '!activevotes') {
                await this.handleActiveVotes(message);
            } else if (content.startsWith('!voteinfo ')) {
                await this.handleVoteInfo(message, content.substring(10));
            } else if (content.startsWith('!forcevote ')) {
                await this.handleForceVote(message, content.substring(11));
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

    async handleViewProposals(message) {
        try {
            const allProposals = this.bot.getProposalManager().getAllProposals();
            
            if (allProposals.length === 0) {
                await message.reply('📋 No proposals currently tracked.');
                return;
            }

            let proposalsDisplay = `📋 **All Proposals** (${allProposals.length} items):\n\n`;
            
            allProposals.forEach((proposal, index) => {
                const status = this.getStatusEmoji(proposal.status);
                const author = `<@${proposal.authorId}>`;
                const content = proposal.content.substring(0, 100) + (proposal.content.length > 100 ? '...' : '');
                
                proposalsDisplay += `**${index + 1}.** ${status} ${proposal.status.toUpperCase()}\n`;
                proposalsDisplay += `   👤 ${author}\n`;
                proposalsDisplay += `   📝 ${content}\n`;
                
                if (proposal.status === 'voting') {
                    const timeLeft = this.getTimeLeft(proposal.endTime);
                    proposalsDisplay += `   🗳️ Votes: ✅${proposal.yesVotes} ❌${proposal.noVotes} | ${timeLeft}\n`;
                } else if (proposal.status === 'passed' || proposal.status === 'failed') {
                    proposalsDisplay += `   🗳️ Final: ✅${proposal.finalYes} ❌${proposal.finalNo}\n`;
                }
                proposalsDisplay += '\n';
            });

            // Split message if too long
            if (proposalsDisplay.length > 1900) {
                const chunks = this.splitMessage(proposalsDisplay, 1900);
                for (let i = 0; i < chunks.length; i++) {
                    if (i === 0) {
                        await message.reply(chunks[i]);
                    } else {
                        await message.channel.send(chunks[i]);
                    }
                }
            } else {
                await message.reply(proposalsDisplay);
            }

        } catch (error) {
            console.error('Error viewing proposals:', error);
            await message.reply('❌ An error occurred while retrieving proposals.');
        }
    }

    async handleActiveVotes(message) {
        try {
            const activeVotes = this.bot.getProposalManager().getActiveVotes();
            
            if (activeVotes.length === 0) {
                await message.reply('🗳️ No active votes currently running.');
                return;
            }

            let votesDisplay = `🗳️ **Active Votes** (${activeVotes.length} items):\n\n`;
            
            activeVotes.forEach((vote, index) => {
                const author = `<@${vote.authorId}>`;
                const content = vote.content.substring(0, 150) + (vote.content.length > 150 ? '...' : '');
                const timeLeft = this.getTimeLeft(vote.endTime);
                const voteLink = `https://discord.com/channels/${this.bot.getGuildId()}/${vote.voteChannelId}/${vote.voteMessageId}`;
                
                votesDisplay += `**${index + 1}.** 👤 ${author}\n`;
                votesDisplay += `   📝 ${content}\n`;
                votesDisplay += `   🗳️ Current: ✅${vote.yesVotes} ❌${vote.noVotes}\n`;
                votesDisplay += `   ⏰ ${timeLeft}\n`;
                votesDisplay += `   🔗 [Vote Here](${voteLink})\n\n`;
            });

            await message.reply(votesDisplay);

        } catch (error) {
            console.error('Error viewing active votes:', error);
            await message.reply('❌ An error occurred while retrieving active votes.');
        }
    }

    async handleVoteInfo(message, messageId) {
        try {
            const proposal = this.bot.getProposalManager().getProposal(messageId);
            
            if (!proposal) {
                await message.reply('❌ No proposal found with that message ID.');
                return;
            }

            const status = this.getStatusEmoji(proposal.status);
            const author = `<@${proposal.authorId}>`;
            const timeLeft = proposal.status === 'voting' ? this.getTimeLeft(proposal.endTime) : 'N/A';
            
            let infoDisplay = `📊 **Proposal Information**\n\n`;
            infoDisplay += `**Status:** ${status} ${proposal.status.toUpperCase()}\n`;
            infoDisplay += `**Author:** ${author}\n`;
            infoDisplay += `**Started:** <t:${Math.floor(Date.parse(proposal.startTime) / 1000)}:F>\n`;
            
            if (proposal.status === 'voting') {
                infoDisplay += `**Ends:** <t:${Math.floor(Date.parse(proposal.endTime) / 1000)}:F>\n`;
                infoDisplay += `**Time Left:** ${timeLeft}\n`;
                infoDisplay += `**Current Votes:** ✅${proposal.yesVotes} ❌${proposal.noVotes}\n`;
                const voteLink = `https://discord.com/channels/${this.bot.getGuildId()}/${proposal.voteChannelId}/${proposal.voteMessageId}`;
                infoDisplay += `**Vote Link:** ${voteLink}\n`;
            } else if (proposal.status === 'passed' || proposal.status === 'failed') {
                infoDisplay += `**Completed:** <t:${Math.floor(Date.parse(proposal.completedAt) / 1000)}:F>\n`;
                infoDisplay += `**Final Votes:** ✅${proposal.finalYes} ❌${proposal.finalNo}\n`;
            }
            
            infoDisplay += `\n**Proposal Content:**\n${proposal.content}`;

            await message.reply(infoDisplay);

        } catch (error) {
            console.error('Error getting vote info:', error);
            await message.reply('❌ An error occurred while retrieving vote information.');
        }
    }

    async handleForceVote(message, messageId) {
        try {
            const proposal = this.bot.getProposalManager().getProposal(messageId);
            
            if (!proposal) {
                await message.reply('❌ No proposal found with that message ID.');
                return;
            }

            if (proposal.status !== 'voting') {
                await message.reply('❌ This proposal is not currently in voting status.');
                return;
            }

            // Force end the vote
            proposal.endTime = new Date().toISOString();
            await this.bot.getProposalManager().checkEndedVotes();
            
            await message.reply('✅ Vote has been forcefully ended and processed.');

        } catch (error) {
            console.error('Error forcing vote end:', error);
            await message.reply('❌ An error occurred while forcing the vote to end.');
        }
    }

    async handleHelp(message) {
        const helpText = `**🤖 Bot Commands** (This channel only, requires moderator role):

**Reaction Config Commands:**
\`!addconfig <json>\` - Add a new reaction config
Example: \`!addconfig {"from": "123456789", "action": "✅", "to": "AddRole(user_id,'member')", "unto": "RemoveRole(user_id,'member')"}\`

\`!removeconfig <message_id> <action>\` - Remove a config
Example: \`!removeconfig 123456789 ✅\`

\`!viewconfig\` - View current reaction configuration

**Proposal System Commands:**
\`!proposals\` - View all proposals and their status
\`!activevotes\` - View currently active votes
\`!voteinfo <vote_message_id>\` - Get detailed info about a specific vote
\`!forcevote <vote_message_id>\` - Force end an active vote (emergency use)

\`!help\` - Show this help message

**📝 Config Structure:**
- \`from\`: Message ID to watch for reactions
- \`action\`: Emoji to react with
- \`to\`: Action when reaction is added (optional)
- \`unto\`: Action when reaction is removed (optional)

**⚙️ Available Actions:**
- \`AddRole(user_id,'role_name')\`
- \`RemoveRole(user_id,'role_name')\`

**🗳️ Proposal System:**
The bot automatically monitors:
- <#${this.bot.getDebateChannelId()}> for proposals (5 ✅ reactions moves to vote)
- <#${this.bot.getVoteChannelId()}> for voting (✅/❌ reactions, 7 days)
- <#${this.bot.getResolutionsChannelId()}> for passed proposals

**💾 Note:** All config changes are automatically saved to S3 and persist across restarts.`;

        await message.reply(helpText);
    }

    getStatusEmoji(status) {
        switch (status) {
            case 'voting': return '🗳️';
            case 'passed': return '✅';
            case 'failed': return '❌';
            default: return '📝';
        }
    }

    getTimeLeft(endTime) {
        const now = new Date();
        const end = new Date(endTime);
        const diff = end - now;
        
        if (diff <= 0) return 'Ended';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h left`;
        if (hours > 0) return `${hours}h ${minutes}m left`;
        return `${minutes}m left`;
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