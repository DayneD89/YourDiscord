# 🏗️ New VPC Architecture

## 🎯 **Architecture Overview**

**Global Infrastructure (Created by Dev):**
- **VPC:** `10.0.0.0/16` (yourdiscord-vpc)
- **Public Subnets:** `10.0.1.0/24`, `10.0.2.0/24` (bastion, NAT gateway)
- **Private Subnets:** `10.0.10.0/24`, `10.0.11.0/24` (bot instances) 
- **Internet Gateway + NAT Gateway** for proper routing
- **VPC Endpoints** for S3/DynamoDB (cost optimization)

**Environment-Specific Resources:**
- **Dev:** Creates global infra + dev bot + bastion
- **Main:** References global infra + creates main bot

## 🚀 **Deployment Order**

### 1. **Deploy Dev Environment (Creates Global Infra)**
```bash
export TF_VAR_env=dev
terraform destroy  # Clean slate
terraform apply    # Creates VPC + dev bot + bastion
```

### 2. **Deploy Main Environment (Uses Global Infra)**
```bash  
export TF_VAR_env=main
terraform apply    # Uses existing VPC + creates main bot
```

## 🔗 **Bastion Access (Dev Environment Only)**

**Get Connection Details:**
```bash
# Must be in dev environment to get bastion info
export TF_VAR_env=dev
terraform output bastion_public_ip
terraform output bastion_connection_info
```

**Add SSH Access (One-time Setup):**
```bash
# Get your IP and bastion security group
MY_IP=$(curl -s ifconfig.me)
BASTION_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=yourdiscord-dev-bastion-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)

# Allow SSH from your IP
aws ec2 authorize-security-group-ingress \
  --group-id $BASTION_SG \
  --protocol tcp --port 22 --cidr $MY_IP/32
```

**Connect to Both Dev and Main Instances:**
```bash
BASTION_IP=$(terraform output -raw bastion_public_ip)
ssh -A -i ~/.ssh/yourdiscord.pem ec2-user@$BASTION_IP

# From bastion, view ALL bot instances (both dev and main):
./connect_to_bot.sh

# Connect to specific instance:
ssh -A ec2-user@<PRIVATE_IP_FROM_LIST>
```

**Key Features:**
- ✅ **Single bastion in dev** can access both dev and main bot instances
- ✅ **Shared VPC** means bastion can reach all environments  
- ✅ **SSH agent forwarding (-A)** maintains your key access through bastion
- ✅ **Helper script** shows both dev and main instances automatically

## 🛡️ **Security Features**

- **Bot instances can be in private subnets** (`use_private_subnet = true`)
- **Bastion only in dev environment** for debugging
- **Security groups properly scoped** to VPC and specific access patterns
- **VPC endpoints reduce NAT costs** for AWS services
- **No default ingress rules** - manually add SSH access to bastion

## 🔧 **Key Configuration**

**Bot Subnet Selection:**
```hcl
# In terraform.tfvars
use_private_subnet = true   # Recommended: bot in private subnet
use_private_subnet = false  # Alternative: bot in public subnet
```

**Resources Created:**
- **Global Module:** VPC, subnets, gateways, routing (dev only)
- **Bot ASG:** Zero-downtime deployment with health checks
- **Bastion:** SSH access for debugging (dev only)
- **Security Groups:** Proper access control for each component

This architecture provides secure, scalable, and properly routed infrastructure for both development and production environments! 🎉