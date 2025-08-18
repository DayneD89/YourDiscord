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
        } else if (content === '!moderators') {
            await this.handleViewModerators(message);
        } else if (content.startsWith('!addevent ')) {
            await this.handleAddEvent(message, content.substring(10));
        } else if (content.startsWith('!removeevent ')) {
            await this.handleRemoveEvent(message, content.substring(13));
        } else if (content === '!clearevents') {
            await this.handleClearEvents(message);
        } else if (content.startsWith('!boton ')) {
            await this.handleBotOn(message, content.substring(7));
        } else if (content.startsWith('!botoff ')) {
            await this.handleBotOff(message, content.substring(8));
        } else if (content === '!ping') {
            await this.handlePing(message);
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
        } else if (content === '!moderators') {
            await this.handleViewModerators(message);
        } else if (content === '!help') {
            await this.handleMemberHelp(message);
        } else {
            await message.reply('❓ Unknown command. Type `!help` for available commands.');
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
                const progressBar = this.createProgressBar(proposal.supportCount, proposal.requiredSupport, 6);
                
                // Create clickable link to the proposal message
                const messageLink = `https://discord.com/channels/${message.guildId}/${proposal.channelId}/${proposal.messageId}`;
                
                // Extract proposal title from content (first line after the format indicator)
                const lines = proposal.content.split('\n');
                const titleLine = lines[0] || '';
                const titleMatch = titleLine.match(/\*\*(?:Policy|Governance|Moderator|Withdraw)\*\*:\s*(.+)/i);
                let rawTitle = titleMatch ? titleMatch[1] : titleLine;
                
                // Format user mentions properly (convert <@123456> to @username)
                rawTitle = this.formatUserMentions(rawTitle, message.guild);
                
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
                const author = `<@${vote.authorId || vote.author_id}>`;
                
                // Extract title from content
                const lines = (vote.content || '').split('\n');
                const titleLine = lines[0] || '';
                const titleMatch = titleLine.match(/\*\*(?:Policy|Governance|Moderator|Withdraw)\*\*:\s*(.+)/i);
                const title = titleMatch ? titleMatch[1].substring(0, 80) + (titleMatch[1].length > 80 ? '...' : '') : titleLine.substring(0, 80) + (titleLine.length > 80 ? '...' : '');
                
                const timeLeft = this.getTimeLeft(vote.endTime || vote.end_time);
                const voteLink = `https://discord.com/channels/${this.bot.getGuildId()}/${vote.voteChannelId || vote.vote_channel_id}/${vote.voteMessageId || vote.message_id}`;
                const type = vote.proposalType || vote.proposal_type || 'unknown';
                const yesVotes = vote.yesVotes || vote.yes_votes || 0;
                const noVotes = vote.noVotes || vote.no_votes || 0;
                
                const withdrawalIcon = (vote.isWithdrawal || vote.is_withdrawal) ? '🗑️ ' : '';
                
                votesDisplay += `**${index + 1}.** ${withdrawalIcon}**${type.toUpperCase()}** 🗳️\n`;
                votesDisplay += `   👤 ${author}\n`;
                votesDisplay += `   📋 ${title}\n`;
                votesDisplay += `   📊 ✅ **${yesVotes}** vs ❌ **${noVotes}**\n`;
                votesDisplay += `   ⏰ ${timeLeft}\n`;
                votesDisplay += `   🔗 [Vote Here](${voteLink})\n\n`;
            });

            await message.reply(votesDisplay);

        } catch (error) {
            console.error('Error viewing active votes:', error);
            await message.reply('❌ An error occurred while retrieving active votes.');
        }
    }

    async handleViewModerators(message) {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ Could not access guild information.');
                return;
            }

            const moderatorRoleId = this.bot.getModeratorRoleId();
            if (!moderatorRoleId) {
                await message.reply('❌ Moderator role is not configured.');
                return;
            }

            // Get the moderator role
            const moderatorRole = guild.roles.cache.get(moderatorRoleId);
            if (!moderatorRole) {
                await message.reply('❌ Moderator role not found.');
                return;
            }

            // Get all members with the moderator role
            const moderators = moderatorRole.members;
            
            if (moderators.size === 0) {
                await message.reply('👑 **Current Moderators**: None assigned');
                return;
            }

            let moderatorsList = `👑 **Current Moderators** (${moderators.size}):\n\n`;
            
            // Sort moderators by username for consistent display
            const sortedModerators = Array.from(moderators.values()).sort((a, b) => 
                a.user.username.toLowerCase().localeCompare(b.user.username.toLowerCase())
            );
            
            sortedModerators.forEach((member, index) => {
                const onlineStatus = member.presence?.status === 'online' ? '🟢' : 
                                   member.presence?.status === 'idle' ? '🟡' :
                                   member.presence?.status === 'dnd' ? '🔴' : '⚫';
                
                moderatorsList += `**${index + 1}.** ${onlineStatus} ${member.user.tag}\n`;
                moderatorsList += `   📋 <@${member.user.id}>\n`;
                if (member.joinedAt) {
                    moderatorsList += `   📅 Joined: <t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>\n`;
                }
                moderatorsList += '\n';
            });

            // Add information about moderator management if available
            const proposalConfig = this.bot.getProposalManager().proposalConfig;
            if (proposalConfig && proposalConfig.moderator) {
                moderatorsList += `💡 **Want to become a moderator?**\n`;
                moderatorsList += `Post **Add Moderator**: @yourself in <#${proposalConfig.moderator.debateChannelId}>\n\n`;
                moderatorsList += `**Remove a moderator?**\n`;
                moderatorsList += `Post **Remove Moderator**: @username in <#${proposalConfig.moderator.debateChannelId}>`;
            }

            await message.reply(moderatorsList);

        } catch (error) {
            console.error('Error viewing moderators:', error);
            await message.reply('❌ An error occurred while retrieving moderator list.');
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

**Event Management:**
\`!addevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM | <link>\` - Add new event
\`!removeevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM\` - Remove an event
Examples: 
- Add: \`!addevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00 | https://facebook.com/events/123\`
- Remove: \`!removeevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00\`

**Community Information:**
\`!moderators\` - View current server moderators  
\`!ping\` - Check bot status and deployment info
\`!help\` - Show this help message
${proposalInfo}
**👥 Members can use \`!proposals\`, \`!activevotes\`, and \`!voteinfo\` in their bot channel.**`;

        await message.reply(helpText);
    }

    async handleAddEvent(message, eventArgs) {
        try {
            // Parse command arguments: !addevent @RegionRole @LocationRole <name> | <date> | <link>
            // Format: !addevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00 | https://example.com/event
            
            if (!eventArgs.trim()) {
                await message.reply('❌ **Event command format:**\n`!addevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM | <link>`\n\n**Examples:**\n`!addevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00 | https://facebook.com/events/123`\n`!addevent @Wales @Cardiff "Rally" | 2024-08-30 14:00 | https://eventbrite.com/tickets/456`\n\n**Notes:**\n- Use @LocationRole for town/city, or omit if region-wide\n- Link is optional but recommended\n- Roles must exist in the server');
                return;
            }

            // Split by pipes to get main parts
            const parts = eventArgs.split('|').map(part => part.trim());
            if (parts.length < 2) {
                await message.reply('❌ **Invalid format.** Use: `!addevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM | <link>`');
                return;
            }

            const eventDetailsStr = parts[0];
            const dateStr = parts[1];
            const eventLink = parts[2] || '';

            // Parse role mentions and event name
            const roleMentions = eventDetailsStr.match(/<@&(\d+)>/g) || [];
            if (roleMentions.length === 0) {
                await message.reply('❌ **Missing role mentions.** You must mention at least one region role.\n\n**Format:** `@RegionRole @LocationRole "Event Name"`\n**Example:** `@London @CentralLondon "Community Meeting"`');
                return;
            }

            // Extract event name (everything after the last role mention)
            const nameMatch = eventDetailsStr.match(/.*>[\s]*(.+)$/);
            if (!nameMatch) {
                await message.reply('❌ **Missing event name.** Add the event name after the role mentions.\n\n**Example:** `@London @CentralLondon "Community Meeting"`');
                return;
            }

            const eventName = nameMatch[1].replace(/^["']|["']$/g, '').trim();
            if (!eventName) {
                await message.reply('❌ **Event name cannot be empty.**');
                return;
            }

            // Validate and resolve roles
            const guild = message.guild;
            const mentionedRoles = roleMentions.map(mention => {
                const roleId = mention.match(/<@&(\d+)>/)[1];
                return guild.roles.cache.get(roleId);
            }).filter(role => role !== undefined);

            if (mentionedRoles.length !== roleMentions.length) {
                await message.reply('❌ **Some mentioned roles do not exist in this server.** Please use valid role mentions.');
                return;
            }

            // Determine region and location from roles
            // First role is treated as region, second (if exists) as location
            const regionRole = mentionedRoles[0];
            const locationRole = mentionedRoles.length > 1 ? mentionedRoles[1] : null;

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}$/;
            if (!dateRegex.test(dateStr)) {
                await message.reply('❌ **Invalid date format.** Use: `YYYY-MM-DD HH:MM`\n\n**Example:** `2024-08-25 18:00`');
                return;
            }

            // Validate link if provided
            if (eventLink && !this.isValidUrl(eventLink)) {
                await message.reply('❌ **Invalid link format.** Please provide a valid URL starting with http:// or https://\n\n**Example:** `https://facebook.com/events/123456`');
                return;
            }

            // Create event object
            const eventData = {
                name: eventName,
                region: regionRole.name,
                location: locationRole ? locationRole.name : null,
                eventDate: dateStr.trim(),
                link: eventLink || null
            };

            // Create event using EventManager with role objects
            const eventManager = this.bot.getEventManager();
            const event = await eventManager.createEvent(message.guild.id, eventData, message.author, regionRole, locationRole);

            await message.reply(`✅ **Event created successfully!**\n\n**${event.name}**\n📅 **Date:** ${dateStr}\n📍 **Region:** ${regionRole} ${locationRole ? `\n🏘️ **Location:** ${locationRole}` : ''}${event.link ? `\n🔗 **Link:** <${event.link}>` : ''}\n\n🎉 Notifications have been sent to the appropriate channels!\n\n💡 **To remove this event later:** \`!removeevent ${regionRole} ${locationRole ? `${locationRole} ` : ''}"${event.name}" | ${dateStr}\``);

        } catch (error) {
            console.error('Error handling add event command:', error);
            
            // Provide specific error messages for common issues
            if (error.message.includes('Region role')) {
                await message.reply(`❌ **Region validation error:** ${error.message}`);
            } else if (error.message.includes('Location role')) {
                await message.reply(`❌ **Location validation error:** ${error.message}`);
            } else if (error.message.includes('date')) {
                await message.reply('❌ **Date error.** Make sure the date is in the future and uses format `YYYY-MM-DD HH:MM`');
            } else {
                await message.reply('❌ An error occurred while creating the event. Please check the command format and try again.');
            }
        }
    }

    async handleRemoveEvent(message, eventArgs) {
        try {
            if (!eventArgs.trim()) {
                await message.reply('❌ **Event remove command format:**\n`!removeevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM`\n\n**Examples:**\n`!removeevent @London @CentralLondon "Community Meeting" | 2024-08-25 18:00`\n`!removeevent @Wales @Cardiff "Rally" | 2024-08-30 14:00`\n\n**Notes:**\n- Use same format as when you created the event\n- @LocationRole is optional if event is region-wide\n- Must match exactly (including date and time)');
                return;
            }

            // Parse arguments using same logic as handleAddEvent
            const parts = eventArgs.split('|').map(part => part.trim());
            if (parts.length < 2) {
                await message.reply('❌ **Invalid format.** Use pipe `|` to separate event details from date.\n\n**Format:** `@RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM`');
                return;
            }

            const eventDetailsStr = parts[0];
            const dateStr = parts[1];

            // Parse role mentions and event name
            const roleMentions = eventDetailsStr.match(/<@&(\d+)>/g) || [];
            if (roleMentions.length === 0) {
                await message.reply('❌ **Missing role mentions.** You must mention at least one region role.\n\n**Format:** `@RegionRole @LocationRole "Event Name"`');
                return;
            }

            // Extract event name (everything after the last role mention)
            const nameMatch = eventDetailsStr.match(/.*>[\s]*(.+)$/);
            if (!nameMatch) {
                await message.reply('❌ **Missing event name.** Add the event name after the role mentions.');
                return;
            }

            const eventName = nameMatch[1].replace(/^["']|["']$/g, '').trim();
            if (!eventName) {
                await message.reply('❌ **Event name cannot be empty.**');
                return;
            }

            // Validate and resolve roles
            const guild = message.guild;
            const mentionedRoles = roleMentions.map(mention => {
                const roleId = mention.match(/<@&(\d+)>/)[1];
                return guild.roles.cache.get(roleId);
            }).filter(role => role !== undefined);

            if (mentionedRoles.length === 0) {
                await message.reply('❌ **Invalid role mentions.** Please mention valid server roles.');
                return;
            }

            // Parse date
            const parsedDate = new Date(dateStr);
            if (isNaN(parsedDate.getTime())) {
                await message.reply('❌ **Invalid date format.** Use `YYYY-MM-DD HH:MM` format.\n\n**Example:** `2024-08-25 18:00`');
                return;
            }

            // Find matching event
            const guildId = this.bot.getGuildId();
            const allEvents = await this.bot.getEventManager().storage.getAllEvents(guildId, 100);
            
            // Look for event that matches name, date, and roles
            const regionRole = mentionedRoles[0];
            const locationRole = mentionedRoles[1] || null;
            
            const matchingEvent = allEvents.events.find(event => {
                const eventDate = new Date(event.event_date);
                const nameMatches = event.name.toLowerCase() === eventName.toLowerCase();
                const dateMatches = Math.abs(eventDate.getTime() - parsedDate.getTime()) < 60000; // Within 1 minute
                const regionMatches = event.region.toLowerCase() === regionRole.name.toLowerCase();
                const locationMatches = locationRole ? 
                    (event.location && event.location.toLowerCase() === locationRole.name.toLowerCase()) :
                    !event.location;
                
                return nameMatches && dateMatches && regionMatches && locationMatches;
            });

            if (!matchingEvent) {
                await message.reply(`❌ **Event not found.** No event matches the provided details.\n\n**Searched for:**\n📅 **${eventName}**\n🌍 Region: ${regionRole.name}\n${locationRole ? `📍 Location: ${locationRole.name}\n` : ''}⏰ Date: ${dateStr}\n\n💡 **Tips:**\n- Event details must match exactly as when created\n- Check spelling of event name and roles\n- Verify date and time format\n- Use \`!events\` in regional channels to see current events`);
                return;
            }

            // Delete the event
            await this.bot.getEventManager().storage.deleteEvent(guildId, matchingEvent.event_id);

            // Send confirmation
            const eventDate = new Date(matchingEvent.event_date);
            const formattedDate = eventDate.toLocaleDateString('en-GB', {
                weekday: 'long',
                year: 'numeric', 
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            await message.reply(`✅ **Event removed successfully**

**Removed Event:**
📅 **${matchingEvent.name}**
🌍 Region: ${matchingEvent.region}
${matchingEvent.location ? `📍 Location: ${matchingEvent.location}\n` : ''}⏰ Date: ${formattedDate}
🆔 ID: \`${matchingEvent.event_id}\`

The event has been permanently deleted and will no longer appear in event listings or send reminders.`);

            console.log(`🗑️ Event removed by ${message.author.tag}: ${matchingEvent.name} (${matchingEvent.event_id})`);

        } catch (error) {
            console.error('Error handling remove event command:', error);
            await message.reply('❌ An error occurred while removing the event. Please check the command format and try again.');
        }
    }

    async handleClearEvents(message) {
        try {
            const guild = message.guild;
            const member = guild.members.cache.get(message.author.id);
            
            if (!member) {
                await message.reply('❌ Could not find your membership in this server.');
                return;
            }

            // Check if user is administrator (highest permission level)
            if (!member.permissions.has('Administrator')) {
                await message.reply('❌ This command is restricted to administrators only.');
                console.log(`🚨 Non-admin ${message.author.tag} attempted to use !clearevents command`);
                return;
            }

            // Get all events to show count before deletion
            const guildId = this.bot.getGuildId();
            const allEvents = await this.bot.getEventManager().storage.getAllEvents(guildId, 1000);
            const eventCount = allEvents.events.length;
            
            if (eventCount === 0) {
                await message.reply('📅 **No events found** - event list is already empty.');
                return;
            }

            // Delete all events
            let deletedCount = 0;
            for (const event of allEvents.events) {
                try {
                    await this.bot.getEventManager().storage.deleteEvent(guildId, event.event_id);
                    deletedCount++;
                } catch (error) {
                    console.error(`Failed to delete event ${event.event_id}:`, error);
                }
            }

            await message.reply(`🗑️ **Events cleared by administrator**

**Results:**
📊 **Found:** ${eventCount} events
✅ **Deleted:** ${deletedCount} events
${deletedCount < eventCount ? `❌ **Failed:** ${eventCount - deletedCount} events\n` : ''}
👤 **Executed by:** ${message.author.tag}

⚠️ **All event data has been permanently deleted and reminders cancelled.**`);

            console.log(`🗑️ Administrator ${message.author.tag} cleared ${deletedCount}/${eventCount} events`);

        } catch (error) {
            console.error('Error handling clearevents command:', error);
            await message.reply('❌ An error occurred while clearing events.');
        }
    }

    async handlePing(message) {
        try {
            const botRunId = this.bot.getRunId();
            const uptime = Math.round(process.uptime());
            const timestamp = new Date().toISOString();
            
            // Get some system info
            const nodeVersion = process.version;
            const memoryUsage = process.memoryUsage();
            const memoryMB = Math.round(memoryUsage.rss / 1024 / 1024);
            
            await message.reply(`🏓 **Pong!**

**Deployment Info:**
🆔 **Run ID:** \`${botRunId}\` *(use this for !boton/!botoff)*
🤖 **Bot ID:** \`${this.bot.getBotId()}\`
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

    // Helper method to validate URLs
    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
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

    formatUserMentions(text, guild) {
        if (!text || !guild) return text;
        
        // Replace user mentions <@123456> with @username
        return text.replace(/<@!?(\d+)>/g, (match, userId) => {
            const member = guild.members.cache.get(userId);
            return member ? `@${member.displayName}` : match;
        });
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

    async handleBotOn(message, args) {
        try {
            const guild = message.guild;
            const member = guild.members.cache.get(message.author.id);
            
            if (!member) {
                await message.reply('❌ Could not find your membership in this server.');
                return;
            }

            // Check if user is administrator (highest permission level)
            if (!member.permissions.has('Administrator')) {
                await message.reply('❌ This command is restricted to administrators only.');
                console.log(`🚨 Non-admin ${message.author.tag} attempted to use !boton command`);
                return;
            }

            // Validate run ID parameter
            const runId = args.trim();
            if (!runId) {
                await message.reply('❌ Please provide a run ID. Usage: `!boton <run_id>`');
                return;
            }

            // Validate run ID format (alphanumeric string)
            if (!/^[a-zA-Z0-9\-_]+$/.test(runId) || runId.length < 3 || runId.length > 50) {
                await message.reply('❌ Invalid run ID format. Please provide a valid run ID from Terraform.');
                return;
            }

            // Enable the bot
            this.bot.enableBot(runId);

            await message.reply(`✅ **Bot Control Update**
🤖 **Run ID:** \`${runId}\`
🟢 **Status:** Enabled
👤 **Administrator:** ${message.author.tag}

The bot will now respond to all commands normally.`);

            console.log(`✅ Administrator ${message.author.tag} enabled bot ${runId}`);

        } catch (error) {
            console.error('Error handling boton command:', error);
            await message.reply('❌ An error occurred while enabling the bot.');
        }
    }

    async handleBotOff(message, args) {
        try {
            const guild = message.guild;
            const member = guild.members.cache.get(message.author.id);
            
            if (!member) {
                await message.reply('❌ Could not find your membership in this server.');
                return;
            }

            // Check if user is administrator (highest permission level)
            if (!member.permissions.has('Administrator')) {
                await message.reply('❌ This command is restricted to administrators only.');
                console.log(`🚨 Non-admin ${message.author.tag} attempted to use !botoff command`);
                return;
            }

            // Validate run ID parameter
            const runId = args.trim();
            if (!runId) {
                await message.reply('❌ Please provide a run ID. Usage: `!botoff <run_id>`');
                return;
            }

            // Validate run ID format (alphanumeric string)
            if (!/^[a-zA-Z0-9\-_]+$/.test(runId) || runId.length < 3 || runId.length > 50) {
                await message.reply('❌ Invalid run ID format. Please provide a valid run ID from Terraform.');
                return;
            }

            // Disable the bot
            this.bot.disableBot(runId);

            await message.reply(`🔴 **Bot Control Update**
🤖 **Run ID:** \`${runId}\`
🔴 **Status:** Disabled
👤 **Administrator:** ${message.author.tag}

⚠️ The bot will ignore all commands except \`!boton\` and \`!botoff\` until re-enabled.`);

            console.log(`🔴 Administrator ${message.author.tag} disabled bot ${runId}`);

        } catch (error) {
            console.error('Error handling botoff command:', error);
            await message.reply('❌ An error occurred while disabling the bot.');
        }
    }
}

module.exports = CommandHandler;