const fs = require("fs");

// Load the main bot
const originalBot = require("./bot.js");

// Bot readiness tracking
let botReady = false;
const healthFile = "/tmp/bot-ready";

// Override Discord client ready event to signal readiness
process.on("botReady", () => {
  console.log("🤖 Bot is fully ready and connected to Discord");
  botReady = true;
  
  // Create readiness file for health checks
  fs.writeFileSync(healthFile, JSON.stringify({
    ready: true,
    timestamp: new Date().toISOString(),
    pid: process.pid
  }));
  
  console.log("✅ Health check endpoint will now report ready");
});

// Clean up readiness file on exit
process.on("exit", () => {
  if (fs.existsSync(healthFile)) {
    fs.unlinkSync(healthFile);
  }
});

process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...");
  if (fs.existsSync(healthFile)) {
    fs.unlinkSync(healthFile);
  }
  process.exit(0);
});

console.log("🚀 Enhanced bot launcher starting...");