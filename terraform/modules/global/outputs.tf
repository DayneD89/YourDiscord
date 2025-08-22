# =============================================================================
# GLOBAL MODULE OUTPUTS
# =============================================================================

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = aws_internet_gateway.main.id
}

# NAT Gateway outputs - DISABLED FOR COST SAVINGS
# Uncomment when NAT Gateway is re-enabled in main.tf
# output "nat_gateway_id" {
#   description = "ID of the NAT Gateway"
#   value       = aws_nat_gateway.main.id
# }
# 
# output "nat_gateway_eip" {
#   description = "Elastic IP of the NAT Gateway"
#   value       = aws_eip.nat.public_ip
# }

# Public subnets
output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "public_subnet_cidrs" {
  description = "CIDR blocks of the public subnets"
  value       = aws_subnet.public[*].cidr_block
}

output "public_subnet_azs" {
  description = "Availability zones of the public subnets"
  value       = aws_subnet.public[*].availability_zone
}

# Private subnets
output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "private_subnet_cidrs" {
  description = "CIDR blocks of the private subnets"
  value       = aws_subnet.private[*].cidr_block
}

output "private_subnet_azs" {
  description = "Availability zones of the private subnets"
  value       = aws_subnet.private[*].availability_zone
}

# Route tables
output "public_route_table_id" {
  description = "ID of the public route table"
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "ID of the private route table"
  value       = aws_route_table.private.id
}

# VPC Endpoints - DISABLED FOR COST SAVINGS
# Uncomment when VPC endpoints are re-enabled in main.tf
# output "s3_vpc_endpoint_id" {
#   description = "ID of the S3 VPC endpoint"
#   value       = aws_vpc_endpoint.s3.id
# }
# 
# output "dynamodb_vpc_endpoint_id" {
#   description = "ID of the DynamoDB VPC endpoint"
#   value       = aws_vpc_endpoint.dynamodb.id
# }

# Convenience outputs for selecting subnets
output "first_public_subnet_id" {
  description = "ID of the first public subnet (for bastion)"
  value       = aws_subnet.public[0].id
}

output "first_private_subnet_id" {
  description = "ID of the first private subnet (for single-AZ deployments)"
  value       = aws_subnet.private[0].id
}

output "availability_zones" {
  description = "Available availability zones"
  value       = data.aws_availability_zones.available.names
}