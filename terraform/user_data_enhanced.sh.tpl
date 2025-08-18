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
echo "Bot Run ID: ${run_id}"
echo "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
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
  "runId": "${run_id}",
  "moderatorRoleId": "${moderator_role_id}",
  "memberRoleId": "${member_role_id}",
  "commandChannelId": "${command_channel_id}",
  "memberCommandChannelId": "${member_command_channel_id}",
  "proposalConfig": ${proposalConfig},
  "dynamodbTable": "${dynamodb_table}",
  "eventsTable": "${events_table}",
  "reactionRoleConfig": ${reactionRoleConfig},
  "reminderIntervals": ${reminderIntervals}
}
JSON

# -----------------------------------------------------------------------------
# DEPLOYMENT FILES SETUP
# -----------------------------------------------------------------------------

echo "Setting up deployment files from bot code..."
# Copy JavaScript files
cp deployment/health-check.js ./health-check.js
cp deployment/bot-enhanced.js ./bot-enhanced.js

# Setup logging
mkdir -p /var/log/discord-bot
chown -R ec2-user:ec2-user /var/log/discord-bot

# Setup CloudWatch Agent  
mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
sed "s/PLACEHOLDER_NAME/${name}/g" deployment/cloudwatch-agent.json > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Copy service files
cp deployment/discord-health.service /etc/systemd/system/
cp deployment/discord-bot.service /etc/systemd/system/
cp deployment/logrotate.conf /etc/logrotate.d/discord-bot

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