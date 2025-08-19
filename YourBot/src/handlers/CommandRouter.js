const ProposalCommandHandler = require('./ProposalCommandHandler');
const EventCommandHandler = require('./EventCommandHandler');
const BotControlHandler = require('./BotControlHandler');
const AdminCommandHandler = require('./AdminCommandHandler');

/**
 * CommandRouter - Routes commands to appropriate domain-specific handlers
 * 
 * Acts as the central dispatch system for all bot commands, replacing a monolithic approach
 * with cleaner separation of concerns. Each domain (proposals, events, admin) has its own
 * specialized handler, making the codebase more maintainable and testable.
 * 
 * Design rationale:
 * - Channel-based permissions: Commands are allowed/restricted based on the channel they're sent in
 * - Role-based access control: Different commands require different permission levels
 * - Domain separation: Each functional area (governance, events, admin) has its own handler
 * - Consistent error handling: All command routing failures are handled uniformly
 */
class CommandRouter {
    constructor(bot) {
        this.bot = bot;
        
        // Initialize domain-specific handlers for clean separation of concerns
        // Each handler specializes in one functional area to maintain code clarity
        this.proposalHandler = new ProposalCommandHandler(bot);  // Democratic governance commands
        this.eventHandler = new EventCommandHandler(bot);        // Community event management
        this.botControlHandler = new BotControlHandler(bot);     // Bot enable/disable controls
        this.adminHandler = new AdminCommandHandler(bot);       // System administration commands
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

            // Determine user permissions for access control
            // Permission checks are done upfront to fail fast and provide clear feedback
            const isModerator = this.bot.getUserValidator().canUseModerator(member, this.bot.getModeratorRoleId());
            const isMember = this.bot.getUserValidator().hasRole(member, this.bot.getMemberRoleId());

            // Route to appropriate permission level handler
            // Channel context determines which commands are available, providing logical separation
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
        } else if (content.startsWith('!addevent ') || content.startsWith('!quietaddevent ') || 
                   content.startsWith('!removeevent ') || content === '!events' || 
                   content.startsWith('!events ') || content === '!clearevents') {
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