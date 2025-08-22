# =============================================================================
# GLOBAL INFRASTRUCTURE MODULE
# =============================================================================
# Shared infrastructure components that are created once and used by all environments
# This includes VPC, subnets, NAT gateway, and other shared resources
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# =============================================================================
# VPC AND CORE NETWORKING
# =============================================================================

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "yourdiscord-vpc"
    Purpose = "Discord bot infrastructure"
    ManagedBy = "terraform"
  }
}

# Internet Gateway for public internet access
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "yourdiscord-igw"
    Purpose = "Internet access for Discord bot infrastructure"
  }
}

# =============================================================================
# AVAILABILITY ZONES AND SUBNETS
# =============================================================================

# Get available AZs
data "aws_availability_zones" "available" {
  state = "available"
}

# Public subnets for bastion, NAT gateway, and any public-facing resources
resource "aws_subnet" "public" {
  count = 2  # Create 2 public subnets for HA
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "yourdiscord-public-${count.index + 1}"
    Type = "Public"
    Purpose = "Public subnet for bastion and NAT gateway"
  }
}

# Private subnets for bot instances - NOW WITH PUBLIC IP FOR COST SAVINGS
# These subnets are still called "private" but now assign public IPs
# and route directly to internet gateway (eliminating NAT Gateway costs)
resource "aws_subnet" "private" {
  count = 2  # Create 2 private subnets for HA
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 10}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true  # Added for direct internet access

  tags = {
    Name = "yourdiscord-private-${count.index + 1}"
    Type = "Private"
    Purpose = "Private subnet for bot instances (now with public IP for cost savings)"
    Note = "Routes directly to IGW instead of NAT Gateway"
  }
}

# =============================================================================
# NAT GATEWAY FOR PRIVATE SUBNET INTERNET ACCESS - DISABLED FOR COST SAVINGS
# =============================================================================
# To re-enable NAT Gateway:
# 1. Uncomment the resources below
# 2. Update private route table to use NAT gateway
# 3. Set use_private_subnet = true in terraform.tfvars
# Cost: ~$45/month for NAT Gateway + ~$5/month for EIP

# # Elastic IP for NAT Gateway - DISABLED FOR COST SAVINGS
# resource "aws_eip" "nat" {
#   domain = "vpc"
#   
#   depends_on = [aws_internet_gateway.main]
# 
#   tags = {
#     Name = "yourdiscord-nat-eip"
#     Purpose = "NAT Gateway for private subnet internet access"
#   }
# }
# 
# # NAT Gateway in first public subnet - DISABLED FOR COST SAVINGS
# resource "aws_nat_gateway" "main" {
#   allocation_id = aws_eip.nat.id
#   subnet_id     = aws_subnet.public[0].id
# 
#   depends_on = [aws_internet_gateway.main]
# 
#   tags = {
#     Name = "yourdiscord-nat"
#     Purpose = "Internet access for private subnets"
#   }
# }

# =============================================================================
# ROUTE TABLES
# =============================================================================

# Route table for public subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  # Route to internet gateway
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "yourdiscord-public-rt"
    Type = "Public"
  }
}

# Associate public subnets with public route table
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Route table for private subnets - UPDATED FOR PUBLIC ACCESS
# Private subnets now route directly to internet gateway (like public subnets)
# This eliminates NAT Gateway costs while maintaining subnet separation
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  # Route to internet gateway for direct internet access (no NAT Gateway)
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "yourdiscord-private-rt"
    Type = "Private"
    Note = "Now routes to IGW instead of NAT for cost savings"
  }
}

# Associate private subnets with private route table
resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)
  
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# =============================================================================
# VPC ENDPOINTS - DISABLED FOR COST SAVINGS
# =============================================================================
# VPC endpoints are less critical now that traffic goes directly through IGW
# They provided cost savings when using NAT Gateway but add complexity
# To re-enable: uncomment resources below (adds ~$7/month per endpoint)

# # S3 VPC Endpoint for accessing S3 without going through internet
# resource "aws_vpc_endpoint" "s3" {
#   vpc_id       = aws_vpc.main.id
#   service_name = "com.amazonaws.${data.aws_region.current.region}.s3"
# 
#   tags = {
#     Name = "yourdiscord-s3-endpoint"
#     Purpose = "Private S3 access"
#   }
# }
# 
# # DynamoDB VPC Endpoint for accessing DynamoDB without going through internet
# resource "aws_vpc_endpoint" "dynamodb" {
#   vpc_id       = aws_vpc.main.id
#   service_name = "com.amazonaws.${data.aws_region.current.region}.dynamodb"
# 
#   tags = {
#     Name = "yourdiscord-dynamodb-endpoint"
#     Purpose = "Private DynamoDB access"
#   }
# }
# 
# # Associate VPC endpoints with private route table
# resource "aws_vpc_endpoint_route_table_association" "s3" {
#   route_table_id  = aws_route_table.private.id
#   vpc_endpoint_id = aws_vpc_endpoint.s3.id
# }
# 
# resource "aws_vpc_endpoint_route_table_association" "dynamodb" {
#   route_table_id  = aws_route_table.private.id
#   vpc_endpoint_id = aws_vpc_endpoint.dynamodb.id
# }

# Get current AWS region
data "aws_region" "current" {}