#!/bin/bash
set -euxo pipefail

# =============================================================================
# DISCORD BOT DEPLOYMENT WITH HEALTH CHECKS
# =============================================================================
# Enhanced deployment script with application readiness monitoring
# for zero-downtime deployments
# =============================================================================

# Code version: ${code_hash}
# This comment ensures that user_data changes when code changes

# Log everything from this script
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=== Starting Discord bot deployment at $(date) ==="
echo "Code version: ${code_hash}"
echo "Network: ${network_type} subnet"
echo "Will log to CloudWatch Logs group: /ec2/${name}-logs"

# -----------------------------------------------------------------------------
# SYSTEM SETUP
# -----------------------------------------------------------------------------

echo "Installing Node.js and required packages..."
yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs unzip amazon-cloudwatch-agent

# Verify Node.js installation
node --version
npm --version

# Create application directory
echo "Creating application directory..."
mkdir -p /opt/discord-bot
cd /opt/discord-bot

# -----------------------------------------------------------------------------
# APPLICATION DEPLOYMENT
# -----------------------------------------------------------------------------

echo "Downloading bot code from S3..."
aws s3 cp s3://${s3_bucket}/${s3_key} ./discord-bot.zip

echo "Extracting bot code..."
unzip -o discord-bot.zip
rm -f discord-bot.zip

echo "Installing npm dependencies..."
npm install

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

echo "Creating runtime configuration..."
cat > runtime.config.json <<JSON
{
  "guildId": "${guild_id}",
  "botToken": "${bot_token}",
  "moderatorRoleId": "${moderator_role_id}",
  "memberRoleId": "${member_role_id}",
  "commandChannelId": "${command_channel_id}",
  "memberCommandChannelId": "${member_command_channel_id}",
  "proposalConfig": ${proposalConfig},
  "s3Bucket": "${s3_bucket}",
  "config": ${config}
}
JSON

# -----------------------------------------------------------------------------
# HEALTH CHECK ENDPOINT
# -----------------------------------------------------------------------------

echo "Creating health check endpoint..."
cat > health-check.js <<'EOF'
const http = require('http');
const fs = require('fs');

// Simple health check server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Check if main bot process is running
    const healthFile = '/tmp/bot-ready';
    const isReady = fs.existsSync(healthFile);
    
    if (isReady) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'starting', 
        timestamp: new Date().toISOString()
      }));
    }
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Health check server running on port 3000');
});
EOF

# -----------------------------------------------------------------------------
# ENHANCED BOT SCRIPT WITH READINESS SIGNAL
# -----------------------------------------------------------------------------

echo "Creating enhanced bot launcher..."
cat > bot-enhanced.js <<'EOF'
const fs = require('fs');

// Load the main bot
const originalBot = require('./bot.js');

// Bot readiness tracking
let botReady = false;
const healthFile = '/tmp/bot-ready';

// Override Discord client ready event to signal readiness
process.on('botReady', () => {
  console.log('🤖 Bot is fully ready and connected to Discord');
  botReady = true;
  
  // Create readiness file for health checks
  fs.writeFileSync(healthFile, JSON.stringify({
    ready: true,
    timestamp: new Date().toISOString(),
    pid: process.pid
  }));
  
  console.log('✅ Health check endpoint will now report ready');
});

// Clean up readiness file on exit
process.on('exit', () => {
  if (fs.existsSync(healthFile)) {
    fs.unlinkSync(healthFile);
  }
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  if (fs.existsSync(healthFile)) {
    fs.unlinkSync(healthFile);
  }
  process.exit(0);
});

console.log('🚀 Enhanced bot launcher starting...');
EOF

# -----------------------------------------------------------------------------
# LOGGING SETUP
# -----------------------------------------------------------------------------

echo "Preparing log directories..."
mkdir -p /var/log/discord-bot
chown -R ec2-user:ec2-user /var/log/discord-bot

# CloudWatch Agent configuration
echo "Setting up CloudWatch Agent..."
mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<JSON
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/discord-bot/bot.log",
            "log_group_name": "/ec2/${name}-logs",
            "log_stream_name": "{instance_id}-bot"
          },
          {
            "file_path": "/var/log/discord-bot/health.log", 
            "log_group_name": "/ec2/${name}-logs",
            "log_stream_name": "{instance_id}-health"
          }
        ]
      }
    }
  }
}
JSON

# -----------------------------------------------------------------------------
# SYSTEMD SERVICES
# -----------------------------------------------------------------------------

echo "Setting up systemd services..."

# Health check service
cat > /etc/systemd/system/discord-health.service <<'EOF'
[Unit]
Description=Discord Bot Health Check Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/discord-bot
ExecStart=/bin/bash -lc '/usr/bin/node health-check.js 2>&1 | /usr/bin/tee -a /var/log/discord-bot/health.log'
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-health

[Install]
WantedBy=multi-user.target
EOF

# Main bot service with enhanced launcher
cat > /etc/systemd/system/discord-bot.service <<'EOF'
[Unit]
Description=Discord Reaction Role Bot
After=network.target discord-health.service
Requires=discord-health.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/discord-bot
ExecStart=/bin/bash -lc '/usr/bin/node bot-enhanced.js 2>&1 | /usr/bin/tee -a /var/log/discord-bot/bot.log'
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-bot

# Health check configuration
ExecStartPost=/bin/bash -c 'sleep 5; echo "Service started, waiting for readiness..."'

[Install]
WantedBy=multi-user.target
EOF

# Logrotate configuration
cat > /etc/logrotate.d/discord-bot <<'ROTATE'
/var/log/discord-bot/*.log {
  daily
  rotate 7
  compress
  missingok
  notifempty
  copytruncate
}
ROTATE

# -----------------------------------------------------------------------------
# SERVICE STARTUP
# -----------------------------------------------------------------------------

echo "Enabling and starting services..."
systemctl daemon-reload
systemctl enable discord-health
systemctl enable discord-bot
systemctl enable amazon-cloudwatch-agent

# Start CloudWatch Agent first
echo "Starting CloudWatch Agent..."
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

# Start health check service
echo "Starting health check service..."
systemctl start discord-health

# Wait for health service to be ready
sleep 3
systemctl status discord-health || true

# Start main bot service
echo "Starting Discord bot service..."
systemctl start discord-bot

# -----------------------------------------------------------------------------
# READINESS VERIFICATION
# -----------------------------------------------------------------------------

echo "Waiting for bot to become ready..."
READY_TIMEOUT=120  # 2 minutes timeout
READY_CHECK_INTERVAL=5
elapsed=0

while [ $elapsed -lt $READY_TIMEOUT ]; do
  echo "Checking bot readiness... ($${elapsed}s elapsed)"
  
  # Check health endpoint
  if curl -f -s http://localhost:3000/health | grep -q "healthy"; then
    echo "✅ Bot is ready and healthy!"
    break
  else
    echo "⏳ Bot still starting up..."
  fi
  
  sleep $READY_CHECK_INTERVAL
  elapsed=$((elapsed + READY_CHECK_INTERVAL))
done

if [ $elapsed -ge $READY_TIMEOUT ]; then
  echo "⚠️ Bot readiness timeout reached ($${READY_TIMEOUT}s)"
  echo "Check logs: journalctl -u discord-bot -f"
else
  echo "🎉 Bot deployment completed successfully!"
fi

# Final status check
echo "=== Final Service Status ==="
systemctl status discord-health || true
systemctl status discord-bot || true

# Test health endpoint
echo "=== Health Check Test ==="
curl -s http://localhost:3000/health || echo "Health check not responding"

echo "=== Deployment completed at $(date) ==="
echo "Health endpoint: http://localhost:3000/health"
echo "Local logs: journalctl -u discord-bot -f"
echo "CloudWatch logs: /ec2/${name}-logs"