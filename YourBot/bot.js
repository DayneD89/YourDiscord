const DiscordReactionBot = require('./src/DiscordReactionBot');

// Initialize and start the bot
const bot = new DiscordReactionBot();
bot.initialize().catch(console.error);