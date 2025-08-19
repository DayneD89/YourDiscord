/**
 * BotControlHandler - Handles bot control commands (enable/disable)
 * Allows administrators to control bot state using run IDs for multiple deployment management
 * This enables blue-green deployments where multiple bot instances can run simultaneously
 * but only one needs to be active at a time
 */
class BotControlHandler {
    constructor(bot) {
        this.bot = bot;
    }

    async handleModeratorCommand(message, member, content) {
        if (content.startsWith('!boton ')) {
            await this.handleBotOn(message, content.substring(7));
        } else if (content.startsWith('!botoff ')) {
            await this.handleBotOff(message, content.substring(8));
        }
    }

    async handleMemberCommand(message, member, content) {
        // Bot control commands are duplicated in member channels to provide flexibility
        // This allows administrators to control bots from either channel context
        if (content.startsWith('!boton ')) {
            await this.handleBotOn(message, content.substring(7));
        } else if (content.startsWith('!botoff ')) {
            await this.handleBotOff(message, content.substring(8));
        }
    }

    async handleBotOn(message, args) {
        try {
            const guild = message.guild;
            const member = guild.members.cache.get(message.author.id);
            
            if (!member) {
                await message.reply('❌ Could not find your membership in this server.');
                return;
            }

            // Restrict to administrators only for security reasons
            // Bot control affects the entire server's functionality and could disrupt operations
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

            // Check if this command is for this bot instance
            const currentRunId = this.bot.getRunId();
            if (runId !== currentRunId) {
                console.log(`Ignoring !boton command for different bot instance. Current: ${currentRunId}, Requested: ${runId}`);
                return; // Silently ignore commands for other bot instances
            }

            // Enable the bot
            this.bot.enableBot(this.bot.getBotId());

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

            // Check if this command is for this bot instance
            const currentRunId = this.bot.getRunId();
            if (runId !== currentRunId) {
                console.log(`Ignoring !botoff command for different bot instance. Current: ${currentRunId}, Requested: ${runId}`);
                return; // Silently ignore commands for other bot instances
            }

            // Disable the bot
            this.bot.disableBot(this.bot.getBotId());

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

module.exports = BotControlHandler;