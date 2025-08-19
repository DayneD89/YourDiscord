#!/bin/bash
set -euxo pipefail

# =============================================================================
# BASTION HOST SETUP
# =============================================================================
# Minimal setup for SSH bastion host
# Used for debugging and accessing private instances
# =============================================================================

echo "=== Setting up bastion host for ${env} environment ==="

# Update system packages
yum update -y

# Install useful debugging tools
yum install -y \
    htop \
    tree \
    jq \
    curl \
    wget \
    telnet \
    nc \
    aws-cli

# Configure SSH for better security and debugging
echo "Configuring SSH settings..."

# Allow SSH agent forwarding for connecting through to other instances
cat >> /etc/ssh/sshd_config <<EOF

# Bastion-specific SSH configuration
AllowAgentForwarding yes
AllowTcpForwarding yes
X11Forwarding no
PermitTunnel no
GatewayPorts no
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

# Restart SSH service to apply changes
systemctl restart sshd

# Create helpful script for connecting to bot instances
cat > /home/ec2-user/connect_to_bot.sh <<'SCRIPT'
#!/bin/bash
# Helper script for connecting to bot instances

echo "=== Discord Bot SSH Helper ==="
echo "Bastion can connect to both dev and main bot instances"
echo

# Get instance information for both environments
echo "Finding DEV bot instances..."
DEV_INSTANCES=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=yourdiscord-dev*" "Name=instance-state-name,Values=running" \
    --query 'Reservations[*].Instances[*].[InstanceId,PrivateIpAddress,Tags[?Key==`Name`]|[0].Value]' \
    --output table)

echo "DEV Instances:"
echo "$DEV_INSTANCES"
echo

echo "Finding MAIN bot instances..."
MAIN_INSTANCES=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=yourdiscord-main*" "Name=instance-state-name,Values=running" \
    --query 'Reservations[*].Instances[*].[InstanceId,PrivateIpAddress,Tags[?Key==`Name`]|[0].Value]' \
    --output table)

echo "MAIN Instances:"
echo "$MAIN_INSTANCES"
echo

echo "To connect to a bot instance:"
echo "ssh -A ec2-user@<PRIVATE_IP>"
echo
echo "Note: Use -A for agent forwarding to maintain your SSH key access"
SCRIPT

chmod +x /home/ec2-user/connect_to_bot.sh
chown ec2-user:ec2-user /home/ec2-user/connect_to_bot.sh

# Create helpful aliases
cat >> /home/ec2-user/.bashrc <<'EOF'

# Bastion host aliases
alias ll='ls -la'
alias instances='aws ec2 describe-instances --query "Reservations[*].Instances[*].[InstanceId,State.Name,PrivateIpAddress,Tags[?Key==\`Name\`]|[0].Value]" --output table'
alias bot-logs='echo "Use: aws logs tail /ec2/yourdiscord-${env}-logs --follow"'

echo "=== Bastion Host Ready ==="
echo "Environment: ${env}"
echo "Useful commands:"
echo "  ./connect_to_bot.sh  - Find and connect to bot instances"
echo "  instances            - List all EC2 instances"  
echo "  bot-logs            - Show how to view bot logs"
echo "  ssh -A ec2-user@<ip> - Connect to instance with agent forwarding"
EOF

echo "=== Bastion setup completed at $(date) ==="
echo "Instance ready for SSH debugging and maintenance"