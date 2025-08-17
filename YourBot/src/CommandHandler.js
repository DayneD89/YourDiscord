class CommandHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async handleCommand(message, isModeratorChannel = false) {
        try {
            console.log(`Handling command from ${message.author.tag} in ${isModeratorChannel ? 'moderator' : 'member'} channel`);
            
            const guild = message.guild;
            const member = guild.members.cache.get(message.author.id);

            if (!member) {
                console.log('Member not found in guild cache');
                await message.reply('Error: Could not find your membership in this server.');
                return;
            }

            const content = message.content.trim();
            console.log(`Processing command: "${content}"`);

            // Determine user permissions
            const isModerator = this.bot.getUserValidator().canUseModerator(member, this.bot.getModeratorRoleId());
            const isMember = this.bot.getUserValidator().hasRole(member, this.bot.getMemberRoleId());

            // Handle commands based on channel and permissions
            if (isModeratorChannel) {
                await this.handleModeratorCommand(message, member, content, isModerator);
            } else {
                await this.handleMemberCommand(message, member, content, isMember);
            }

        } catch (error) {
            console.error('Error handling command:', error);
            await message.reply('❌ An error occurred while processing your command.');
        }
    }

    async handleModeratorCommand(message, member, content, isModerator) {
        // Check if user can use moderator commands
        if (!isModerator) {
            await message.reply('❌ You need the moderator role or "Manage Roles" permission to use commands in this channel.');
            return;
        }

        // Moderator-only commands
        if (content.startsWith('!forcevote ')) {
            await this.handleForceVote(message, content.substring(11));
        } else if (content === '!help') {
            await this.handleModeratorHelp(message);
        }
        // Shared commands available to moderators
        else if (content === '!proposals') {
            await this.handleViewProposals(message);
        } else if (content === '!activevotes') {
            await this.handleActiveVotes(message);
        } else if (content.startsWith('!voteinfo ')) {
            await this.handleVoteInfo(message, content.substring(10));
        } else {
            await message.reply('❓ Unknown moderator command. Type `!help` for available commands.');
        }
    }

    async handleMemberCommand(message, member, content, isMember) {
        // Check if user is a member
        if (!isMember) {
            await message.reply('❌ You need the member role to use bot commands.');
            return;
        }

        // Member-accessible commands
        if (content === '!proposals') {
            await this.handleViewProposals(message);
        } else if (content === '!activevotes') {
            await this.handleActiveVotes(message);
        } else if (content.startsWith('!voteinfo ')) {
            await this.handleVoteInfo(message, content.substring(10));
        } else if (content === '!help') {
            await this.handleMemberHelp(message);
        } else {
            await message.reply('❓ Unknown command. Type `!help` for available commands.');
        }
    }


    async handleViewProposals(message) {
        try {
            // Get pending proposals (gathering support) - these are the most relevant
            const pendingProposals = await this.bot.getProposalManager().getPendingProposals();
            
            if (pendingProposals.length === 0) {
                await message.reply('📋 No pending proposals found. Post a proposal in a debate channel to get started!');
                return;
            }

            // Show up to 5 most supported pending proposals
            const topPending = pendingProposals.slice(0, 5);
            let proposalsDisplay = `📋 **Pending Proposals** (${topPending.length} of ${pendingProposals.length} shown):\n\n`;
            
            topPending.forEach((proposal, index) => {
                const withdrawalText = proposal.isWithdrawal ? ' WITHDRAWAL' : '';
                const progress = `${proposal.supportCount}/${proposal.requiredSupport}`;
                const progressBar = this.createProgressBar(proposal.supportCount, proposal.requiredSupport);
                
                // Create clickable link to the proposal message
                const messageLink = `https://discord.com/channels/${message.guildId}/${proposal.channelId}/${proposal.messageId}`;
                
                // Extract and truncate proposal content
                const content = proposal.content.substring(0, 80) + (proposal.content.length > 80 ? '...' : '');
                
                proposalsDisplay += `**${index + 1}.** 📋 ${proposal.proposalType.toUpperCase()}${withdrawalText}\n`;
                proposalsDisplay += `   👤 ${proposal.author.tag}\n`;
                proposalsDisplay += `   📝 [${content}](${messageLink})\n`;
                proposalsDisplay += `   ✅ ${progress} support ${progressBar}\n\n`;
            });

            proposalsDisplay += `💡 **Click the links to view full proposals and add your ✅ reaction to support them!**\n`;
            if (pendingProposals.length > 5) {
                proposalsDisplay += `\n📊 Showing top 5 of ${pendingProposals.length} proposals with reactions.`;
            }

            await message.reply(proposalsDisplay);

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
                const type = vote.proposalType ? ` (${vote.proposalType})` : '';
                
                votesDisplay += `**${index + 1}.** 👤 ${author}${type}\n`;
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
            const type = proposal.proposalType ? ` (${proposal.proposalType})` : '';
            
            let infoDisplay = `📊 **Proposal Information**${type}\n\n`;
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

    async handleModeratorHelp(message) {
        const proposalConfig = this.bot.getProposalManager().proposalConfig;
        
        let proposalInfo = '';
        if (proposalConfig) {
            proposalInfo = '\n**🗳️ Proposal System:**\nThe bot automatically monitors:\n';
            Object.entries(proposalConfig).forEach(([type, config]) => {
                proposalInfo += `- **${type}**: <#${config.debateChannelId}> (${config.supportThreshold} ✅) → <#${config.voteChannelId}> → <#${config.resolutionsChannelId}>\n`;
                proposalInfo += `  Formats: ${config.formats.map(f => `**${f}**:`).join(', ')}\n`;
            });
        }

        const helpText = `**🤖 Moderator Bot Commands**

**Proposal Management:**
\`!proposals\` - View pending proposals needing support
\`!activevotes\` - View currently active votes
\`!voteinfo <vote_message_id>\` - Get detailed info about a specific vote
\`!forcevote <vote_message_id>\` - Force end an active vote (emergency)

\`!help\` - Show this help message
${proposalInfo}
**👥 Members can use \`!proposals\`, \`!activevotes\`, and \`!voteinfo\` in their bot channel.**`;

        await message.reply(helpText);
    }

    async handleMemberHelp(message) {
        const proposalConfig = this.bot.getProposalManager().proposalConfig;
        
        let proposalInfo = '';
        if (proposalConfig) {
            proposalInfo = '\n**🗳️ How to Participate:**\n';
            Object.entries(proposalConfig).forEach(([type, config]) => {
                proposalInfo += `- **${type} proposals**: Post in <#${config.debateChannelId}> using format ${config.formats.map(f => `**${f}**:`).join(' or ')}\n`;
                proposalInfo += `  Need ${config.supportThreshold} ✅ reactions to advance to voting\n`;
            });
            proposalInfo += '\n**Voting**: React ✅ (support) or ❌ (oppose) in vote channels\n';
            
            // Add moderator-specific information if moderator type exists
            if (proposalConfig.moderator) {
                proposalInfo += '\n**👑 Moderator Management:**\n';
                proposalInfo += `- **Request moderator role**: Post in <#${proposalConfig.moderator.debateChannelId}> using **Add Moderator**: @username\n`;
                proposalInfo += `- **Remove moderator role**: Post using **Remove Moderator**: @username\n`;
                proposalInfo += `  Need ${proposalConfig.moderator.supportThreshold} ✅ reactions to advance to voting\n`;
                proposalInfo += '  Passed votes will directly add/remove moderator roles\n';
            }
        }

        const helpText = `**🤖 Member Bot Commands**

**Proposal Information:**
\`!proposals\` - View all proposals and their status
\`!activevotes\` - View currently active votes  
\`!voteinfo <vote_message_id>\` - Get detailed info about a specific vote

\`!help\` - Show this help message
${proposalInfo}
**📋 View passed proposals in the resolutions channels**`;

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

    // Create a visual progress bar for proposal support
    createProgressBar(current, required, length = 8) {
        const filled = Math.min(Math.floor((current / required) * length), length);
        const empty = length - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
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