# Self-Hosting Guide

This comprehensive guide will walk you through deploying your own YourPartyServer Discord bot on AWS. By the end of this guide, you'll have a fully functional community governance bot running in your own AWS account.

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [AWS Account Setup](#-aws-account-setup)
- [Discord Bot Configuration](#-discord-bot-configuration)
- [GitHub Repository Setup](#-github-repository-setup)
- [Terraform Configuration](#-terraform-configuration)
- [Deployment Process](#-deployment-process)
- [Discord Server Configuration](#-discord-server-configuration)
- [Testing Your Deployment](#-testing-your-deployment)
- [Ongoing Maintenance](#-ongoing-maintenance)
- [Troubleshooting](#-troubleshooting)
- [Cost Optimization](#-cost-optimization)

## ✅ Prerequisites

Before starting, ensure you have:

- **Discord Server**: Administrative access to configure channels and roles
- **GitHub Account**: For repository management and CI/CD
- **AWS Account**: For hosting infrastructure (credit card required)
- **Domain (Optional)**: For custom webhook URLs
- **Basic CLI Knowledge**: Comfortable using terminal/command prompt

### Estimated Costs

| Component | Monthly Cost (USD) | Notes |
|-----------|-------------------|-------|
| EC2 t3.micro | $8-12 | 24/7 operation |
| S3 Storage | $1-3 | Configuration and data |
| Data Transfer | $1-5 | Discord API calls |
| **Total** | **$10-20/month** | Varies by usage |

> 💡 **Cost Saving**: AWS Free Tier covers most costs for the first 12 months

## 🔧 AWS Account Setup

### 1. Create AWS Account

1. **Visit [AWS Console](https://aws.amazon.com/console/)**
2. **Click "Create a new AWS account"**
3. **Follow the registration process**
   - Provide email and password
   - Enter credit card information
   - Complete phone verification
   - Choose support plan (Basic is free)

### 2. Configure IAM User

Create a dedicated user for bot deployment:

1. **Navigate to IAM Console**
   - Search "IAM" in AWS Console
   - Click "Identity and Access Management"

2. **Create New User**
   ```
   User name: yourpartyserver-deploy
   Access type: ✅ Programmatic access
   ```

3. **Attach Policies**
   Create a custom policy with these permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ec2:*",
           "s3:*",
           "iam:*",
           "ssm:*"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

4. **Save Credentials**
   ```
   Access Key ID: AKIA...
   Secret Access Key: abcd...
   ```
   > ⚠️ **Security**: Never commit these to GitHub!

### 3. Set Up S3 Bucket

Create a bucket for Terraform state:

1. **Navigate to S3 Console**
2. **Create Bucket**
   ```
   Bucket name: yourpartyserver-terraform-state-[random-suffix]
   Region: us-east-1 (recommended)
   Versioning: ✅ Enable
   Encryption: ✅ Enable (AES-256)
   ```

### 4. Configure OIDC for GitHub Actions

This allows GitHub to deploy without storing AWS credentials:

1. **Navigate to IAM > Identity Providers**
2. **Add Provider**
   ```
   Provider Type: OpenID Connect
   Provider URL: https://token.actions.githubusercontent.com
   Audience: sts.amazonaws.com
   ```

3. **Create IAM Role**
   ```
   Role name: GitHubActionsRole
   Trust entity: Web identity
   Identity provider: token.actions.githubusercontent.com
   Audience: sts.amazonaws.com
   Condition: StringEquals:token.actions.githubusercontent.com:sub: repo:YOUR_USERNAME/yourpartyserver:ref:refs/heads/main
   ```

4. **Attach Deployment Policy**
   Attach the same policy created for the IAM user above.

## 🤖 Discord Bot Configuration

### 1. Create Discord Application

1. **Visit [Discord Developer Portal](https://discord.com/developers/applications)**
2. **Click "New Application"**
   ```
   Application Name: YourPartyServer [Your Server Name]
   ```
3. **Configure Application**
   - Add description and icon
   - Note the Application ID

### 2. Create Bot User

1. **Navigate to "Bot" section**
2. **Click "Add Bot"**
3. **Configure Bot Settings**
   ```
   Username: YourPartyServer
   Icon: Upload your server's logo
   Public Bot: ❌ Disabled (for private use)
   Requires OAuth2 Code Grant: ❌ Disabled
   ```

4. **Get Bot Token**
   ```
   Click "Reset Token" and copy the new token
   Format: MTI...
   ```
   > ⚠️ **Security**: Keep this token secret!

### 3. Configure Bot Permissions

In the "OAuth2 > URL Generator" section:

1. **Select Scopes**
   ```
   ✅ bot
   ✅ applications.commands
   ```

2. **Select Bot Permissions**
   ```
   ✅ Read Messages/View Channels
   ✅ Send Messages
   ✅ Manage Messages
   ✅ Manage Roles
   ✅ Add Reactions
   ✅ Read Message History
   ✅ Use External Emojis
   ```

3. **Generate Invite URL**
   Copy the generated URL for later use.

## 📂 GitHub Repository Setup

### 1. Fork the Repository

1. **Visit [YourPartyServer Repository](https://github.com/[PLACEHOLDER_REPO])**
2. **Click "Fork"**
3. **Choose your account**
4. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/yourpartyserver.git
   cd yourpartyserver
   ```

### 2. Configure Repository Secrets

Add these secrets in GitHub repository settings:

1. **Navigate to Settings > Secrets and variables > Actions**
2. **Add Repository Secrets**
   ```
   AWS_REGION: us-east-1
   AWS_ROLE_ARN: arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsRole
   TERRAFORM_STATE_BUCKET: yourpartyserver-terraform-state-[suffix]
   ```

### 3. Configure Repository Variables

Add these variables for your deployment:

```
DISCORD_BOT_TOKEN: [Your bot token from Discord]
GUILD_ID: [Your Discord server ID]
```

To get your Guild ID:
1. Enable Developer Mode in Discord (User Settings > Advanced)
2. Right-click your server name
3. Click "Copy ID"

## ⚙️ Terraform Configuration

### 1. Update Terraform Variables

Edit `terraform/terraform.tfvars`:

```hcl
# Discord Configuration
guild_id     = "YOUR_GUILD_ID_HERE"
bot_token    = "YOUR_BOT_TOKEN_HERE"

# AWS Configuration  
aws_region   = "us-east-1"
project_name = "yourpartyserver"

# Server Configuration
server_name        = "Your Community Name"
server_description = "A democratic Discord community"

# Proposal Configuration
proposal_types = {
  policy = {
    support_threshold = 3
    vote_duration     = 86400000  # 24 hours in milliseconds
    formats          = ["Policy"]
  }
  governance = {
    support_threshold = 5
    vote_duration     = 172800000  # 48 hours
    formats          = ["Governance", "Constitution"]
  }
}

# Instance Configuration
instance_type = "t3.micro"  # Eligible for free tier
enable_monitoring = true
```

### 2. Customize Channel Names

Edit `terraform/channels.tf` to match your preferences:

```hcl
# Welcome and General Channels
resource "discord_channel" "general" {
  name     = "general"  # Change to your preference
  guild_id = var.guild_id
  type     = 0
  topic    = "General community discussion"
}

resource "discord_channel" "welcome" {
  name     = "welcome"  # Change to your preference
  guild_id = var.guild_id
  type     = 0
  topic    = "Welcome new members! React with ✅ to get member role"
}

# Governance Channels
resource "discord_channel" "policy_debate" {
  name     = "policy-proposals"  # Customize name
  guild_id = var.guild_id
  type     = 0
  topic    = "Discuss policy changes before voting. Format: **Policy**: [proposal]"
}
```

### 3. Configure Roles

Edit `terraform/channels.tf` role configuration:

```hcl
resource "discord_role" "member" {
  guild_id = var.guild_id
  name     = "Member"  # Change if needed
  color    = 3447003   # Blue color (hex: #3498DB)
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
  name     = "Moderator"  # Change if needed
  color    = 15158332     # Red color (hex: #E74C3C)
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

### 4. Update Backend Configuration

Edit `terraform/backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket = "yourpartyserver-terraform-state-[your-suffix]"
    key    = "terraform.tfstate"
    region = "us-east-1"
    
    # Enable state locking
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

## 🚀 Deployment Process

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Plan Deployment

```bash
terraform plan -var-file="terraform.tfvars"
```

Review the planned changes carefully.

### 3. Apply Configuration

```bash
terraform apply -var-file="terraform.tfvars"
```

Type `yes` when prompted.

This will create:
- EC2 instance running the bot
- S3 bucket for data storage  
- IAM roles and policies
- Discord channels and roles
- Security groups and networking

### 4. Verify Deployment

Check the Terraform output:

```bash
# Should show bot instance details
terraform output bot_instance_id
terraform output bot_public_ip
terraform output s3_bucket_name
```

## 🎮 Discord Server Configuration

### 1. Invite the Bot

1. **Use the OAuth2 URL** generated earlier
2. **Select your Discord server**
3. **Authorize the bot**
4. **Verify bot appears** in member list

### 2. Configure Channel Permissions

Set up channel permissions for proper bot operation:

#### General Channels
```
#general:
- @everyone: View, Send Messages, Add Reactions
- @Member: View, Send Messages, Add Reactions  
- @Moderator: All permissions

#welcome:
- @everyone: View, Add Reactions (Read-only except reactions)
- Bot: All permissions
```

#### Command Channels
```
#bot-commands:
- @Moderator: All permissions
- Others: No access

#member-commands:  
- @Member: View, Send Messages
- @Moderator: All permissions
```

#### Governance Channels
```
#policy-proposals:
- @Member: View, Send Messages, Add Reactions
- Bot: All permissions

#policy-vote:
- @Member: View, Add Reactions (No send messages)
- Bot: All permissions

#policy-resolutions:
- @Member: View (Read-only)
- Bot: All permissions
```

### 3. Create Welcome Message

In your #welcome channel, send this message:

```markdown
# Welcome to [Your Community Name]! 👋

React with ✅ below to get your **Member** role and access all channels!

## 🎯 Quick Start:
🔸 Read the rules in #rules
🔸 Introduce yourself in #introductions
🔸 Join discussions in #general
🔸 Get help in #member-commands

## 🗳️ Community Governance:
Our community makes decisions together through proposals and voting!

**How it works:**
1. **Propose**: Share ideas in debate channels (like #policy-proposals)
2. **Support**: Get community support (3+ ✅ reactions)  
3. **Vote**: Community votes in voting channels
4. **Decide**: Passed proposals become official resolutions

**Proposal Format:**
```
**Policy**: [Your proposal title]

[Detailed description of your proposal]

**Why**: Explain why this change is needed
**Impact**: How this affects the community
```

Need help? Ask in #member-commands or DM a moderator!

---
*Powered by YourPartyServer - Democratic Discord Governance*
```

### 4. Configure Bot Commands

Test the bot with these initial commands:

```
!help                    # Verify bot responds
!viewconfig             # Should show empty config initially
```

### 5. Set Up Initial Reaction Role

Configure the welcome message for automatic role assignment:

```
!addconfig {"from": "WELCOME_MESSAGE_ID", "action": "✅", "to": "AddRole(user_id,'Member')"}
```

To get the message ID:
1. Enable Developer Mode in Discord
2. Right-click the welcome message  
3. Click "Copy ID"

## 🧪 Testing Your Deployment

### 1. Basic Bot Functionality

Test these core features:

```bash
# In #member-commands:
!help           # Should show member commands
!proposals      # Should show empty proposal list initially
!activevotes    # Should show no active votes

# In #bot-commands (as moderator):
!help           # Should show moderator commands  
!viewconfig     # Should show reaction role config
```

### 2. Reaction Role System

1. **React to welcome message** with ✅
2. **Verify you get Member role**
3. **Remove reaction and verify role removal**

### 3. Proposal System

Create a test proposal:

1. **In #policy-proposals, post:**
   ```
   **Policy**: Test Proposal
   
   This is a test to verify the proposal system works correctly.
   ```

2. **Add 3 ✅ reactions** (use alt accounts or ask friends)
3. **Verify proposal advances** to #policy-vote
4. **Vote on the proposal** with ✅ or ❌
5. **Wait for voting period** to end (or use `!forcevote MESSAGE_ID`)
6. **Check #policy-resolutions** for result

### 4. Error Testing

Test error conditions:

```bash
# Invalid commands
!invalidcommand         # Should show "unknown command"

# Insufficient permissions  
!addconfig {...}        # Should fail for non-moderators

# Invalid proposal formats
Just some random text   # Should not trigger proposal system
```

## 🔧 Ongoing Maintenance

### 1. Monitor Bot Health

Set up monitoring:

```bash
# Check bot status
ssh -i ~/.ssh/yourpartyserver.pem ec2-user@BOT_PUBLIC_IP
sudo systemctl status yourpartyserver-bot
sudo journalctl -u yourpartyserver-bot -f
```

### 2. Update Bot Code

When updates are available:

1. **Fork receives updates** via pull request or manual sync
2. **GitHub Actions automatically deploys** changes
3. **Terraform replaces EC2 instance** with updated code
4. **Bot restarts with new features**

### 3. Backup Data

Bot data is automatically backed up to S3:
- **Configurations**: `s3://your-bucket/bot/discord-bot-config-GUILD_ID.json`
- **Proposals**: `s3://your-bucket/bot/proposals-GUILD_ID.json`

Download backups periodically:

```bash
aws s3 cp s3://your-bucket/bot/ ./backups/ --recursive
```

### 4. Cost Monitoring

Monitor AWS costs:

1. **Set up billing alerts** in AWS Console
2. **Review monthly bills** for unexpected charges
3. **Optimize instance size** if needed
4. **Clean up unused resources**

## 🐛 Troubleshooting

### Common Issues

#### Bot Not Responding
```bash
# Check if bot is running
ssh ec2-user@BOT_IP
sudo systemctl status yourpartyserver-bot

# Check logs for errors
sudo journalctl -u yourpartyserver-bot --since "1 hour ago"

# Restart bot if needed
sudo systemctl restart yourpartyserver-bot
```

#### Permission Errors
```bash
# Verify IAM role permissions
aws sts get-caller-identity

# Check EC2 instance role
aws ec2 describe-instances --instance-ids i-1234567890abcdef0
```

#### S3 Access Issues
```bash
# Test S3 access from bot instance
aws s3 ls s3://your-bucket-name/
aws s3 cp test.txt s3://your-bucket-name/test.txt
```

#### Discord API Errors
- **Check bot token** is correct and not expired
- **Verify bot permissions** in Discord server
- **Check rate limits** in bot logs

#### Terraform Errors
```bash
# Refresh state
terraform refresh

# Import existing resources if needed
terraform import aws_instance.bot_instance i-1234567890abcdef0

# Destroy and recreate if corrupted
terraform destroy
terraform apply
```

### Getting Help

If you encounter issues:

1. **Check Bot Logs**
   ```bash
   sudo journalctl -u yourpartyserver-bot -n 100
   ```

2. **Review AWS CloudWatch** (if enabled)
   - EC2 instance metrics
   - Application logs

3. **Community Support**
   - GitHub Issues: [PLACEHOLDER_ISSUES_LINK]
   - Discord Community: [PLACEHOLDER_DISCORD_INVITE]
   - Documentation: [PLACEHOLDER_DOCS_LINK]

4. **Debug Mode**
   Enable verbose logging:
   ```bash
   # Edit environment variables
   sudo nano /etc/systemd/system/yourpartyserver-bot.service
   
   # Add DEBUG=true to Environment section
   Environment=DEBUG=true
   
   # Restart service
   sudo systemctl daemon-reload
   sudo systemctl restart yourpartyserver-bot
   ```

## 💰 Cost Optimization

### Reduce AWS Costs

#### 1. Right-Size Your Instance
```hcl
# In terraform/variables.tf, use smaller instance if possible
variable "instance_type" {
  default = "t3.nano"  # $3.8/month vs t3.micro $8.5/month
}
```

#### 2. Use Spot Instances
```hcl
# In terraform/bot.tf
resource "aws_instance" "bot_instance" {
  instance_market_options {
    market_type = "spot"
    spot_options {
      max_price = "0.01"  # Set maximum hourly price
    }
  }
}
```

#### 3. Schedule Instance Downtime
```bash
# Stop instance during low-usage hours
aws ec2 stop-instances --instance-ids i-1234567890abcdef0

# Start instance when needed  
aws ec2 start-instances --instance-ids i-1234567890abcdef0
```

#### 4. Optimize S3 Storage
```hcl
# Enable S3 lifecycle policies
resource "aws_s3_bucket_lifecycle_configuration" "bot_data" {
  bucket = aws_s3_bucket.bot_data.id

  rule {
    id     = "archive_old_data"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}
```

### Monitor Costs

Set up cost alerts:

```hcl
# In terraform/monitoring.tf
resource "aws_budgets_budget" "monthly_cost" {
  name     = "yourpartyserver-monthly-budget"
  limit_amount = "20"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  budget_type  = "COST"

  cost_filters = {
    Service = ["Amazon Elastic Compute Cloud - Compute"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["your-email@example.com"]
  }
}
```

## 🎉 Congratulations!

You've successfully deployed your own YourPartyServer instance! Your Discord community now has:

✅ **Automated role management** through reactions  
✅ **Democratic proposal system** for community governance  
✅ **Persistent data storage** that survives updates  
✅ **Automated deployment pipeline** for easy updates  
✅ **Cost-effective AWS infrastructure** optimized for small communities  

### Next Steps

1. **Customize your bot** by modifying Terraform configurations
2. **Engage your community** by teaching them about governance features
3. **Monitor and maintain** your deployment  
4. **Contribute back** by sharing improvements with the community

### Stay Connected

- **Documentation**: [PLACEHOLDER_DOCS_LINK]
- **Community Discord**: [PLACEHOLDER_DISCORD_INVITE]  
- **GitHub Repository**: [PLACEHOLDER_REPO_LINK]
- **Issue Tracker**: [PLACEHOLDER_ISSUES_LINK]

---

**Welcome to the YourPartyServer community!** 🚀

*You're now empowering your Discord community with democratic governance and automated moderation.*