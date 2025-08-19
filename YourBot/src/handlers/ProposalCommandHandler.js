/**
 * ProposalCommandHandler - Handles all democratic governance commands
 * 
 * Provides interfaces for the community proposal and voting system, enabling democratic
 * decision-making within Discord communities. Supports viewing active governance items,
 * monitoring vote progress, and administrative oversight of the democratic process.
 * 
 * Design rationale:
 * - Transparency: Members can view all active proposals and votes to stay informed
 * - Monitoring: Vote information commands help track democratic engagement
 * - Administrative control: Moderators can force-advance stalled proposals when needed
 * - Educational: Commands provide guidance on proper proposal formats and procedures
 * - Integration: Connects Discord interface with the underlying governance engine
 */
class ProposalCommandHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async handleModeratorCommand(message, member, content) {
        if (content.startsWith('!forcevote ')) {
            await this.handleForceVote(message, content.substring(11));
        } else if (content.startsWith('!voteinfo ')) {
            await this.handleVoteInfo(message, content.substring(10));
        }
    }

    async handleMemberCommand(message, member, content) {
        if (content.startsWith('!propose ')) {
            // The propose command is handled by ProposalManager when message is posted
            await message.reply('💡 To create a proposal, post your message in the debate channel with the proper format. See !help for formats.');
        } else if (content === '!proposals') {
            await this.handleViewProposals(message);
        } else if (content === '!activevotes') {
            await this.handleActiveVotes(message);
        } else if (content === '!moderators') {
            await this.handleViewModerators(message);
        } else if (content.startsWith('!voteinfo ')) {
            await this.handleVoteInfo(message, content.substring(10));
        }
    }

    async handleViewProposals(message) {
        try {
            // Get pending proposals (gathering support) - only show proposals that haven't gone to vote yet
            const pendingProposals = await this.bot.getProposalManager().getPendingProposals();
            
            if (pendingProposals.length === 0) {
                await message.reply('📋 No pending proposals found. Post a proposal in a debate channel to get started!');
                return;
            }

            // Show up to 5 proposals: 3 closest to passing + 2 most recent (if not already included)
            const sortedByProgress = [...pendingProposals].sort((a, b) => {
                const progressA = a.supportCount / a.requiredSupport;
                const progressB = b.supportCount / b.requiredSupport;
                return progressB - progressA; // Highest progress first
            });
            
            const sortedByRecent = [...pendingProposals].sort((a, b) => b.createdAt - a.createdAt);
            
            // Get top 3 closest to passing
            const closestToPass = sortedByProgress.slice(0, 3);
            const closestIds = new Set(closestToPass.map(p => p.messageId));
            
            // Get up to 2 most recent that aren't already in the closest group
            const additionalRecent = sortedByRecent.filter(p => !closestIds.has(p.messageId)).slice(0, 2);
            
            // Combine and limit to 5 total
            const topPending = [...closestToPass, ...additionalRecent].slice(0, 5);
            
            let proposalsDisplay = `📋 **Pending Proposals** (${topPending.length}${pendingProposals.length > 5 ? ` of ${pendingProposals.length}` : ''}):\n\n`;
            
            topPending.forEach((proposal, index) => {
                const withdrawalText = proposal.isWithdrawal ? '🗑️ WITHDRAWAL' : '📝';
                const progress = `${proposal.supportCount}/${proposal.requiredSupport}`;
                const progressBar = this.bot.commandRouter.createProgressBar(proposal.supportCount, proposal.requiredSupport, 6);
                
                // Create clickable link to the proposal message
                const messageLink = `https://discord.com/channels/${message.guildId}/${proposal.channelId}/${proposal.messageId}`;
                
                // Extract proposal title from content (first line after the format indicator)
                const lines = proposal.content.split('\n');
                const titleLine = lines[0] || '';
                const titleMatch = titleLine.match(/\*\*(?:Policy|Governance|Moderator|Withdraw)\*\*:\s*(.+)/i);
                let rawTitle = titleMatch ? titleMatch[1] : titleLine;
                
                // Format user mentions properly (convert <@123456> to @username)
                rawTitle = this.bot.commandRouter.formatUserMentions(rawTitle, message.guild);
                
                const title = rawTitle.substring(0, 60) + (rawTitle.length > 60 ? '...' : '');
                
                proposalsDisplay += `**${index + 1}.** ${withdrawalText} **${proposal.proposalType.toUpperCase()}**\n`;
                proposalsDisplay += `   👤 ${proposal.author.tag}\n`;
                proposalsDisplay += `   📋 [${title}](${messageLink})\n`;
                proposalsDisplay += `   ✅ **${progress}** ${progressBar} (${Math.round((proposal.supportCount/proposal.requiredSupport)*100)}%)\n\n`;
            });

            proposalsDisplay += `💡 **React with ✅ on proposals to show support!**\n`;
            if (pendingProposals.length > 5) {
                proposalsDisplay += `\n📊 *Showing top ${topPending.length} proposals (closest to passing + most recent).*`;
            }

            await message.reply(proposalsDisplay);

        } catch (error) {
            console.error('Error viewing proposals:', error);
            await message.reply('❌ An error occurred while retrieving proposals.');
        }
    }

    async handleActiveVotes(message) {
        try {
            // Fix async issue - await the promise
            const activeVotes = await this.bot.getProposalManager().getActiveVotes();
            
            if (!activeVotes || activeVotes.length === 0) {
                await message.reply('🗳️ No active votes currently running.');
                return;
            }

            let votesDisplay = `🗳️ **Active Votes** (${activeVotes.length} item${activeVotes.length !== 1 ? 's' : ''}):\n\n`;
            
            activeVotes.forEach((vote, index) => {
                const withdrawalText = vote.isWithdrawal ? '🗑️ WITHDRAWAL' : '📝';
                const voteProgress = `${vote.yesCount}✅ / ${vote.noCount}❌`;
                const messageLink = `https://discord.com/channels/${message.guildId}/${vote.channelId}/${vote.messageId}`;
                
                // Extract proposal title from content (first line after the format indicator)
                const lines = vote.content.split('\n');
                const titleLine = lines[0] || '';
                const titleMatch = titleLine.match(/\*\*(?:Policy|Governance|Moderator|Withdraw)\*\*:\s*(.+)/i);
                let rawTitle = titleMatch ? titleMatch[1] : titleLine;
                
                // Format user mentions properly
                rawTitle = this.bot.commandRouter.formatUserMentions(rawTitle, message.guild);
                
                const title = rawTitle.substring(0, 50) + (rawTitle.length > 50 ? '...' : '');
                
                // Calculate time remaining
                const timeRemaining = this.bot.commandRouter.calculateTimeRemaining(vote.voteEndTime);
                
                votesDisplay += `**${index + 1}.** ${withdrawalText} **${vote.proposalType.toUpperCase()}**\n`;
                votesDisplay += `   👤 ${vote.author.tag}\n`;
                votesDisplay += `   📋 [${title}](${messageLink})\n`;
                votesDisplay += `   📊 ${voteProgress} - ⏰ ${timeRemaining}\n\n`;
            });

            votesDisplay += `🗳️ **Vote on proposals using the ✅ and ❌ reactions!**`;
            await message.reply(votesDisplay);

        } catch (error) {
            console.error('Error viewing active votes:', error);
            await message.reply('❌ An error occurred while retrieving active votes.');
        }
    }

    async handleViewModerators(message) {
        try {
            const guild = message.guild;
            const moderatorRoleId = this.bot.getModeratorRoleId();
            const moderatorRole = guild.roles.cache.get(moderatorRoleId);
            
            if (!moderatorRole) {
                await message.reply('❌ Moderator role not found.');
                return;
            }

            // Get all members with the moderator role
            const moderators = moderatorRole.members
                .filter(member => !member.user.bot)
                .map(member => {
                    // Check if they also have admin permissions
                    const hasManageRoles = member.permissions.has('ManageRoles');
                    const hasAdministrator = member.permissions.has('Administrator');
                    const isOwner = member.id === guild.ownerId;
                    
                    let badge = '';
                    if (isOwner) badge = '👑 Owner';
                    else if (hasAdministrator) badge = '⚡ Admin';
                    else if (hasManageRoles) badge = '🔧 Manager';
                    else badge = '🛡️ Mod';
                    
                    return {
                        displayName: member.displayName,
                        username: member.user.username,
                        id: member.id,
                        badge: badge,
                        joinedTimestamp: member.joinedTimestamp
                    };
                })
                .sort((a, b) => {
                    // Sort by role hierarchy: Owner > Admin > Manager > Mod
                    // Then by join date (earliest first)
                    const roleOrder = { '👑': 0, '⚡': 1, '🔧': 2, '🛡️': 3 };
                    const aRole = roleOrder[a.badge.charAt(0)] || 4;
                    const bRole = roleOrder[b.badge.charAt(0)] || 4;
                    
                    if (aRole !== bRole) return aRole - bRole;
                    return (a.joinedTimestamp || 0) - (b.joinedTimestamp || 0);
                });

            if (moderators.length === 0) {
                await message.reply('❌ No moderators found with the specified role.');
                return;
            }

            let moderatorsList = `🛡️ **Server Moderators** (${moderators.length}):\n\n`;
            
            moderators.forEach((mod, index) => {
                moderatorsList += `**${index + 1}.** ${mod.badge} **${mod.displayName}**\n`;
                moderatorsList += `   📝 @${mod.username}\n`;
                if (mod.joinedTimestamp) {
                    const joinedDate = new Date(mod.joinedTimestamp).toLocaleDateString();
                    moderatorsList += `   📅 Joined: ${joinedDate}\n`;
                }
                moderatorsList += '\n';
            });

            moderatorsList += `💡 **Moderators help maintain server order and facilitate governance.**`;
            
            await message.reply(moderatorsList);

        } catch (error) {
            console.error('Error viewing moderators:', error);
            await message.reply('❌ An error occurred while retrieving moderator information.');
        }
    }

    async handleVoteInfo(message, messageId) {
        try {
            if (!messageId) {
                await message.reply('❌ Please provide a message ID. Usage: `!voteinfo <message_id>`');
                return;
            }

            // Clean the message ID (remove any channel/guild prefixes)
            const cleanMessageId = messageId.split('-').pop().split('/').pop().trim();
            
            console.log(`Getting vote info for message ID: ${cleanMessageId}`);
            const voteInfo = await this.bot.getProposalManager().getVoteInfo(cleanMessageId);
            
            if (!voteInfo) {
                await message.reply('❌ Vote not found or not currently active.');
                return;
            }

            // Create detailed vote information display
            const withdrawalText = voteInfo.isWithdrawal ? '🗑️ **WITHDRAWAL VOTE**' : '📝 **PROPOSAL VOTE**';
            const messageLink = `https://discord.com/channels/${message.guildId}/${voteInfo.channelId}/${voteInfo.messageId}`;
            
            // Extract proposal title
            const lines = voteInfo.content.split('\n');
            const titleLine = lines[0] || '';
            const titleMatch = titleLine.match(/\*\*(?:Policy|Governance|Moderator|Withdraw)\*\*:\s*(.+)/i);
            let rawTitle = titleMatch ? titleMatch[1] : titleLine;
            rawTitle = this.bot.commandRouter.formatUserMentions(rawTitle, message.guild);
            
            const timeRemaining = this.bot.commandRouter.calculateTimeRemaining(voteInfo.voteEndTime);
            const totalVotes = voteInfo.yesCount + voteInfo.noCount;
            
            let voteDisplay = `${withdrawalText}\n\n`;
            voteDisplay += `**📋 Proposal:** [${rawTitle}](${messageLink})\n`;
            voteDisplay += `**👤 Author:** ${voteInfo.author.tag}\n`;
            voteDisplay += `**📊 Type:** ${voteInfo.proposalType.toUpperCase()}\n\n`;
            
            voteDisplay += `**🗳️ CURRENT RESULTS:**\n`;
            voteDisplay += `✅ **Yes:** ${voteInfo.yesCount} votes\n`;
            voteDisplay += `❌ **No:** ${voteInfo.noCount} votes\n`;
            voteDisplay += `📊 **Total:** ${totalVotes} votes\n\n`;
            
            if (totalVotes > 0) {
                const yesPercentage = Math.round((voteInfo.yesCount / totalVotes) * 100);
                const noPercentage = Math.round((voteInfo.noCount / totalVotes) * 100);
                voteDisplay += `**📈 Breakdown:** ${yesPercentage}% Yes, ${noPercentage}% No\n`;
            }
            
            voteDisplay += `**⏰ Time Remaining:** ${timeRemaining}\n\n`;
            
            voteDisplay += `🗳️ **Cast your vote on the [original message](${messageLink}) using ✅ and ❌ reactions!**`;
            
            await message.reply(voteDisplay);

        } catch (error) {
            console.error('Error getting vote info:', error);
            await message.reply('❌ An error occurred while retrieving vote information.');
        }
    }

    async handleForceVote(message, messageId) {
        try {
            if (!messageId) {
                await message.reply('❌ Please provide a message ID. Usage: `!forcevote <message_id>`');
                return;
            }

            const cleanMessageId = messageId.split('-').pop().split('/').pop().trim();
            console.log(`Force voting on proposal: ${cleanMessageId}`);
            
            const result = await this.bot.getProposalManager().forceStartVote(cleanMessageId);
            
            if (result.success) {
                await message.reply(`✅ Successfully forced vote to start for proposal: ${cleanMessageId}`);
            } else {
                await message.reply(`❌ Failed to force vote: ${result.error}`);
            }

        } catch (error) {
            console.error('Error forcing vote:', error);
            await message.reply('❌ An error occurred while forcing the vote.');
        }
    }

}

module.exports = ProposalCommandHandler;