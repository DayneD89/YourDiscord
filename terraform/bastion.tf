# =============================================================================
# BASTION HOST
# =============================================================================
# Bastion host for SSH access to private instances
# Can be manually stopped/started in AWS console - Terraform ignores state changes
# =============================================================================

# Security group is now defined in networking.tf

# Bastion host instance
resource "aws_instance" "bastion" {
  count = var.env == "dev" ? 1 : 0

  ami                    = data.aws_ami.al2023_arm.id
  instance_type          = "t4g.nano" # Minimal instance for SSH access
  key_name               = "yourdiscord"
  subnet_id              = local.first_public_subnet_id # Always use public subnet for bastion
  vpc_security_group_ids = [aws_security_group.bastion[0].id]

  # Public IP required for external SSH access
  associate_public_ip_address = true

  # Basic user data for system updates and SSH hardening  
  user_data                   = <<-EOF
    #!/bin/bash
    set -euxo pipefail

    # Log everything from this script
    exec > >(tee /var/log/user-data.log)
    exec 2>&1

    echo "=== Setting up bastion host for ${var.env} environment ==="

    # Update system packages
    yum update -y

    # Install useful debugging tools (skip already installed packages)
    yum install -y htop tree wget telnet nc || true
    
    # Handle curl conflict by ensuring we have full curl
    yum swap -y curl-minimal curl || yum install -y curl || true
    
    # jq and aws-cli are already installed according to logs
    echo "Package installation completed"

    # Create helpful script for connecting to bot instances
    cat > /home/ec2-user/connect_to_bot.sh <<'SCRIPT'
    #!/bin/bash
    echo "=== Discord Bot SSH Helper ==="
    echo "Bastion can connect to both dev and main bot instances"
    echo

    echo "Finding DEV bot instances..."
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=yourdiscord-dev*" "Name=instance-state-name,Values=running" \
        --query 'Reservations[*].Instances[*].[InstanceId,PrivateIpAddress,Tags[?Key==\`Name\`]|[0].Value]' \
        --output table

    echo
    echo "Finding MAIN bot instances..."
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=yourdiscord-main*" "Name=instance-state-name,Values=running" \
        --query 'Reservations[*].Instances[*].[InstanceId,PrivateIpAddress,Tags[?Key==\`Name\`]|[0].Value]' \
        --output table

    echo
    echo "To connect to a bot instance:"
    echo "ssh -A ec2-user@<PRIVATE_IP>"
    echo "Note: Use -A for agent forwarding"
    SCRIPT

    chmod +x /home/ec2-user/connect_to_bot.sh
    chown ec2-user:ec2-user /home/ec2-user/connect_to_bot.sh

    # Create helpful aliases
    cat >> /home/ec2-user/.bashrc <<'BASHRC'

    # Bastion host aliases
    alias ll='ls -la'
    alias instances='aws ec2 describe-instances --query "Reservations[*].Instances[*].[InstanceId,State.Name,PrivateIpAddress,Tags[?Key==\\\`Name\\\`]|[0].Value]" --output table'
    alias bot-logs='echo "Use: aws logs tail /ec2/yourdiscord-${var.env}-logs --follow"'

    echo "=== Bastion Host Ready ==="
    echo "Environment: ${var.env}"
    echo "Useful commands:"
    echo "  ./connect_to_bot.sh  - Find and connect to bot instances"
    echo "  instances            - List all EC2 instances"  
    echo "  bot-logs            - Show how to view bot logs"
    echo "  ssh -A ec2-user@<ip> - Connect to instance with agent forwarding"
    BASHRC

    echo "=== Bastion setup completed at $(date) ==="
    echo "Instance ready for SSH debugging and maintenance"
  EOF
  user_data_replace_on_change = true

  root_block_device {
    volume_size           = 30 # Match AMI snapshot size requirement
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  tags = {
    Name        = "${local.name}-bastion"
    Environment = var.env
    Purpose     = "SSH bastion for debugging"
    Network     = "Public"
  }

  lifecycle {
    create_before_destroy = true
    ignore_changes = [
      # Ignore public IP changes that happen when stopping/starting
      public_ip,
      # Ignore private IP changes that can happen during stop/start
      private_ip,
      # Ignore public IP association changes during stop/start cycles
      associate_public_ip_address
    ]
  }
}

# Output bastion connection information
output "bastion_public_ip" {
  description = "Public IP of bastion host (dev only, null if stopped)"
  value       = var.env == "dev" ? try(aws_instance.bastion[0].public_ip, null) : null
}

output "bastion_connection_info" {
  description = "SSH connection info for bastion (when running)"
  value = var.env == "dev" && try(aws_instance.bastion[0].public_ip, null) != null ? {
    public_ip   = aws_instance.bastion[0].public_ip
    ssh_command = "ssh -i ~/.ssh/yourdiscord.pem ec2-user@${aws_instance.bastion[0].public_ip}"
    note        = "Add SSH ingress rule manually: aws ec2 authorize-security-group-ingress --group-id ${aws_security_group.bastion[0].id} --protocol tcp --port 22 --cidr YOUR_IP/32"
  } : null
}