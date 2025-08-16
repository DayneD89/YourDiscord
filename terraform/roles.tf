# =============================================================================
# DISCORD SERVER ROLES CONFIGURATION
# =============================================================================
# This file defines all Discord roles for the server including:
# - Administrative roles (Moderator)
# - Member roles (Member) 
# - Geographic organization roles (Region, Town)
# - Role permissions and visual styling
# =============================================================================

# -----------------------------------------------------------------------------
# MODERATOR ROLE
# -----------------------------------------------------------------------------
# Primary administrative role with extensive server management permissions
# Moderators can manage channels, roles, members, and bot configurations
resource "discord_role" "moderator" {
    # Link to the Discord server created in main.tf
    server_id = discord_server.server.id
    
    # Role display name visible to all members
    name = "Moderator"
    
    # Role color in Discord (hexadecimal format without #)
    # 16711680 = #FF0000 (Red) - makes moderators easily identifiable
    color = "16711680"
    
    # Allow @Moderator mentions for important announcements
    # This enables emergency notifications and coordination
    mentionable = true
    
    # Discord permission integer for extensive server management
    # This number represents a bitfield of Discord permissions including:
    # - Manage Server (0x20)
    # - Manage Channels (0x10) 
    # - Manage Roles (0x10000000)
    # - Kick/Ban Members (0x2, 0x4)
    # - Manage Messages (0x2000)
    # - Send Messages in all channels
    # - View audit logs
    # Full calculation: 71488619232390 includes all moderator permissions
    permissions = "71488619232390"
}

# -----------------------------------------------------------------------------
# MEMBER ROLE
# -----------------------------------------------------------------------------
# Standard member role for community participants
# Provides access to member-only channels and bot commands
resource "discord_role" "member" {
    # Link to the Discord server
    server_id = discord_server.server.id
    
    # Role display name for community members
    name = "Member"
    
    # Role color in Discord
    # 16719390 = #FF909E (Light red/pink) - distinguishes members from guests
    color = "16719390"
    
    # Member role doesn't need special permissions beyond default
    # Discord's default permissions are sufficient for members
    # No explicit permissions = Discord default permissions apply
}

# -----------------------------------------------------------------------------
# REGIONAL ROLES
# -----------------------------------------------------------------------------
# Geographic organization roles for location-based community features
# These roles help organize members by geographic regions for:
# - Local event coordination
# - Regional discussions
# - Location-specific announcements

# Create one role for each region defined in locals
# Uses for_each to iterate over the region objects from locals.tf
resource "discord_role" "region" {
    # Transform region list into a map for for_each iteration
    # Key: region identifier, Value: region object with metadata
    for_each = { for r in local.region_objs : r.key => r }

    # Link to the Discord server
    server_id = discord_server.server.id
    
    # Use the region name from locals configuration
    # This allows centralized management of region names
    name = each.value.name
    
    # Regional roles use default Discord permissions
    # Members can see channels but have standard interaction rights
    # No special permissions needed for geographic organization
}

# -----------------------------------------------------------------------------
# TOWN/CITY ROLES
# -----------------------------------------------------------------------------
# More granular geographic roles for specific towns/cities within regions
# Provides fine-grained location organization for local coordination

# Create town roles with composite keys to handle multiple towns per region
# Uses nested iteration over regions and their towns
resource "discord_role" "town" {
    # Create composite key format: "region__town" to ensure uniqueness
    # This prevents town name conflicts across different regions
    for_each = {
        for o in local.town_objs : "${o.region_key}__${o.town_key}" => o
    }

    # Link to the Discord server
    server_id = discord_server.server.id
    
    # Use the town name from the nested locals configuration
    # Town names are defined within their parent region objects
    name = each.value.town_name
    
    # Town roles also use default permissions
    # These are organizational roles, not permission-granting roles
}
