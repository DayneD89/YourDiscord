# =============================================================================
# NETWORKING INFRASTRUCTURE
# =============================================================================
# This file defines the VPC, subnets, and networking components for secure
# bot deployment with zero-downtime capabilities.
# =============================================================================

# -----------------------------------------------------------------------------
# VPC AND SUBNET CONFIGURATION
# -----------------------------------------------------------------------------

# Get the default VPC for simple setup
data "aws_vpc" "default" {
  default = true
}

# Get default subnets for backup/fallback
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_subnet" "default_first" {
  id = data.aws_subnets.default.ids[0]
}

# Create private subnet for secure bot deployment
resource "aws_subnet" "bot_private" {
  count = var.use_private_subnet ? 1 : 0
  
  vpc_id                  = data.aws_vpc.default.id
  cidr_block              = "172.31.240.0/24"  # Non-overlapping with default subnets
  availability_zone       = data.aws_subnet.default_first.availability_zone
  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name}-private-subnet"
    Type = "Private"
    Purpose = "Discord Bot Secure Deployment"
  }
}

# Internet Gateway (should already exist for default VPC)
data "aws_internet_gateway" "default" {
  filter {
    name   = "attachment.vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Elastic IP for NAT Gateway
resource "aws_eip" "nat" {
  count = var.use_private_subnet ? 1 : 0
  
  domain = "vpc"
  
  tags = {
    Name = "${local.name}-nat-eip"
    Purpose = "NAT Gateway for private subnet outbound traffic"
  }
}

# NAT Gateway for private subnet outbound traffic
resource "aws_nat_gateway" "bot" {
  count = var.use_private_subnet ? 1 : 0
  
  allocation_id = aws_eip.nat[0].id
  subnet_id     = data.aws_subnet.default_first.id  # NAT goes in public subnet
  
  tags = {
    Name = "${local.name}-nat-gateway"
    Purpose = "Outbound internet access for private subnet"
  }
  
  depends_on = [data.aws_internet_gateway.default]
}

# Route table for private subnet
resource "aws_route_table" "bot_private" {
  count = var.use_private_subnet ? 1 : 0
  
  vpc_id = data.aws_vpc.default.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.bot[0].id
  }

  tags = {
    Name = "${local.name}-private-rt"
    Purpose = "Route table for private subnet through NAT"
  }
}

# Associate route table with private subnet
resource "aws_route_table_association" "bot_private" {
  count = var.use_private_subnet ? 1 : 0
  
  subnet_id      = aws_subnet.bot_private[0].id
  route_table_id = aws_route_table.bot_private[0].id
}

# -----------------------------------------------------------------------------
# LOCALS FOR SUBNET SELECTION
# -----------------------------------------------------------------------------

locals {
  # Choose between private subnet or default public subnet
  selected_subnet_id = var.use_private_subnet ? aws_subnet.bot_private[0].id : data.aws_subnet.default_first.id
  selected_vpc_id    = data.aws_vpc.default.id
  
  # Network configuration summary for outputs
  network_config = {
    vpc_id = local.selected_vpc_id
    subnet_id = local.selected_subnet_id
    is_private = var.use_private_subnet
    subnet_type = var.use_private_subnet ? "private" : "public"
    internet_access = var.use_private_subnet ? "via NAT Gateway" : "direct"
  }
}

# -----------------------------------------------------------------------------
# SECURITY GROUPS
# -----------------------------------------------------------------------------

# Enhanced security group for Discord bot
resource "aws_security_group" "bot_enhanced" {
  name        = "${local.name}-enhanced-sg"
  description = "Enhanced security group for Discord bot with health checks"
  vpc_id      = local.selected_vpc_id

  # Outbound traffic for Discord API and package downloads
  egress {
    description = "HTTPS for Discord API and package downloads"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP for package downloads and health checks
  egress {
    description = "HTTP for package downloads"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # DNS resolution
  egress {
    description = "DNS resolution"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Health check endpoint (internal only)
  ingress {
    description = "Health check endpoint from VPC"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.default.cidr_block]
  }

  tags = {
    Name = "${local.name}-enhanced-sg"
    Purpose = "Enhanced security for Discord bot with health checks"
  }
}

# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

output "network_configuration" {
  description = "Network configuration details"
  value = local.network_config
}

output "nat_gateway_ip" {
  description = "Public IP of NAT Gateway (if using private subnet)"
  value = var.use_private_subnet ? aws_eip.nat[0].public_ip : "N/A - using public subnet"
}