# =============================================================================
# NETWORKING INFRASTRUCTURE (NEW)
# =============================================================================
# Uses global module for shared VPC infrastructure
# Replaces the old default VPC approach with proper dedicated VPC
# =============================================================================

# =============================================================================
# GLOBAL INFRASTRUCTURE MODULE
# =============================================================================

# Deploy global infrastructure only from dev environment
# But allow main to reference the already-created resources
module "global" {
  count  = var.env == "dev" ? 1 : 0
  source = "./modules/global"
}

# Data sources to reference existing global infrastructure when not deploying it
data "aws_vpc" "shared" {
  count = var.env == "main" ? 1 : 0

  filter {
    name   = "tag:Name"
    values = ["yourdiscord-vpc"]
  }
}

data "aws_subnets" "public_shared" {
  count = var.env == "main" ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.shared[0].id]
  }

  filter {
    name   = "tag:Type"
    values = ["Public"]
  }
}

data "aws_subnets" "private_shared" {
  count = var.env == "main" ? 1 : 0

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.shared[0].id]
  }

  filter {
    name   = "tag:Type"
    values = ["Private"]
  }
}

# =============================================================================
# LOCALS FOR SUBNET SELECTION
# =============================================================================

locals {
  # VPC and subnet references - use module outputs if created, otherwise data sources
  vpc_id = var.env == "dev" ? module.global[0].vpc_id : data.aws_vpc.shared[0].id

  # Public subnets
  public_subnet_ids      = var.env == "dev" ? module.global[0].public_subnet_ids : data.aws_subnets.public_shared[0].ids
  first_public_subnet_id = var.env == "dev" ? module.global[0].first_public_subnet_id : data.aws_subnets.public_shared[0].ids[0]

  # Private subnets
  private_subnet_ids      = var.env == "dev" ? module.global[0].private_subnet_ids : data.aws_subnets.private_shared[0].ids
  first_private_subnet_id = var.env == "dev" ? module.global[0].first_private_subnet_id : data.aws_subnets.private_shared[0].ids[0]

  # Choose subnet based on deployment preference
  selected_subnet_id = var.use_private_subnet ? local.first_private_subnet_id : local.first_public_subnet_id

  # For load balancers that require multiple AZs, get second subnet
  available_subnet_ids = var.use_private_subnet ? local.private_subnet_ids : local.public_subnet_ids
  backup_subnet_id     = length(local.available_subnet_ids) > 1 ? local.available_subnet_ids[1] : local.available_subnet_ids[0]

  # Update legacy references
  selected_vpc_id  = local.vpc_id
  public_subnet_id = local.first_public_subnet_id

  # Network configuration summary
  network_config = {
    vpc_id          = local.vpc_id
    subnet_id       = local.selected_subnet_id
    is_private      = var.use_private_subnet
    subnet_type     = var.use_private_subnet ? "private" : "public"
    internet_access = var.use_private_subnet ? "via NAT Gateway" : "direct"
  }
}

# =============================================================================
# SECURITY GROUPS
# =============================================================================

# Enhanced security group for bot instances with health checks
resource "aws_security_group" "bot_enhanced" {
  name_prefix = "${local.name}-bot-enhanced-"
  description = "Enhanced security group for Discord bot with health monitoring"
  vpc_id      = local.vpc_id

  # HTTP health check endpoint (internal only)
  ingress {
    description = "Health check endpoint"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [var.env == "dev" ? module.global[0].vpc_cidr_block : data.aws_vpc.shared[0].cidr_block]
  }

  # SSH access from bastion (bastion only exists in dev, but can access both dev and main)
  ingress {
    description = "SSH from bastion"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"] # Public subnet where bastion resides
  }

  # All outbound traffic allowed
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name}-bot-enhanced-sg"
    Environment = var.env
    Purpose     = "Enhanced Discord bot security"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Legacy bot security group for compatibility
resource "aws_security_group" "bot" {
  name_prefix = "${local.name}-bot-"
  description = "Security group for Discord bot (legacy)"
  vpc_id      = local.vpc_id

  # SSH access from bastion (bastion only exists in dev, but can access both dev and main)
  ingress {
    description = "SSH from bastion"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"] # Public subnet where bastion resides
  }

  # All outbound traffic allowed
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name}-bot-sg"
    Environment = var.env
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Security group for bastion (dev only)
resource "aws_security_group" "bastion" {
  count = var.env == "dev" ? 1 : 0

  name        = "${local.name}-bastion-sg"
  description = "Security group for bastion host - SSH access manually configured"
  vpc_id      = local.vpc_id

  # SSH access - no default rules, manually added by administrator
  # This prevents unauthorized access while allowing flexibility for debugging

  # All outbound traffic allowed for SSH connections to other instances
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name}-bastion-sg"
    Environment = var.env
    Purpose     = "SSH access for debugging"
  }
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "network_summary" {
  description = "Summary of network configuration"
  value = {
    vpc_id          = local.vpc_id
    environment     = var.env
    uses_shared_vpc = var.env == "main"
    selected_subnet = local.selected_subnet_id
    subnet_type     = var.use_private_subnet ? "private" : "public"
    public_subnets  = local.public_subnet_ids
    private_subnets = local.private_subnet_ids
  }
}