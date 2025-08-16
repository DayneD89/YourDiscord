const DiscordReactionBot = require('./src/DiscordReactionBot');

// Entry point - creates and starts the Discord bot instance
// This separation allows the main bot class to handle all initialization complexity
// while keeping the entry point simple and focused on error handling
const bot = new DiscordReactionBot();
bot.initialize().catch(console.error);