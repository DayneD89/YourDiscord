# =============================================================================
# DISCORD CHANNEL CONFIGURATION
# =============================================================================
# This file defines the complete Discord server structure including:
# - Channel categories for organization
# - Individual channels within each category
# - Permission overrides for different user roles
# - Channel topics and descriptions
# - Message content configuration
# =============================================================================

locals {
    # =============================================================================
    # DISCORD SERVER STRUCTURE CONFIGURATION
    # =============================================================================
    # This configuration defines the entire Discord server layout using a 
    # hierarchical structure:
    # 1. Categories (channel groups)
    # 2. Channels within categories  
    # 3. Permission overrides for roles
    # 4. Message content assignments
    # =============================================================================
    
    discord_config = {
        categories = [
            # -------------------------------------------------------------------------
            # ENTRY & INFO CATEGORY
            # -------------------------------------------------------------------------
            # Public-facing channels for new user onboarding and server information
            # These channels are visible to everyone and provide essential info
            {
                name = "Entry & Info"
                key = "entry_info"
                
                # Category-level permissions applied to all channels unless overridden
                # "react_only" allows viewing and reacting but not posting messages
                permissions = {
                    everyone = "react_only"  # @everyone role gets read + react permissions
                }
        channels = [
          {
            name = "welcome-start-here"
            key = "welcome_start_here"
            topic = "Pick Member / Non-Member and your region."
            messages = ["welcome_message", "region_picker", "town_picker"]
          },
          {
            name = "rules-and-guide"
            key = "rules_and_guide"
            topic = "Server constitution and how to get started."
            messages = ["server_rules", "rules_summary", "channel_guide"]
          }
        ]
      },
      {
        name = "Members"
        key = "members"
        permissions = {
          everyone = "hide_view"
          member = "read_post"
        }
        channels = [
          {
            name = "members-chat"
            key = "members_chat"
            topic = "Members chat"
          },
          {
            name = "members-resolutions"
            key = "members_resolutions"
            topic = "Resolutions passed by members"
            sync_perms_with_category = false
            permissions = {
              everyone = "hide_view"
              member = "read_only"
            }
          },
          {
            name = "members-debate"
            key = "members_debate"
            topic = "Propose and debate resolutions"
            messages = ["proposal_guide", "withdraw_proposal_guide"]
          },
          {
            name = "members-vote"
            key = "members_vote"
            topic = "Vote on resolutions"
            sync_perms_with_category = false
            permissions = {
              everyone = "hide_view"
              member = "react_only"
            }
          },
          {
            name = "members-bot"
            key = "members_bot"
            topic = "Members bot commands"
          },
          {
            name = "members-memes"
            key = "members_memes"
            topic = "MeeMees"
          }
        ]
      },
      {
        name = "Governance"
        key = "governance"
        permissions = {
          everyone = "hide_view"
          member = "read_only"
        }
        channels = [
          {
            name = "governance-links"
            key = "governance_links"
            topic = "Links to governance resources"
            messages = ["contributing_guide"]
          },
          {
            name = "governance-debate"
            key = "governance_debate"
            topic = "Propose and debate governance resolutions"
            sync_perms_with_category = false
            messages = ["governance_proposal_guide"]
            permissions = {
              everyone = "hide_view"
              member = "read_post"
            }
          },
          {
            name = "governance-vote"
            key = "governance_vote"
            topic = "Vote on governance resolutions"
            permissions = {
              everyone = "hide_view"
              member = "react_only"
            }
          },
          {
            name = "governance-discussion"
            key = "governance_discussion"
            topic = "Moderator discussions"
          },
          {
            name = "governance-bot"
            key = "governance_bot"
            topic = "Bot Commands"
            ignore_position = true
          }
        ]
      }
    ]
  }

  # Discover all message files
  message_files = fileset("${path.module}/messages/", "*.md")
  
  # Create a map of message name to file content
  file_messages = {
    for file in local.message_files :
    replace(file, ".md", "") => file("${path.module}/messages/${file}")
  }
  
  # Dynamic messages that aren't files
  dynamic_messages = merge(
    {
      region_picker = local.region_picker_content
    },
    # Create separate entries for each town picker message
    {
      for k, v in local.per_region_town_content :
      "town_picker_${k}" => v
    }
  )
  
  # Combine file-based and dynamic messages
  available_messages = merge(local.file_messages, local.dynamic_messages)
  
  # Flatten all messages from channel configs with their order
  all_channel_messages = flatten([
    for category in local.discord_config.categories : [
      for channel in category.channels : [
        for msg_idx, msg_name in lookup(channel, "messages", []) : 
        # Handle town_picker specially - it creates multiple messages
        msg_name == "town_picker" ? [
          for k, v in local.per_region_town_content : {
            channel_key = channel.key
            message_name = "town_picker_${k}"
            order = msg_idx
            content = v
          }
        ] : [
          {
            channel_key = channel.key
            message_name = msg_name
            order = msg_idx
            content = local.available_messages[msg_name]
          }
        ]
      ] if lookup(channel, "messages", null) != null
    ]
  ])
  
  # Create a unique key for each message
  channel_messages = {
    for msg in local.all_channel_messages :
    "${msg.channel_key}_${msg.message_name}" => msg
  }

  # Role mapping for permissions
  role_mapping = {
    everyone = discord_server.server.id
    member = discord_role.member.id
    moderator = discord_role.moderator.id
  }

  # Pre-calculate all positions to avoid dependency issues
  total_channels_before_category = {
    for i in range(length(local.discord_config.categories)) :
    i => i == 0 ? 0 : sum([
      for j in range(i) : length(local.discord_config.categories[j].channels)
    ])
  }

  # Calculate positions and flatten structure
  categories_with_positions = [
    for cat_idx, category in local.discord_config.categories : merge(category, {
      position = cat_idx
      channels = [
        for ch_idx, channel in category.channels : merge(channel, {
          category_key = category.key
          category_position = cat_idx
          # Use pre-calculated positions
          position = local.total_channels_before_category[cat_idx] + ch_idx
        })
      ]
    })
  ]

  # Flatten all channels with metadata
  all_channels_flat = flatten([
    for category in local.categories_with_positions : [
      for channel in category.channels : merge(channel, {
        category_name = category.name
        category_permissions = category.permissions
      })
    ]
  ])

  # Split channels by position handling
  positioned_channels = {
    for ch in local.all_channels_flat : ch.key => ch
    if !lookup(ch, "ignore_position", false)
  }

  unpositioned_channels = {
    for ch in local.all_channels_flat : ch.key => ch
    if lookup(ch, "ignore_position", false)
  }

  # Permission data mapping
  permission_data = {
    hide_view = {
      allow = data.discord_permission.hide_view.allow_bits
      deny = data.discord_permission.hide_view.deny_bits
    }
    read_only = {
      allow = data.discord_permission.read_only.allow_bits
      deny = data.discord_permission.read_only.deny_bits
    }
    read_post = {
      allow = data.discord_permission.read_post.allow_bits
      deny = data.discord_permission.read_post.deny_bits
    }
    react_only = {
      allow = data.discord_permission.react_only.allow_bits
      deny = data.discord_permission.react_only.deny_bits
    }
  }

  # Create category lookup
  categories_by_key = {
    for cat in local.categories_with_positions : cat.key => cat
  }
}

# Categories
resource "discord_category_channel" "categories" {
  for_each = local.categories_by_key

  server_id = discord_server.server.id
  name      = each.value.name
  position  = each.value.position
}

# Category permissions
resource "discord_channel_permission" "category_permissions" {
  for_each = merge([
    for cat_key, category in local.categories_by_key : {
      for role_name, perm_type in category.permissions :
      "${cat_key}_${role_name}" => {
        category_key = cat_key
        role_name = role_name
        permission_type = perm_type
      }
    }
  ]...)

  channel_id   = discord_category_channel.categories[each.value.category_key].id
  type         = "role"
  overwrite_id = local.role_mapping[each.value.role_name]
  allow        = local.permission_data[each.value.permission_type].allow
  deny         = local.permission_data[each.value.permission_type].deny
}

# Positioned channels
resource "discord_text_channel" "channels" {
  for_each = local.positioned_channels

  server_id = discord_server.server.id
  name      = each.value.name
  category  = discord_category_channel.categories[each.value.category_key].id
  topic     = each.value.topic
  position  = each.value.position
  
  sync_perms_with_category = lookup(each.value, "permissions", null) == null
}

# Unpositioned channels (ignore position changes)
resource "discord_text_channel" "channels_unpositioned" {
  for_each = local.unpositioned_channels

  server_id = discord_server.server.id
  name      = each.value.name
  category  = discord_category_channel.categories[each.value.category_key].id
  topic     = each.value.topic
  
  sync_perms_with_category = lookup(each.value, "permissions", null) == null
  
  lifecycle {
    ignore_changes = [position]
  }
}

# Channel-specific permissions
resource "discord_channel_permission" "channel_permissions" {
  for_each = merge(
    {
      for item in flatten([
        for ch_key, channel in local.positioned_channels : 
        lookup(channel, "permissions", null) != null ? [
          for role_name, perm_type in channel.permissions : {
            key = "${ch_key}_${role_name}"
            value = {
              channel_key = ch_key
              role_name = role_name
              permission_type = perm_type
              resource_type = "positioned"
            }
          }
        ] : []
      ]) : item.key => item.value
    },
    {
      for item in flatten([
        for ch_key, channel in local.unpositioned_channels : 
        lookup(channel, "permissions", null) != null ? [
          for role_name, perm_type in channel.permissions : {
            key = "${ch_key}_${role_name}"
            value = {
              channel_key = ch_key
              role_name = role_name
              permission_type = perm_type
              resource_type = "unpositioned"
            }
          }
        ] : []
      ]) : item.key => item.value
    }
  )

  channel_id = each.value.resource_type == "positioned" ? discord_text_channel.channels[each.value.channel_key].id : discord_text_channel.channels_unpositioned[each.value.channel_key].id
  
  type         = "role"
  overwrite_id = local.role_mapping[each.value.role_name]
  allow        = local.permission_data[each.value.permission_type].allow
  deny         = local.permission_data[each.value.permission_type].deny
}

# Auto-generated messages from files
resource "discord_message" "channel_messages" {
  for_each = local.channel_messages
  
  channel_id = discord_text_channel.channels[each.value.channel_key].id
  content    = each.value.content
}

# Regional & Local (unchanged, positioned at end)
resource "discord_category_channel" "regional" {
  server_id = discord_server.server.id
  name      = "Regional & Local"
  # Use configuration length, not resource count
  position  = length(local.discord_config.categories)
}

resource "discord_channel_permission" "regional_everyone" {
  channel_id   = discord_category_channel.regional.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.hide_view.allow_bits
  deny         = data.discord_permission.hide_view.deny_bits
}

resource "discord_text_channel" "regional" {
  for_each = { for r in local.region_objs : r.key => r }

  server_id = discord_server.server.id
  name      = "regional-${each.value.key}"
  category  = discord_category_channel.regional.id
  topic     = "${each.value.name} regional chat"
  sync_perms_with_category = false

  lifecycle {
    ignore_changes = [position]
  }
}

resource "discord_channel_permission" "regional-ov" {
  for_each = { for r in local.region_objs : r.key => r }
  channel_id   = discord_text_channel.regional[each.key].id
  type         = "role"
  overwrite_id = discord_role.region[each.key].id
  allow        = data.discord_permission.read_post.allow_bits
  deny         = data.discord_permission.read_post.deny_bits
}

resource "discord_text_channel" "local" {
  for_each = {
    for o in local.town_objs : "${o.region_key}__${o.town_key}" => o
  }

  server_id = discord_server.server.id
  name      = "local-${each.value.town_key}"
  category  = discord_category_channel.regional.id
  topic     = "${each.value.town_name} chat (${each.value.region_name})"
  sync_perms_with_category = false
  
  lifecycle {
    ignore_changes = [position]
  }
}

resource "discord_channel_permission" "local-ov" {
  for_each = {
    for o in local.town_objs : "${o.region_key}__${o.town_key}" => o
  }
  channel_id   = discord_text_channel.local[each.key].id
  type         = "role"
  overwrite_id = discord_role.town[each.key].id
  allow        = data.discord_permission.read_post.allow_bits
  deny         = data.discord_permission.read_post.deny_bits
  
  # Add explicit dependencies and retry behavior
  depends_on = [
    discord_text_channel.local,
    discord_role.town
  ]
  
  # Handle transient Discord API issues gracefully
  lifecycle {
    # Prevent destruction during API timeout issues
    prevent_destroy = false
    # Ignore changes that might occur due to Discord API inconsistencies
    ignore_changes = []
  }
  
  # Add a small delay between permission operations to avoid rate limits
  provisioner "local-exec" {
    command = "sleep 1"
  }
}

# Lookup locals for easy reference
locals {
  # Channel ID lookups
  channels = merge(
    { for k, v in discord_text_channel.channels : k => v.id },
    { for k, v in discord_text_channel.channels_unpositioned : k => v.id },
    { for k, v in discord_text_channel.regional : "regional_${k}" => v.id },
    { for k, v in discord_text_channel.local : "local_${k}" => v.id }
  )
  
  # Category ID lookups  
  categories = {
    for k, v in discord_category_channel.categories : k => v.id
  }
  
  # Message ID lookups - now dynamic based on discovered files
  messages = {
    for k, v in discord_message.channel_messages : k => v.id
  }
}