#!/bin/bash
set -e

# Code version: ${code_hash}
# This comment ensures user_data changes when code changes

# Log everything
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "Starting Discord bot deployment at $(date)"
echo "Code version: ${code_hash}"

# Update system and install Node.js
echo "Installing Node.js and required packages..."
yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs unzip

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
unzip discord-bot.zip
rm discord-bot.zip

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
  "s3Bucket": "${s3_bucket}",
  "config": ${config}
}
JSON

echo "Runtime config created:"
cat runtime.config.json

# Set up systemd service
echo "Setting up systemd service..."
cat > /etc/systemd/system/discord-bot.service <<EOF
[Unit]
Description=Discord Reaction Role Bot
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/discord-bot
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal
SyslogIdentifier=discord-bot

[Install]
WantedBy=multi-user.target
EOF

# Set proper permissions
echo "Setting permissions..."
chown -R ec2-user:ec2-user /opt/discord-bot

# Enable and start the service
echo "Starting Discord bot service..."
systemctl daemon-reload
systemctl enable discord-bot
systemctl start discord-bot

# Wait a moment for service to start
sleep 5

# Check service status
echo "Service status:"
systemctl status discord-bot

echo "Discord bot deployment completed at $(date)"
echo "To view logs: journalctl -u discord-bot -f"