# Terraform Infrastructure Documentation

This directory contains the Infrastructure as Code (IaC) configuration for deploying YourPartyServer on AWS. The Terraform configuration automates the deployment of Discord bots, AWS resources, and Discord server setup.

## 📁 File Structure

```
terraform/
├── *.tf                        # Core Terraform configuration files
├── *.tfvars                    # Variable value files
├── messages/                   # Discord channel content templates
├── images/                     # Server branding and assets
├── networking.tf               # VPC, subnets, and network security
├── user_data_enhanced.sh.tpl   # Enhanced EC2 initialization with health checks
└── README.md                   # This documentation
```

## 🚀 Recent Infrastructure Enhancements

### Zero-Downtime Deployment System
- **Enhanced Health Checks**: HTTP endpoint at `:3000/health` with bot readiness signaling
- **Private Subnet Deployment**: Secure bot hosting with NAT Gateway for enhanced security
- **Environment Isolation**: Separate CIDR blocks prevent deployment conflicts
- **Application Readiness**: Bot signals when fully connected to Discord before traffic routing

### Smart Deployment Features
- **Discord API Resilience**: Terraform wrappers with retry logic for timeout handling
- **Environment-Specific Configuration**: Different settings for main vs feature branch deployments
- **Enhanced Security Groups**: Comprehensive network access controls for private deployments
- **Dependency Management**: Proper resource ordering prevents race conditions

## 🔧 Core Configuration Files

### `main.tf`
**Purpose**: Primary Terraform configuration that orchestrates all resources and modules.

**Key Responsibilities**:
- Defines the main infrastructure stack
- Coordinates AWS and Discord provider resources
- Sets up resource dependencies and relationships
- Configures the bot deployment pipeline

**Important Sections**:
```hcl
# Main bot infrastructure
module "bot_infrastructure" {
  source = "./modules/bot"
  # Bot-specific configuration
}

# Discord server setup
module "discord_setup" {
  source = "./modules/discord"
  # Discord channel and role configuration
}
```

**When to Modify**: 
- Adding new modules or major architectural changes
- Changing resource organization or dependencies
- Updating provider configurations

---

### `variables.tf`
**Purpose**: Defines all input variables that customize the deployment for different environments and use cases.

**Key Variable Categories**:

#### Discord Configuration
```hcl
variable "guild_id" {
  description = "Discord server (guild) ID where the bot will operate"
  type        = string
}

variable "bot_token" {
  description = "Discord bot token for authentication"
  type        = string
  sensitive   = true
}
```

#### AWS Infrastructure
```hcl
variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type for the bot"
  type        = string
  default     = "t3.micro"
}

variable "use_private_subnet" {
  description = "Deploy bot in private subnet with NAT Gateway"
  type        = bool
  default     = true
}

variable "env" {
  description = "Environment name (main, features, etc.)"
  type        = string
  default     = "development"
}
```

#### Proposal System
```hcl
variable "proposal_types" {
  description = "Configuration for different types of governance proposals"
  type = map(object({
    support_threshold = number
    vote_duration     = number
    formats          = list(string)
  }))
}
```

**When to Modify**:
- Adding new configuration options
- Changing default values for your deployment
- Adding validation rules for input values

---

### `locals.tf`
**Purpose**: Computes values and transforms variables for use throughout the configuration.

**Key Computations**:

#### Proposal Configuration
```hcl
locals {
  # Transform proposal types into bot configuration format
  proposal_config = {
    for type, config in var.proposal_types : type => {
      debateChannelId      = discord_channel.debate_channels[type].id
      voteChannelId        = discord_channel.vote_channels[type].id
      resolutionsChannelId = discord_channel.resolution_channels[type].id
      supportThreshold     = config.support_threshold
      voteDuration         = config.vote_duration
      formats             = config.formats
    }
  }
}
```

#### Common Tags
```hcl
locals {
  common_tags = {
    Project     = var.project_name
    Environment = terraform.workspace
    ManagedBy   = "terraform"
    Repository  = "yourpartyserver"
  }
}
```

**When to Modify**:
- Adding computed values used across multiple resources
- Implementing complex data transformations
- Creating reusable tag sets or naming conventions

---

### `data.tf`
**Purpose**: Fetches external data sources needed for resource configuration.

**Key Data Sources**:

#### AWS AMI Selection
```hcl
# Get the latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}
```

#### Availability Zones
```hcl
# Get available AZs in the current region
data "aws_availability_zones" "available" {
  state = "available"
}
```

#### Current AWS Account
```hcl
# Get current AWS account ID and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
```

**When to Modify**:
- Changing AMI selection criteria
- Adding new external data dependencies
- Updating data source filters

---

### `provider.tf`
**Purpose**: Configures Terraform providers for AWS and Discord integration.

**Provider Configurations**:

#### AWS Provider
```hcl
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = local.common_tags
  }
}
```

#### Discord Provider
```hcl
provider "discord" {
  token = var.bot_token
}
```

#### Terraform Configuration
```hcl
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    discord = {
      source  = "Lucky3028/discord"
      version = "~> 1.0"
    }
  }
  
  backend "s3" {
    # Backend configuration
  }
}
```

**When to Modify**:
- Updating provider versions
- Adding new providers
- Changing backend configuration

---

### `bot.tf`
**Purpose**: Defines the core bot infrastructure including EC2 instances, S3 storage, and deployment mechanisms.

**Key Resources**:

#### EC2 Instance
```hcl
resource "aws_instance" "bot_instance" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  
  iam_instance_profile = aws_iam_instance_profile.bot_profile.name
  vpc_security_group_ids = [aws_security_group.bot_sg.id]
  
  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    s3_bucket     = aws_s3_bucket.bot_data.bucket
    bot_token     = var.bot_token
    guild_id      = var.guild_id
    # Additional configuration variables
  })
  
  tags = merge(local.common_tags, {
    Name = "${var.project_name}-bot-instance"
  })
}
```

#### S3 Storage
```hcl
resource "aws_s3_bucket" "bot_data" {
  bucket = "${var.project_name}-bot-data-${random_string.bucket_suffix.result}"
  
  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "bot_data_versioning" {
  bucket = aws_s3_bucket.bot_data.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

#### Security Group
```hcl
resource "aws_security_group" "bot_sg" {
  name_prefix = "${var.project_name}-bot-"
  description = "Security group for YourPartyServer bot"
  
  # Allow outbound HTTPS for Discord API
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  # Allow outbound HTTP for package updates
  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

**When to Modify**:
- Changing bot infrastructure requirements
- Adding monitoring or logging resources
- Updating security configurations
- Modifying storage requirements

---

### `roles.tf`
**Purpose**: Manages IAM roles, policies, and permissions for secure bot operation.

**Key IAM Resources**:

#### Bot Execution Role
```hcl
resource "aws_iam_role" "bot_role" {
  name = "${var.project_name}-bot-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}
```

#### S3 Access Policy
```hcl
resource "aws_iam_role_policy" "bot_s3_policy" {
  name = "${var.project_name}-bot-s3-policy"
  role = aws_iam_role.bot_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.bot_data.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.bot_data.arn
      }
    ]
  })
}
```

#### CloudWatch Logs Policy
```hcl
resource "aws_iam_role_policy" "bot_logs_policy" {
  count = var.enable_cloudwatch_logs ? 1 : 0
  name  = "${var.project_name}-bot-logs-policy"
  role  = aws_iam_role.bot_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}
```

**When to Modify**:
- Adding new AWS service integrations
- Implementing additional security restrictions
- Adding CloudWatch or monitoring permissions
- Integrating with other AWS services

---

### `channels.tf`
**Purpose**: Configures Discord server channels, roles, and initial content for the governance system.

**Key Discord Resources**:

#### Server Roles
```hcl
resource "discord_role" "member" {
  guild_id = var.guild_id
  name     = "Member"
  color    = 3447003  # Blue
  hoist    = false
  
  permissions = [
    "view_channel",
    "send_messages",
    "add_reactions",
    "read_message_history"
  ]
}

resource "discord_role" "moderator" {
  guild_id = var.guild_id
  name     = "Moderator"
  color    = 15158332  # Red
  hoist    = true
  
  permissions = [
    "view_channel",
    "send_messages",
    "manage_messages",
    "manage_roles",
    "add_reactions",
    "read_message_history"
  ]
}
```

#### Basic Channels
```hcl
resource "discord_channel" "general" {
  name     = "general"
  guild_id = var.guild_id
  type     = 0  # Text channel
  topic    = "General community discussion"
}

resource "discord_channel" "welcome" {
  name     = "welcome"
  guild_id = var.guild_id
  type     = 0
  topic    = "Welcome new members! React with ✅ to get member role"
}
```

#### Command Channels
```hcl
resource "discord_channel" "bot_commands" {
  name     = "bot-commands"
  guild_id = var.guild_id
  type     = 0
  topic    = "Moderator bot commands. Use !help to see available commands"
}

resource "discord_channel" "member_commands" {
  name     = "member-commands"
  guild_id = var.guild_id
  type     = 0
  topic    = "Member bot commands. Use !help to see available commands"
}
```

#### Governance Channels (Dynamic)
```hcl
# Create debate channels for each proposal type
resource "discord_channel" "debate_channels" {
  for_each = var.proposal_types
  
  name     = "${each.key}-debate"
  guild_id = var.guild_id
  type     = 0
  topic    = "Discuss ${each.key} proposals before voting. Format: **${title(each.key)}**: [proposal]"
}

# Create voting channels for each proposal type
resource "discord_channel" "vote_channels" {
  for_each = var.proposal_types
  
  name     = "${each.key}-vote"
  guild_id = var.guild_id
  type     = 0
  topic    = "Vote on ${each.key} proposals. React with ✅ (support) or ❌ (oppose)"
}

# Create resolution channels for each proposal type
resource "discord_channel" "resolution_channels" {
  for_each = var.proposal_types
  
  name     = "${each.key}-resolutions"
  guild_id = var.guild_id
  type     = 0
  topic    = "Official ${each.key} resolutions. These are active community policies"
}
```

**When to Modify**:
- Adding new channel types or categories
- Changing role permissions or colors
- Customizing channel topics or descriptions
- Adding new proposal types

---

### `user_data.sh.tpl`
**Purpose**: Template script that initializes EC2 instances with the bot application and required dependencies.

**Key Functions**:

#### System Setup
```bash
#!/bin/bash
# Update system packages
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install additional tools
yum install -y git unzip
```

#### Bot Installation
```bash
# Download bot code from S3
aws s3 cp s3://${s3_bucket}/bot/yourpartyserver-bot.zip /opt/yourpartyserver-bot.zip
cd /opt
unzip yourpartyserver-bot.zip
cd YourBot

# Install dependencies
npm install --production
```

#### Configuration
```bash
# Create runtime configuration
cat > runtime.config.json << EOF
{
  "guildId": "${guild_id}",
  "botToken": "${bot_token}",
  "moderatorRoleId": "${moderator_role_id}",
  "memberRoleId": "${member_role_id}",
  "commandChannelId": "${command_channel_id}",
  "memberCommandChannelId": "${member_command_channel_id}",
  "s3Bucket": "${s3_bucket}",
  "config": ${jsonencode(bot_config)},
  "proposalConfig": ${jsonencode(proposal_config)}
}
EOF
```

#### Service Setup
```bash
# Create systemd service
cat > /etc/systemd/system/yourpartyserver-bot.service << EOF
[Unit]
Description=YourPartyServer Discord Bot
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/YourBot
ExecStart=/usr/bin/node bot.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl enable yourpartyserver-bot
systemctl start yourpartyserver-bot
```

**When to Modify**:
- Adding new bot dependencies or services
- Changing deployment configuration
- Adding monitoring or logging setup
- Implementing custom initialization logic

---

### `networking.tf`
**Purpose**: Defines VPC, subnets, and networking components for secure bot deployment with zero-downtime capabilities.

**Key Resources**:

#### Private Subnet for Enhanced Security
```hcl
resource "aws_subnet" "bot_private" {
  count = var.use_private_subnet ? 1 : 0
  
  vpc_id                  = data.aws_vpc.default.id
  cidr_block              = local.private_subnet_cidr
  availability_zone       = data.aws_subnet.default_first.availability_zone
  map_public_ip_on_launch = false
}
```

#### NAT Gateway for Outbound Access
```hcl
resource "aws_nat_gateway" "bot_nat" {
  count         = var.use_private_subnet ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = data.aws_subnet.default_first.id
}
```

#### Environment-Specific CIDR Blocks
```hcl
locals {
  # Prevents subnet conflicts between environments
  private_subnet_cidr = var.env == "main" ? "172.31.240.0/24" : "172.31.245.0/24"
}
```

**When to Modify**:
- Changing network security requirements
- Adding additional subnets for multi-AZ deployment
- Modifying CIDR blocks for different environments
- Implementing additional network security controls

---

### `user_data_enhanced.sh.tpl`
**Purpose**: Enhanced EC2 initialization script with health checks and zero-downtime deployment support.

**Key Enhancements**:

#### Health Check Endpoint
```bash
# Start health check service
cat > /opt/health-check.js << 'EOF'
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const isReady = fs.existsSync('/tmp/bot-ready');
    if (isReady) {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(503, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({status: 'starting'}));
    }
  }
});
server.listen(3000);
EOF
```

#### Bot Readiness Signaling
```bash
# Bot signals when ready
echo "Bot is ready" > /tmp/bot-ready
```

**When to Modify**:
- Adding new health check endpoints
- Implementing additional deployment verification
- Adding monitoring or logging services
- Customizing bot startup procedures

---

## 📂 Supporting Directories

### `messages/`
**Purpose**: Contains template content for Discord channels, including welcome messages, channel guides, and governance documentation.

**Files**:
- `welcome_message.md` - Welcome channel content template
- `rules_summary.md` - Community rules and guidelines
- `proposal_guide.md` - How to create and participate in proposals
- `governance_proposal_guide.md` - Specific guide for governance changes
- `withdraw_proposal_guide.md` - How to withdraw existing resolutions
- `channel_guide.md` - Explanation of channel purposes
- `contributing_guide.md` - How community members can contribute

**Usage**: These templates are referenced in Terraform configurations to populate channel topics and initial messages.

**When to Modify**:
- Customizing community guidelines or rules
- Adding new governance processes
- Updating channel descriptions or topics
- Localizing content for different languages

### `images/`
**Purpose**: Stores branding assets and images used in Discord server setup.

**Files**:
- `logo.png` - Community/server logo
- `server_icon.jpg` - Discord server icon
- Additional branding assets as needed

**Usage**: Referenced in Discord channel setup and community branding.

**When to Modify**:
- Updating community branding
- Adding new visual assets
- Changing server icons or logos

---

## 🔧 Configuration Examples

### Basic Deployment (`terraform.tfvars`)
```hcl
# Discord Configuration
guild_id  = "123456789012345678"
bot_token = "YOUR_DISCORD_BOT_TOKEN_HERE"

# AWS Configuration
aws_region   = "us-east-1"
project_name = "my-community-bot"

# Instance Configuration
instance_type = "t3.micro"
enable_monitoring = true

# Proposal Configuration
proposal_types = {
  policy = {
    support_threshold = 3
    vote_duration     = 86400000  # 24 hours
    formats          = ["Policy"]
  }
  governance = {
    support_threshold = 5
    vote_duration     = 172800000  # 48 hours
    formats          = ["Governance", "Constitution"]
  }
}
```

### Advanced Configuration with Multiple Proposal Types
```hcl
# Extended proposal system
proposal_types = {
  policy = {
    support_threshold = 3
    vote_duration     = 86400000   # 24 hours
    formats          = ["Policy", "Rule"]
  }
  governance = {
    support_threshold = 5
    vote_duration     = 172800000  # 48 hours
    formats          = ["Governance", "Constitution", "Charter"]
  }
  budget = {
    support_threshold = 7
    vote_duration     = 259200000  # 72 hours
    formats          = ["Budget", "Expense", "Allocation"]
  }
  emergency = {
    support_threshold = 10
    vote_duration     = 43200000   # 12 hours
    formats          = ["Emergency", "Urgent"]
  }
}

# Server customization
server_name = "My Democratic Community"
server_description = "A community governed by its members"

# Cost optimization
instance_type = "t3.nano"  # Smaller instance for lower costs
enable_spot_instances = true
```

### Development Environment (`dev.tfvars`)
```hcl
# Development-specific configuration
guild_id  = "987654321098765432"  # Test server
bot_token = "DEV_BOT_TOKEN_HERE"

project_name = "yourpartyserver-dev"
instance_type = "t3.nano"  # Minimal resources for testing

# Faster voting for testing
proposal_types = {
  policy = {
    support_threshold = 1     # Lower threshold for testing
    vote_duration     = 300000  # 5 minutes
    formats          = ["Policy", "Test"]
  }
}

# Development tags
additional_tags = {
  Environment = "development"
  AutoShutdown = "true"
}
```

---

## 🚀 Deployment Commands

### Initial Deployment
```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file="terraform.tfvars"

# Apply configuration
terraform apply -var-file="terraform.tfvars"
```

### Environment-Specific Deployments
```bash
# Features branch deployment (isolated testing)
terraform apply -var="env=features" -var="use_private_subnet=true"

# Main branch deployment (production)
terraform apply -var="env=main" -var="use_private_subnet=true"

# Legacy public deployment (if needed)
terraform apply -var="env=main" -var="use_private_subnet=false"
```

### Zero-Downtime Deployment Process
```bash
# Health-verified deployment
terraform apply -var="env=main"
# Terraform waits for health checks to pass before completing

# Monitor deployment status
curl -f http://INSTANCE_IP:3000/health
# Returns: {"status": "healthy", "timestamp": "2024-01-15T14:30:00.000Z"}
```

### Updates and Maintenance
```bash
# Update infrastructure
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"

# Destroy resources (careful!)
terraform destroy -var-file="terraform.tfvars"
```

---

## 🔍 Validation and Testing

### Terraform Validation
```bash
# Validate syntax
terraform validate

# Format files
terraform fmt -recursive

# Security scanning (with external tools)
tfsec .
checkov -d .
```

### Infrastructure Testing
```bash
# Test with smaller instance
terraform plan -var="instance_type=t3.nano"

# Dry run without Discord changes
terraform plan -target="module.aws_infrastructure"
```

---

## 🛠️ Customization Guide

### Adding New Proposal Types

1. **Update Variables**:
   ```hcl
   # In terraform.tfvars
   proposal_types = {
     # ... existing types ...
     
     custom_type = {
       support_threshold = 4
       vote_duration     = 86400000
       formats          = ["CustomType", "Special"]
     }
   }
   ```

2. **Channels Are Created Automatically**: The `for_each` loops in `channels.tf` will automatically create the necessary channels.

3. **Update Documentation**: Add information about the new proposal type to channel topics and guides.

### Adding AWS Services

1. **Define Variables**: Add new variables in `variables.tf`
2. **Create Resources**: Add resource definitions in appropriate `.tf` files
3. **Update IAM**: Add necessary permissions in `roles.tf`
4. **Update User Data**: Modify `user_data.sh.tpl` if needed for bot configuration

### Environment-Specific Configurations

1. **Create Environment Files**: `dev.tfvars`, `staging.tfvars`, `prod.tfvars`
2. **Use Terraform Workspaces**: Separate state for each environment
3. **Conditional Resources**: Use `count` or `for_each` with conditions for environment-specific resources

---

## 📊 Outputs and Integration

### Terraform Outputs
Key outputs available after deployment:

```hcl
output "bot_instance_id" {
  description = "EC2 instance ID running the bot"
  value       = aws_instance.bot_instance.id
}

output "bot_public_ip" {
  description = "Public IP address of the bot instance"
  value       = aws_instance.bot_instance.public_ip
}

output "s3_bucket_name" {
  description = "S3 bucket used for bot data storage"
  value       = aws_s3_bucket.bot_data.bucket
}

output "discord_channel_ids" {
  description = "Created Discord channel IDs"
  value = {
    general = discord_channel.general.id
    welcome = discord_channel.welcome.id
    # ... other channels
  }
}
```

### Integration with CI/CD
The Terraform configuration integrates with GitHub Actions for automated deployments:

```yaml
# .github/workflows/deploy.yml
- name: Terraform Apply
  run: |
    terraform init
    terraform apply -auto-approve -var-file="prod.tfvars"
  env:
    TF_VAR_bot_token: ${{ secrets.DISCORD_BOT_TOKEN }}
    TF_VAR_guild_id: ${{ secrets.GUILD_ID }}
```

---

## 🏛️ Modern Infrastructure Architecture

### VPC and Networking
**Comprehensive networking setup** (see [README_VPC.md](README_VPC.md) for full details):
- **Shared VPC**: `10.0.0.0/16` with proper subnet isolation
- **Environment Strategy**: Dev creates global infrastructure, main reuses it
- **Security**: Private subnets for bot instances, bastion for debugging
- **Cost Optimization**: VPC endpoints for AWS services

### Bot Deployment Architecture
**Modern deployment with zero-downtime capabilities**:
- **Auto Scaling Groups**: Health-checked instance replacement
- **HTTP Health Checks**: `:3000/health` endpoint verification
- **Clean Code Structure**: Organized into core, handlers, managers, processors, storage, validators
- **95%+ Test Coverage**: 817+ comprehensive tests with unified utilities
- **AWS SDK v3**: Modern async patterns with DynamoDB and S3 integration

### Security and Access
- **Private Networking**: Bot instances secured in private subnets
- **Bastion Access**: SSH debugging in dev environment only
- **Security Groups**: Minimal required access patterns
- **IAM Roles**: Fine-grained AWS service permissions
- **Environment Isolation**: Separate configurations for dev vs main

### Deployment Features
- **Zero-Downtime**: Health-verified instance replacement
- **Discord API Resilience**: Retry logic for API timeouts
- **Environment-Specific Config**: Different settings per deployment
- **Modular Design**: Reusable infrastructure components
- **Cost Optimization**: VPC endpoints and efficient resource usage

This Terraform configuration provides a robust, scalable foundation for deploying Discord governance bots with full AWS integration, modern architecture, and comprehensive testing.
