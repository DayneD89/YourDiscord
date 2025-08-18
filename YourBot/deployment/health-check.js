const http = require("http");
const fs = require("fs");

// Prevent crashes from taking down the health server
process.on('uncaughtException', (error) => {
  console.error('💥 Health server uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Health server unhandled rejection:', reason);
});

let lastHealthCheck = Date.now();
let drainingMessageSent = false;

// Simple health check server with draining detection
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    lastHealthCheck = Date.now();
    
    // Check if main bot process is running
    const healthFile = "/tmp/bot-ready";
    const drainingFile = "/tmp/bot-draining";
    const isReady = fs.existsSync(healthFile);
    const isDraining = fs.existsSync(drainingFile);
    
    // Only log non-200 responses to reduce noise
    if (!isReady || isDraining) {
      console.log(`🏥 Health check: ready=${isReady}, draining=${isDraining}, responding=503`);
    }
    
    if (isReady && !isDraining) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        features: {
          proposals: "active",
          events: "active",
          reactions: "active"
        }
      }));
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        status: isDraining ? "draining" : "starting", 
        timestamp: new Date().toISOString(),
        reason: `ready=${isReady}, draining=${isDraining}`
      }));
    }
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

// Monitor for ALB draining (when health checks stop coming)
setInterval(() => {
  const timeSinceLastCheck = Date.now() - lastHealthCheck;
  const healthFile = "/tmp/bot-ready";
  const drainingFile = "/tmp/bot-draining";
  
  // Debug logging
  const botReady = fs.existsSync(healthFile);
  const alreadyDraining = fs.existsSync(drainingFile);
  
  // Only log when something important is happening
  if (timeSinceLastCheck > 10000 && (timeSinceLastCheck > 15000 || !botReady || alreadyDraining)) {
    console.log(`🔍 Health check status: ready=${botReady}, draining=${alreadyDraining}, lastCheck=${Math.floor(timeSinceLastCheck/1000)}s ago`);
  }
  
  // If bot is ready but we haven't had a health check in 15 seconds, ALB might be draining us
  // (ALB checks every 5s, so missing 3+ checks = 15s = likely draining)
  if (botReady && !alreadyDraining && timeSinceLastCheck > 15000 && !drainingMessageSent) {
    console.log("🔄 No health checks for 15s, likely ALB draining. Triggering early shutdown message...");
    drainingMessageSent = true;
    
    // Create draining file
    fs.writeFileSync(drainingFile, JSON.stringify({
      draining: true,
      timestamp: new Date().toISOString(),
      reason: "No health checks for 15 seconds"
    }));
    
    // Signal main bot process to send shutdown message
    try {
      const { execSync } = require("child_process");
      
      // Try multiple approaches to find the bot process
      let botPid = null;
      
      // First try: look for node bot-enhanced.js
      try {
        botPid = execSync("pgrep -f \"node.*bot-enhanced.js\"", { encoding: "utf8" }).trim();
      } catch (e) {
        console.log("🔍 First attempt failed, trying alternative methods...");
      }
      
      // Second try: look for any node process in the discord-bot directory
      if (!botPid) {
        try {
          const result = execSync("ps aux | grep '[n]ode.*bot-enhanced.js' | awk '{print $2}'", { encoding: "utf8" }).trim();
          if (result) botPid = result;
        } catch (e) {
          console.log("🔍 Second attempt failed...");
        }
      }
      
      // Third try: check if we can find process via systemctl
      if (!botPid) {
        try {
          const result = execSync("systemctl show discord-bot --property MainPID --value", { encoding: "utf8" }).trim();
          if (result && result !== "0") {
            botPid = result;
            console.log(`🔍 Found bot PID via systemctl: ${botPid}`);
          }
        } catch (e) {
          console.log("🔍 Systemctl method failed...");
        }
      }
      
      if (botPid) {
        const pid = parseInt(botPid.split('\n')[0]); // Take first PID if multiple
        console.log(`📡 Sending SIGUSR1 to bot process ${pid}...`);
        
        try {
          process.kill(pid, "SIGUSR1");
          console.log(`✅ Sent SIGUSR1 to main bot process ${pid}`);
          
          // Also create a marker file to track that we sent the signal
          fs.writeFileSync("/tmp/sigusr1-sent", JSON.stringify({
            timestamp: new Date().toISOString(),
            pid: pid,
            reason: "ALB draining detected"
          }));
          
        } catch (error) {
          console.error(`❌ Failed to send SIGUSR1 to process ${pid}:`, error);
        }
        
        // Verify the process still exists after sending signal
        setTimeout(() => {
          try {
            process.kill(pid, 0); // Check if process exists without sending signal
            console.log(`✅ Bot process ${pid} still running after SIGUSR1`);
          } catch (e) {
            console.log(`⚠️ Bot process ${pid} no longer exists`);
          }
        }, 1000);
      } else {
        console.log("❌ Could not find main bot process to signal");
        console.log("🔍 Debug: Listing all processes...");
        try {
          const allProcesses = execSync("ps aux | grep -E '(node|discord|bot)' | grep -v grep", { encoding: "utf8" });
          console.log("📋 All related processes:");
          console.log(allProcesses);
        } catch (e) {
          console.log("❌ Could not list processes for debugging");
        }
      }
    } catch (error) {
      console.error("Failed to signal main bot process:", error);
    }
  }
}, 3000); // Check every 3 seconds for faster detection

server.listen(3000, "0.0.0.0", () => {
  console.log("✅ Health check server running on port 3000");
  console.log(`🔍 Initial file check: /tmp/bot-ready exists = ${fs.existsSync("/tmp/bot-ready")}`);
  
  // Log server activity less frequently and only when needed
  setInterval(() => {
    const timeSinceLastCheck = Math.floor((Date.now() - lastHealthCheck)/1000);
    // Only log if we haven't had checks recently or at startup
    if (timeSinceLastCheck > 20 || process.uptime() < 120) {
      console.log(`🔄 Health server alive, uptime: ${Math.floor(process.uptime())}s, last check: ${timeSinceLastCheck}s ago`);
    }
  }, 60000); // Every 60 seconds
});

server.on('error', (error) => {
  console.error("❌ Health check server error:", error);
  if (error.code === 'EADDRINUSE') {
    console.error("❌ Port 3000 is already in use!");
  }
  process.exit(1);
});