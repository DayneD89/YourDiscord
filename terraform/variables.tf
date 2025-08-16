# =============================================================================
# TERRAFORM INPUT VARIABLES
# =============================================================================
# This file defines all input variables used across the Discord server 
# infrastructure. Variables allow customization for different environments
# and keep sensitive data separate from code.
# =============================================================================

# -----------------------------------------------------------------------------
# DISCORD BOT AUTHENTICATION
# -----------------------------------------------------------------------------
# Discord bot token for API authentication
# This token is obtained from Discord Developer Portal and allows the bot
# to authenticate with Discord's API to manage the server
variable "discord_token" {
    # String type ensures proper handling of the token format
    type = string
    
    # Mark as sensitive to prevent accidental exposure in logs/output
    # Terraform will hide this value in plan/apply output for security
    sensitive = true
    
    # Description for documentation and validation
    description = "Discord bot token for API authentication. Obtain from Discord Developer Portal > Bot > Token"
    
    # Validation to ensure token follows Discord's format
    # Discord bot tokens start with specific prefixes and have minimum length
    validation {
        condition = can(regex("^[A-Za-z0-9._-]{59,}$", var.discord_token))
        error_message = "Discord token must be a valid format (typically 59+ characters of alphanumeric, dots, underscores, and hyphens)."
    }
}

# -----------------------------------------------------------------------------
# DEPLOYMENT ENVIRONMENT
# -----------------------------------------------------------------------------
# Environment identifier for multi-environment deployments
# Used for naming resources and conditional logic
variable "env" {
    # String type for environment name
    type = string
    
    # Default to development environment for safety
    # Production deployments should explicitly set this to "main"
    default = "dev"
    
    # Description for documentation
    description = "Deployment environment (main for production, branch name for development)"
    
    # Validation to ensure consistent naming conventions
    # Environments should be lowercase and use hyphens for readability
    validation {
        condition = can(regex("^[a-z0-9-]+$", var.env))
        error_message = "Environment must be lowercase alphanumeric with hyphens only (e.g., 'main', 'dev', 'feature-branch')."
    }
}

# -----------------------------------------------------------------------------
# NETWORKING CONFIGURATION
# -----------------------------------------------------------------------------
# Whether to deploy bot in private subnet for enhanced security
variable "use_private_subnet" {
    # Boolean type for feature flag
    type = bool
    
    # Default to true for security best practices
    # Private subnet provides enhanced security with NAT Gateway
    default = true
    
    # Description explaining the security benefits
    description = <<-EOT
        Deploy bot in private subnet with NAT Gateway for enhanced security.
        
        Benefits:
        - No direct internet access (enhanced security)
        - Outbound-only connectivity through NAT Gateway  
        - Still allows Discord API communication
        - Supports zero-downtime deployments with health checks
        
        Set to false for simpler setup using public subnet.
    EOT
}

# -----------------------------------------------------------------------------
# DEPLOYMENT CONFIGURATION
# -----------------------------------------------------------------------------
# Note: Simplified deployment replaces old instance completely
# The create_before_destroy lifecycle ensures minimal downtime