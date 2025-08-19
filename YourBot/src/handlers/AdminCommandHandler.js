/**
 * AdminCommandHandler - Handles administrative commands
 * Provides system information and help commands for debugging and user guidance
 * These utilities help operators monitor bot health and assist users with command syntax
 */
class AdminCommandHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async handleModeratorCommand(message, member, content) {
        if (content === '!ping') {
            await this.handlePing(message);
        } else if (content === '!help') {
            await this.handleModeratorHelp(message);
        }
    }

    async handleMemberCommand(message, member, content) {
        if (content === '!ping') {
            await this.handlePing(message);
        } else if (content === '!help') {
            await this.handleMemberHelp(message);
        }
    }

    async handlePing(message) {
        try {
            const botRunId = this.bot.getRunId();
            const uptime = Math.round(process.uptime());
            const timestamp = new Date().toISOString();
            
            // Gather system metrics for deployment monitoring and troubleshooting
            // These metrics help operators understand bot performance and resource usage
            const nodeVersion = process.version;
            const memoryUsage = process.memoryUsage();
            const memoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
            
            await message.reply(`🏓 **Pong!**

**Deployment Info:**
🆔 **Run ID:** \`${botRunId}\`
⏰ **Started:** ${timestamp}
⚡ **Uptime:** ${uptime}s
💾 **Memory:** ${memoryMB}MB
🟢 **Node.js:** ${nodeVersion}

**Status:** Bot is running and responsive!`);

            console.log(`🏓 Ping command executed by ${message.author.tag} - Run ID: ${botRunId}`);

        } catch (error) {
            console.error('Error handling ping command:', error);
            await message.reply('❌ An error occurred while processing the ping command.');
        }
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
\`!proposals\` - View pending proposals needing support
\`!activevotes\` - View currently active votes  
\`!voteinfo <vote_message_id>\` - Get detailed info about a specific vote

**Event Information:**
\`!events\` - View upcoming events (all regions here, area-specific in regional/local channels)

**Community Information:**
\`!moderators\` - View current server moderators
\`!help\` - Show this help message
${proposalInfo}
**📋 View passed proposals in the resolutions channels**`;

        await message.reply(helpText);
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

**Event Management:**
\`!addevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM | <link>\` - Add new event
\`!quietaddevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM | <link>\` - Add event without notifications
\`!removeevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM\` - Remove an event
Examples: 
- Add: \`!addevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00 | https://facebook.com/events/123\`
- Quiet Add: \`!quietaddevent @London @CentralLondon "Private Meeting" | 2024-08-25 18:00 | https://zoom.us/j/123\`
- Remove: \`!removeevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00\`

**Community Information:**
\`!moderators\` - View current server moderators  
\`!ping\` - Check bot status and deployment info
\`!help\` - Show this help message
${proposalInfo}
**👥 Members can use \`!proposals\`, \`!activevotes\`, and \`!voteinfo\` in their bot channel.**`;

        await message.reply(helpText);
    }
}

module.exports = AdminCommandHandler;