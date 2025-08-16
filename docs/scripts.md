# Scripts Documentation

This document provides comprehensive documentation for all utility scripts in the YourDiscord project, including setup scripts, security tools, and Terraform helpers.

## 📁 Scripts Overview

All scripts are located in the `scripts/` directory:

```
scripts/
├── setup-security.sh          # Security setup and pre-commit hooks
├── terraform-wrapper.sh       # Smart Terraform wrapper with Discord API handling
└── terraform-apply-retry.sh   # Focused retry script for Terraform apply operations
```

## 🔒 Security Scripts

### setup-security.sh

**Purpose**: Automates the setup of security measures to prevent accidental commits of Discord tokens and other secrets.

#### What It Does
1. **Installs pre-commit** - Python package for git hook management
2. **Installs pre-commit hooks** - Configures hooks defined in `.pre-commit-config.yaml`
3. **Sets up detect-secrets** - Creates baseline for secret detection
4. **Validates installation** - Confirms all tools are working correctly

#### Usage
```bash
# Make executable (if needed)
chmod +x scripts/setup-security.sh

# Run setup
./scripts/setup-security.sh
```

#### Output Example
```
🔒 Setting up security measures for YourDiscord project...
📦 Installing pre-commit...
🪝 Installing pre-commit hooks...
🔍 Creating secrets baseline...
✅ Security setup complete!

🛡️ Security measures now active:
  ✓ Pre-commit hooks will scan for Discord tokens
  ✓ AWS credentials detection enabled
  ✓ Large file prevention (>1MB)
  ✓ Private key detection
  ✓ JSON/YAML validation

💡 Pro tip: Run 'pre-commit run --all-files' to test all files now
```

#### Requirements
- **Python 3.6+** with pip
- **Git repository** (must be run in git repo)
- **Internet connection** for downloading packages

#### Error Handling
- **No pip**: Provides installation instructions
- **No git**: Warns about git repository requirement
- **Permission issues**: Suggests using sudo or virtual environment

#### Security Features Enabled
1. **Discord Token Detection**
   - Pattern: `(mfa\.[a-zA-Z0-9_-]{20,}|[a-zA-Z0-9_-]{23,28}\.[a-zA-Z0-9_-]{6,7}\.[a-zA-Z0-9_-]{27})`
   - **Action**: Blocks commit
   
2. **AWS Credentials Detection**
   - Pattern: `(AKIA[0-9A-Z]{16}|aws_access_key|aws_secret)`
   - **Action**: Blocks commit
   
3. **General Security Checks**
   - Large files (>1MB)
   - Private keys
   - Trailing whitespace
   - YAML/JSON syntax validation
   - Merge conflict markers

## 🔧 Terraform Scripts

### terraform-wrapper.sh

**Purpose**: Intelligent Terraform wrapper that optimizes operations for Discord API reliability with automatic error detection and retry logic.

#### Key Features
- **Discord API Health Checks** - Validates API connectivity before operations
- **Automatic Retry Logic** - Detects Discord API errors and retries with exponential backoff
- **Optimized Parallelism** - Reduces concurrent operations to prevent rate limiting
- **Intelligent Error Suggestions** - Provides actionable advice for common issues
- **Colored Output** - Easy-to-read status messages and error reporting

#### Usage
```bash
# Replace any terraform command with the wrapper
./scripts/terraform-wrapper.sh plan
./scripts/terraform-wrapper.sh apply
./scripts/terraform-wrapper.sh apply -auto-approve
./scripts/terraform-wrapper.sh destroy
./scripts/terraform-wrapper.sh refresh
```

#### Command Line Arguments
The wrapper accepts all standard Terraform arguments and passes them through with optimizations:

- **Automatic parallelism**: Adds `-parallelism=3` if not specified
- **Preserves existing args**: Won't override your parallelism settings
- **Command detection**: Only applies optimizations to relevant commands

#### Discord API Error Detection
The script automatically detects these error patterns:

1. **Timeout Errors**
   ```
   context deadline exceeded
   Client.Timeout exceeded
   connection timeout
   ```

2. **Rate Limiting**
   ```
   rate limited
   discord.*rate.*limit
   ```

3. **Resource Issues**
   ```
   Failed to find channel
   Failed to find role
   ```

#### Retry Logic
- **Maximum retries**: 3 attempts
- **Base delay**: 30 seconds
- **Exponential backoff**: Increases delay by 15 seconds each retry
- **Intelligent detection**: Only retries Discord-specific errors

#### Health Check Process
Before Discord operations, the wrapper:
1. Tests connectivity to `https://discord.com/api/v9/gateway`
2. Uses 10-second timeout with 5-second connect timeout
3. Allows manual override if health check fails
4. Provides Discord status page link

#### Example Output
```bash
🤖 Discord Terraform Wrapper
Optimized for Discord API reliability

🔍 Checking Discord API health...
✅ Discord API is healthy

ℹ️ Using parallelism=3 to prevent Discord rate limits

🔄 Attempt 1 of 3
Running: terraform apply -auto-approve -parallelism=3

✅ Terraform command completed successfully!
```

#### Error Example with Suggestions
```bash
❌ Terraform command failed (exit code: 1)
🔍 Discord API error detected
⏳ Waiting 30 seconds before retry...

💡 Suggestions to fix Discord API issues:

• This is usually a temporary Discord API timeout
• Try running the command again in a few minutes
• Consider using: terraform apply -parallelism=1

General tips:
• Check Discord status: https://discordstatus.com/
• Use retry script: ./scripts/terraform-apply-retry.sh
• Break large changes into smaller batches
```

### terraform-apply-retry.sh

**Purpose**: Focused retry script specifically for `terraform apply` operations with Discord API timeout handling.

#### Key Features
- **Terraform Apply Focus** - Optimized specifically for apply operations
- **Configurable Retries** - Easily adjustable retry count and delays
- **Error Pattern Matching** - Sophisticated Discord error detection
- **Detailed Logging** - Comprehensive output for troubleshooting
- **Exit Code Preservation** - Maintains original Terraform exit codes

#### Usage
```bash
# Basic usage
./scripts/terraform-apply-retry.sh

# With terraform directory
./scripts/terraform-apply-retry.sh terraform

# With additional terraform arguments
./scripts/terraform-apply-retry.sh terraform -auto-approve -var="env=staging"
```

#### Configuration Variables
```bash
MAX_RETRIES=5          # Maximum number of retry attempts
RETRY_DELAY=30         # Initial delay between retries (seconds)  
TERRAFORM_DIR="terraform"  # Default terraform directory
```

#### Discord Error Patterns
The script detects these specific error patterns for retry decisions:

```bash
# Timeout patterns
"context deadline exceeded"
"rate limited" 
"connection timeout"
"Client.Timeout exceeded"
"Failed to find channel"
```

#### Retry Strategy
1. **Immediate first attempt** - No delay for initial try
2. **Exponential backoff** - Delay increases by 15 seconds each retry
3. **Maximum attempts** - Configurable limit (default: 5)
4. **Pattern matching** - Only retries Discord-specific errors
5. **Final exit** - Returns original error if all retries exhausted

#### Example Output
```bash
🚀 Starting Terraform apply with Discord API retry logic...
📁 Working directory: terraform
🔧 Additional args: -auto-approve
🔄 Max retries: 5

🔄 Attempt 1 of 5
⏰ 2024-01-15 14:30:25

❌ Terraform apply failed with exit code: 1
🔍 Discord API error detected. This is likely a timeout or rate limit issue.
⏳ Waiting 30 seconds before retry...
💡 Discord API errors are common and usually resolve with retries

🔄 Attempt 2 of 5
⏰ 2024-01-15 14:31:00

✅ Terraform apply completed successfully!
```

## 🛠️ Script Configuration

### Pre-commit Configuration
**File**: `.pre-commit-config.yaml`

The security setup script uses this configuration file:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-merge-conflict
      - id: detect-private-key
      - id: check-added-large-files
        args: ['--maxkb=1000']

  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
        exclude: package-lock.json

  - repo: local
    hooks:
      - id: discord-token-check
        name: Discord Token Detection
        entry: bash -c 'if grep -r -E "(mfa\.[a-zA-Z0-9_-]{20,}|[a-zA-Z0-9_-]{23,28}\.[a-zA-Z0-9_-]{6,7}\.[a-zA-Z0-9_-]{27})" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=coverage; then echo "❌ Discord token detected! Remove it before committing."; exit 1; fi'
        language: system
        pass_filenames: false
        
      - id: aws-credentials-check
        name: AWS Credentials Detection
        entry: bash -c 'if grep -r -E "(AKIA[0-9A-Z]{16}|aws_access_key|aws_secret)" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=coverage; then echo "❌ AWS credentials detected! Remove them before committing."; exit 1; fi'
        language: system
        pass_filenames: false
```

### Gitignore Configuration
The security scripts work with this `.gitignore` configuration:

```gitignore
# Discord bot tokens and secrets
TOKEN
DISCORD_TOKEN
*.token
.discord_token
config/secrets.json
secrets/

# AWS credentials
.aws/
aws-credentials.json

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
```

## 🔄 Integration with Workflows

### GitHub Actions Integration
The scripts integrate with GitHub Actions workflows:

1. **Security workflow** runs the same checks as local pre-commit hooks
2. **Test workflow** ensures scripts are executable and functional
3. **Deploy workflow** uses terraform wrapper for reliable deployments

### Local Development Workflow
```bash
# 1. Initial setup (run once)
./scripts/setup-security.sh

# 2. Daily development
git add .
git commit -m "Your changes"  # Pre-commit hooks run automatically

# 3. Terraform operations
./scripts/terraform-wrapper.sh plan
./scripts/terraform-wrapper.sh apply

# 4. If you encounter Discord API issues
./scripts/terraform-apply-retry.sh terraform apply
```

## 🚨 Troubleshooting Scripts

### Security Script Issues

**Pre-commit not found**
```bash
# Install pre-commit manually
pip install pre-commit
# or
pip3 install pre-commit
```

**Permission denied**
```bash
# Make script executable
chmod +x scripts/setup-security.sh
```

**Python/pip not found**
```bash
# On Ubuntu/Debian
sudo apt update && sudo apt install python3 python3-pip

# On macOS
brew install python3

# On Windows
# Download Python from python.org
```

### Terraform Script Issues

**Script not found**
```bash
# Ensure you're in project root
cd /path/to/yourpartyserver
./scripts/terraform-wrapper.sh apply
```

**Terraform not found**
```bash
# Install Terraform
# Visit: https://terraform.io/downloads
```

**Discord API still timing out**
```bash
# Check Discord status
curl -s https://discordstatus.com/

# Use maximum retries
./scripts/terraform-apply-retry.sh terraform apply

# Use minimal parallelism
terraform apply -parallelism=1
```

## 📊 Script Monitoring

### Success Metrics
- **Pre-commit hook success rate** - Should be near 100%
- **Terraform retry success rate** - Typically 80-90% on second attempt
- **Security detection accuracy** - Monitor false positives

### Logging
All scripts provide:
- **Timestamped output** for tracking execution time
- **Color-coded messages** for easy status identification
- **Detailed error information** for troubleshooting
- **Actionable suggestions** for issue resolution

### Maintenance
- **Update pre-commit hooks** quarterly
- **Review error patterns** in Terraform scripts monthly  
- **Check Discord API patterns** when Discord updates their API
- **Test scripts** after major repository changes