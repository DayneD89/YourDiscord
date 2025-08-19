# =============================================================================
# TERRAFORM CONFIGURATION & PROVIDERS
# =============================================================================
# This file configures Terraform settings and required providers for:
# - Discord server management via Discord Terraform Provider
# - AWS infrastructure for bot hosting and state storage
# - Remote state management for collaboration and state safety
# =============================================================================

# -----------------------------------------------------------------------------
# TERRAFORM CORE CONFIGURATION
# -----------------------------------------------------------------------------
terraform {
  # -----------------------------------------------------------------------------
  # REMOTE STATE STORAGE (S3 Backend)
  # -----------------------------------------------------------------------------
  # Store Terraform state in AWS S3 for:
  # - Team collaboration (shared state)
  # - State safety and backup
  # - State locking to prevent conflicts
  # - Environment isolation via different state keys
  backend "s3" {
    # S3 bucket for state storage - created manually or via separate setup
    bucket = "yourdiscord-terraform-state"

    # AWS region for state bucket (should match provider region)
    region = "us-west-2"

    # Encrypt state at rest for security (contains sensitive Discord IDs)
    encrypt = true

    # Note: The state key is provided via CLI during terraform init:
    # terraform init -backend-config="key=discord/{environment}/terraform.tfstate"
    # This allows multiple environments to use the same bucket safely
  }

  # -----------------------------------------------------------------------------
  # REQUIRED PROVIDER VERSIONS
  # -----------------------------------------------------------------------------
  # Pin provider versions for reproducible deployments
  # Version constraints prevent breaking changes from affecting deployments
  required_providers {
    # Discord Terraform Provider for server management
    # Allows Infrastructure as Code for Discord servers
    discord = {
      source  = "Lucky3028/discord" # Provider registry location
      version = "~> 2.0"            # Allow minor version updates for stability fixes
    }

    # AWS Provider for EC2, S3, and other AWS resources
    # Used for bot hosting infrastructure
    aws = {
      source  = "hashicorp/aws" # Official AWS provider
      version = "~> 6.0"        # Use AWS provider 6.x with latest features
    }
  }

  # Require minimum Terraform version for feature compatibility
  required_version = ">= 1.0"
}

# =============================================================================
# PROVIDER CONFIGURATIONS
# =============================================================================

# -----------------------------------------------------------------------------
# DISCORD PROVIDER CONFIGURATION
# -----------------------------------------------------------------------------
# Configures the Discord provider for server management
# Requires a bot token with appropriate permissions
provider "discord" {
  # Discord bot token from variables (marked sensitive)
  # Token must have:
  # - Manage Server permission
  # - Manage Channels permission  
  # - Manage Roles permission
  # - Send Messages permission
  token = var.discord_token

  # Note: Discord provider doesn't support retry configuration
  # Retry logic is handled by our wrapper scripts instead:
  # - ./scripts/terraform-wrapper.sh
  # - ./scripts/terraform-apply-retry.sh
}

# -----------------------------------------------------------------------------
# AWS PROVIDER CONFIGURATION
# -----------------------------------------------------------------------------
# Configures AWS provider for infrastructure resources
# Authentication handled via:
# - GitHub Actions: OIDC role assumption
# - Local development: AWS CLI profile or environment variables
provider "aws" {
  # Primary region for all AWS resources
  # us-west-2 chosen for low latency and feature availability
  region = "us-west-2"

  # Default tags applied to all AWS resources for organization
  default_tags {
    tags = {
      Project     = "YourDiscord"
      Environment = var.env
      ManagedBy   = "Terraform"
      Repository  = "https://github.com/DayneD89/YourDiscord"
    }
  }
}