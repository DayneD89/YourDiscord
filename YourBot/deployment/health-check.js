const http = require("http");
const fs = require("fs");

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
    
    if (isReady && !isDraining) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }));
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ 
        status: isDraining ? "draining" : "starting", 
        timestamp: new Date().toISOString()
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
  
  // If bot is ready but we haven't had a health check in 45 seconds, ALB might be draining us
  if (fs.existsSync(healthFile) && !fs.existsSync(drainingFile) && timeSinceLastCheck > 45000 && !drainingMessageSent) {
    console.log("🔄 No health checks for 45s, likely ALB draining. Triggering early shutdown message...");
    drainingMessageSent = true;
    
    // Create draining file
    fs.writeFileSync(drainingFile, JSON.stringify({
      draining: true,
      timestamp: new Date().toISOString(),
      reason: "No health checks for 45 seconds"
    }));
    
    // Signal main bot process to send shutdown message
    try {
      // Find the main bot process by looking for the node process running bot-enhanced.js
      const { execSync } = require("child_process");
      const botPid = execSync("pgrep -f \"node bot-enhanced.js\"", { encoding: "utf8" }).trim();
      if (botPid) {
        process.kill(parseInt(botPid), "SIGUSR1");
        console.log("Sent SIGUSR1 to main bot process " + botPid);
      } else {
        console.log("Could not find main bot process to signal");
      }
    } catch (error) {
      console.error("Failed to signal main bot process:", error);
    }
  }
}, 10000); // Check every 10 seconds

server.listen(3000, "0.0.0.0", () => {
  console.log("Health check server running on port 3000");
});