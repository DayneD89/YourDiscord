const ProposalCommandHandler = require('./ProposalCommandHandler');
const EventCommandHandler = require('./EventCommandHandler');
const BotControlHandler = require('./BotControlHandler');
const AdminCommandHandler = require('./AdminCommandHandler');

/**
 * CommandRouter - Routes commands to appropriate domain-specific handlers
 * Replaces the monolithic CommandHandler with a cleaner dispatch system
 */
class CommandRouter {
    constructor(bot) {
        this.bot = bot;
        
        // Initialize domain-specific handlers
        this.proposalHandler = new ProposalCommandHandler(bot);
        this.eventHandler = new EventCommandHandler(bot);
        this.botControlHandler = new BotControlHandler(bot);
        this.adminHandler = new AdminCommandHandler(bot);
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

        // Route to appropriate handler based on command
        if (content.startsWith('!forcevote ') || content.startsWith('!voteinfo ') ||
            content === '!proposals' || content === '!activevotes' || content === '!moderators') {
            await this.proposalHandler.handleModeratorCommand(message, member, content);
        } else if (content.startsWith('!addevent ') || content.startsWith('!removeevent ') ||
                   content === '!events' || content.startsWith('!events ') || content === '!clearevents') {
            await this.eventHandler.handleModeratorCommand(message, member, content);
        } else if (content.startsWith('!boton ') || content.startsWith('!botoff ')) {
            await this.botControlHandler.handleModeratorCommand(message, member, content);
        } else if (content === '!ping' || content === '!help') {
            await this.adminHandler.handleModeratorCommand(message, member, content);
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

        // Route to appropriate handler based on command
        if (content.startsWith('!propose ') || content === '!proposals' || 
            content === '!activevotes' || content === '!moderators' || 
            content.startsWith('!voteinfo ')) {
            await this.proposalHandler.handleMemberCommand(message, member, content);
        } else if (content.startsWith('!addevent ') || content.startsWith('!removeevent ') || 
                   content === '!events' || content.startsWith('!events ') || 
                   content === '!clearevents') {
            await this.eventHandler.handleMemberCommand(message, member, content);
        } else if (content.startsWith('!boton ') || content.startsWith('!botoff ')) {
            await this.botControlHandler.handleMemberCommand(message, member, content);
        } else if (content === '!ping' || content === '!help') {
            await this.adminHandler.handleMemberCommand(message, member, content);
        } else {
            await message.reply('❓ Unknown command. Type `!help` for available commands.');
        }
    }

    // Utility methods used by handlers (moved from original CommandHandler)
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

    calculateTimeRemaining(endTime) {
        const now = Date.now();
        const remaining = endTime - now;
        
        if (remaining <= 0) return 'Voting ended';
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }
}

module.exports = CommandRouter;