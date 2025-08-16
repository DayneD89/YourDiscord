#!/bin/bash
set -euxo pipefail

# Code version: ${code_hash}
# This comment ensures that user_data changes when code changes

# Log everything from this script
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "Starting Discord bot deployment at $(date)"
echo "Code version: ${code_hash}"
echo "Will log to CloudWatch Logs group: /ec2/${name}-logs"

# Update system and install Node.js + CloudWatch Agent
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

# Download bot code from S3
echo "Downloading bot code from S3..."
aws s3 cp s3://${s3_bucket}/${s3_key} ./discord-bot.zip

# Extract the code
echo "Extracting bot code..."
unzip -o discord-bot.zip
rm -f discord-bot.zip

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Create runtime config
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

echo "Runtime config created:"
cat runtime.config.json

# Prepare log directory for file-based tailing
echo "Preparing /var/log/discord-bot..."
mkdir -p /var/log/discord-bot
chown -R ec2-user:ec2-user /var/log/discord-bot

# ---------------- CloudWatch Agent logs config ---------------
echo "Writing CloudWatch Agent config (JSON with placeholder, then sed replace)..."
mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'JSON'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/discord-bot/bot.log",
            "log_group_name": "/ec2/${name}-logs",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
JSON

echo "Agent config:"
cat /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# ---------------- systemd service (journald + file via tee) ----------------
echo "Setting up systemd service..."
cat > /etc/systemd/system/discord-bot.service <<'EOF'
[Unit]
Description=Discord Reaction Role Bot
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/discord-bot
# Write to both a file and journald
ExecStart=/bin/bash -lc '/usr/bin/node bot.js 2>&1 | /usr/bin/tee -a /var/log/discord-bot/bot.log'
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-bot

[Install]
WantedBy=multi-user.target
EOF

# Optional: logrotate so the file doesn't grow forever
echo "Configuring logrotate for /var/log/discord-bot..."
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

# Enable services and start them
echo "Enabling services..."
systemctl daemon-reload
systemctl enable discord-bot
systemctl enable amazon-cloudwatch-agent

echo "Applying CloudWatch Agent config..."
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s

echo "Starting Discord bot service..."
systemctl start discord-bot

# Wait a moment for service to start
sleep 5

# Check service status
echo "Service status:"
systemctl status discord-bot || true

# Nudge a line into the file so the agent has fresh data to ship immediately
echo "cw-test $(date)" | tee -a /var/log/discord-bot/bot.log >/dev/null

echo "Discord bot deployment completed at $(date)"
echo "To view local logs: journalctl -u discord-bot -f"
echo "To view CloudWatch logs: CloudWatch Logs -> Log groups -> /ec2/${name}-logs"
