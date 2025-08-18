const fs = require("fs");

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
  
  console.log(`✅ Health check endpoint will now report ready (file: ${healthFile})`);
  
  // Verify file was actually created
  if (fs.existsSync(healthFile)) {
    console.log("✅ Readiness file confirmed created successfully");
  } else {
    console.error("❌ Failed to create readiness file!");
  }
  
  // Monitor readiness file periodically to detect if it gets removed
  setInterval(() => {
    if (!fs.existsSync(healthFile)) {
      console.error("🚨 Readiness file has disappeared! Recreating...");
      fs.writeFileSync(healthFile, JSON.stringify({
        ready: true,
        timestamp: new Date().toISOString(),
        pid: process.pid,
        recreated: true
      }));
    }
  }, 10000); // Check every 10 seconds
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

// Handle SIGUSR1 signal from health check for ALB draining detection
process.on("SIGUSR1", async () => {
  console.log("🔄 Received SIGUSR1 signal (ALB draining detected) - triggering bot shutdown message...");
  
  // Create a draining file to signal the bot
  const drainingFile = "/tmp/bot-draining";
  fs.writeFileSync(drainingFile, JSON.stringify({
    draining: true,
    timestamp: new Date().toISOString(),
    reason: "ALB draining detected by health check"
  }));
  
  // Emit a custom event that the main bot can listen to
  process.emit('albDraining');
  
  // Also emit earlyShutdown for compatibility
  process.emit('earlyShutdown');
});

console.log("🚀 Enhanced bot launcher starting...");

// Add global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('💥 Stack trace:', error.stack);
  // Don't exit immediately, log and try to continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Promise Rejection at:', promise);
  console.error('💥 Reason:', reason);
  // Don't exit immediately, log and try to continue
});

// Load and start the main bot immediately
console.log("🤖 Loading Discord bot...");
try {
  require('./bot.js');
} catch (error) {
  console.error('💥 Failed to start bot:', error);
  process.exit(1);
}