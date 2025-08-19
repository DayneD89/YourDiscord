# =============================================================================
# MAIN DISCORD SERVER CONFIGURATION
# =============================================================================
# This file contains the primary Discord server setup including:
# - Server creation with branding
# - Server-wide invite generation
# - Output values for other modules and deployment scripts
# =============================================================================

# -----------------------------------------------------------------------------
# SERVER BRANDING ASSETS
# -----------------------------------------------------------------------------
# Load the server icon image from local file system
# This image will be automatically encoded to base64 and set as server icon
data "discord_local_image" "logo" {
  file = "images/${var.env}_server.jpg" # Path relative to terraform directory
}

# -----------------------------------------------------------------------------
# DISCORD SERVER RESOURCE
# -----------------------------------------------------------------------------
# Creates the main Discord server with environment-specific naming
# Production uses "Your Party Supporters", other environments get prefixed
resource "discord_server" "server" {
  # Environment-aware server naming:
  # - Production (main): "Your Party Supporters" 
  # - Development/Feature branches: "YPS - {branch_name}"
  name = var.env == "main" ? "Your Party Supporters" : "YPS - ${var.env}"

  # Disable @everyone notifications by default to reduce spam
  # 0 = Only @mentions, 1 = All messages
  default_message_notifications = 0

  # Set server icon using the loaded image data
  icon_data_uri = data.discord_local_image.logo.data_uri
}

# -----------------------------------------------------------------------------
# SERVER INVITE LINK
# -----------------------------------------------------------------------------
# Creates a permanent invite link for the welcome channel
# This invite never expires and can be shared publicly
resource "discord_invite" "this" {
  # Link to the main welcome/onboarding channel
  channel_id = local.channels["welcome_start_here"]

  # max_age = 0 means the invite never expires
  # This is safe for public sharing and recruitment
  max_age = 0
}

# =============================================================================
# TERRAFORM OUTPUTS
# =============================================================================
# These outputs are used by:
# - GitHub Actions deployment scripts
# - Bot configuration generation
# - Integration with external systems
# - Debugging and verification
# =============================================================================

# Public invite link for sharing and recruitment
output "invite" {
  description = "Public Discord invite link for server access"
  value       = "https://discord.gg/${discord_invite.this.code}"
}

# Server ID for bot configuration and API calls
output "server" {
  description = "Discord server ID for bot authentication"
  value       = discord_server.server.id
}

# Welcome message content for bot deployment
output "welcome" {
  description = "Welcome message content for new member onboarding"
  value       = local.messages["welcome_start_here_welcome_message"]
}

# Member role ID for bot permission checking
output "member" {
  description = "Member role ID for bot access control"
  value       = discord_role.member.id
}

# Moderator role ID for bot admin functions
output "mod" {
  description = "Moderator role ID for bot administrative access"
  value       = discord_role.moderator.id
}

# Bot command channel ID for configuration
output "bot" {
  description = "Primary bot command channel for moderator interactions"
  value       = local.channels["governance_bot"]
}
