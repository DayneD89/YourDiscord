# Categories
resource "discord_category_channel" "entry_info" {
  server_id = discord_server.server.id
  name      = "Entry & Info"
  position  = 0
}
resource "discord_channel_permission" "entry_info_everyone" {
  channel_id   = discord_category_channel.entry_info.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.react_only.allow_bits
  deny         = data.discord_permission.react_only.deny_bits
}

resource "discord_category_channel" "members" {
  server_id = discord_server.server.id
  name      = "Members"
  position  = 1
}
resource "discord_channel_permission" "members_everyone" {
  channel_id   = discord_category_channel.members.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.hide_view.allow_bits
  deny         = data.discord_permission.hide_view.deny_bits
}
resource "discord_channel_permission" "members_members" {
  channel_id   = discord_category_channel.members.id
  type         = "role"
  overwrite_id = discord_role.member.id
  allow        = data.discord_permission.read_post.allow_bits
  deny         = data.discord_permission.read_post.deny_bits
}

resource "discord_category_channel" "governance" {
  server_id = discord_server.server.id
  name      = "Governance"
  position  = 2
}
resource "discord_channel_permission" "governance_everyone" {
  channel_id   = discord_category_channel.governance.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.hide_view.allow_bits
  deny         = data.discord_permission.hide_view.deny_bits
}
resource "discord_channel_permission" "governance_members" {
  channel_id   = discord_category_channel.governance.id
  type         = "role"
  overwrite_id = discord_role.member.id
  allow        = data.discord_permission.read_only.allow_bits
  deny         = data.discord_permission.read_only.deny_bits
}

resource "discord_category_channel" "regional" {
  server_id = discord_server.server.id
  name      = "Regional & Local"
  position  = 3
}
resource "discord_channel_permission" "regional_everyone" {
  channel_id   = discord_category_channel.regional.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.hide_view.allow_bits
  deny         = data.discord_permission.hide_view.deny_bits
}

# --- Entry & Info ---
resource "discord_text_channel" "welcome_start_here" {
  server_id = discord_server.server.id
  name      = "welcome-start-here"
  category  = discord_category_channel.entry_info.id
  topic     = "Pick Member / Non-Member and your region."
  position  = 0
}
resource "discord_message" "welcome" {
  channel_id = discord_text_channel.welcome_start_here.id
  content    = "By clicking ✅ you confirm you've read <#${discord_text_channel.rules_and_guide.id}> and agree to the rules, and that you are a supporter. React ✅ to get access."
}
resource "discord_message" "region_picker" {
  channel_id = discord_text_channel.welcome_start_here.id
  content    = local.region_picker_content
}

resource "discord_message" "town_picker" {
  for_each   = local.per_region_town_content
  channel_id = discord_text_channel.welcome_start_here.id
  content    = each.value
}
resource "discord_text_channel" "rules_and_guide" {
  server_id = discord_server.server.id
  name      = "rules-and-guide"
  category  = discord_category_channel.entry_info.id
  topic     = "Server constitution and how to get started."
  position  = 1
}
resource "discord_message" "server_rules" {
  channel_id = discord_text_channel.rules_and_guide.id
  content = <<-EOT
    # 📋 Server Rules

    Welcome to our community! Please read and follow these rules to ensure a positive experience for everyone.

    ## 🏠 **Chat Spaces - Safe Space Policy**
    
    In general chat channels, we maintain a **safe space environment**:
    
    • **Be kind and respectful** to all members
    • **Support each other** - we're here to build community
    • **No hostile arguments or confrontational discussions**
    • **Keep conversations welcoming** to new members
    • **Respect different perspectives** without debate
    
    *Chat spaces are for connection, not confrontation.*

    ## 💭 **Debate Channels - Open Discussion Policy**
    
    In designated debate channels, open discussion is encouraged:
    
    • **All topics welcome** for thoughtful discussion
    • **Attack ideas, not people** - focus on arguments, not individuals
    • **No personal attacks, insults, or character assassination**
    • **Disagree respectfully** - explain why ideas are wrong, don't attack who said them
    • **Stay on topic** and engage in good faith
    
    *Debate the argument, respect the person.*

    ## ⚖️ **Universal Standards**
    
    These apply everywhere in the server:
    
    • **No harassment, discrimination, or hate speech**
    • **No spam, excessive self-promotion, or off-topic content**
    • **Use appropriate channels** for different types of discussion
    • **Follow Discord Terms of Service**
    • **Respect moderator decisions**

    ---
    
    **Questions about the rules?** Ask a moderator.
    **See rule violations?** Report them to the moderation team.
    
    *Thank you for helping create a welcoming community!*
  EOT
}

# Quick Reference Rules
resource "discord_message" "rules_summary" {
  channel_id = discord_text_channel.rules_and_guide.id
  content = <<-EOT
    ## 🎯 **Quick Reference**
    
    **Chat Spaces:** Be kind, be supportive, safe space for all
    **Debate Channels:** Challenge ideas respectfully, no personal attacks
    **Everywhere:** No harassment, use right channels, follow Discord ToS
    
    *Different spaces, different purposes - know where you are!*
  EOT
}

# Channel Guidelines Message
resource "discord_message" "channel_guide" {
  channel_id = discord_text_channel.rules_and_guide.id
  content = <<-EOT
    ## 📺 **Channel Guide**
    
    **🏠 Entry & Info:**
    • #welcome-start-here - New member welcome and introduction
    • #rules-and-guide - Server rules and guidelines (this channel)
    
    **👥 Members (Safe Space Policy):**
    • #members-chat - General community chat and conversation
    • #members-resolutions - Passed resolutions and policies
    • #members-debate - Policy proposals and open discussion
    • #members-vote - Active votes on proposals
    
    **⚖️ Governance (Open Discussion Policy):**
    • #governance-links - Important governance resources
    • #governance-debate - Server change proposals and political discussions
    • #governance-vote - Active votes on server changes
    • #governance-discussion - General governance topics
    • #governance-bot - Bot commands and management
    
    **📍 Regional & Local (Safe Space Policy):**
    • Multiple regional and local channels available
    • Select as many regions and towns as you want to view
    • Location-based community discussions and local topics
    
    ## 📝 **Proposal Process**
    
    **For Member Policies & Server Changes:**
    1. **Propose** - Submit policy using designated format in debate channel
    2. **Support** - Proposal needs 5 support reactions to advance
    3. **Vote** - Moved to vote channel for 7 days
    4. **Pass** - More support than oppose reactions = passed
    5. **Archive** - Passed proposals moved to resolutions channel
    
    *Proposals can also be made to remove existing resolutions*
    
    *Remember: Safe space channels prioritize kindness and support, while open discussion channels allow respectful debate of ideas.*
  EOT
}

# --- Members ---
resource "discord_text_channel" "members_chat" {
  server_id = discord_server.server.id
  name      = "members-chat"
  category  = discord_category_channel.members.id
  topic     = "Members only chat"
  position  = 5
}
resource "discord_text_channel" "members_resolutions" {
  server_id = discord_server.server.id
  name      = "members-resolutions"
  category  = discord_category_channel.members.id
  topic     = "Resoutions passed by members"
  position  = 6
  sync_perms_with_category = false
}
resource "discord_channel_permission" "members_resolutions_everyone" {
  channel_id   = discord_text_channel.members_resolutions.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.hide_view.allow_bits
  deny         = data.discord_permission.hide_view.deny_bits
}
resource "discord_channel_permission" "members_resolutions" {
  channel_id   = discord_text_channel.members_resolutions.id
  type         = "role"
  overwrite_id = discord_role.member.id
  allow        = data.discord_permission.read_only.allow_bits
  deny         = data.discord_permission.read_only.deny_bits
}
resource "discord_text_channel" "members_debate" {
  server_id = discord_server.server.id
  name      = "members-debate"
  category  = discord_category_channel.members.id
  topic     = "Propose and debate resolutions"
  position  = 7
}
resource "discord_text_channel" "members_vote" {
  server_id = discord_server.server.id
  name      = "members-vote"
  category  = discord_category_channel.members.id
  topic     = "Vote on resolutions"
  position  = 8
  sync_perms_with_category = false
}
resource "discord_channel_permission" "members_vote-everyone" {
  channel_id   = discord_text_channel.members_vote.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.hide_view.allow_bits
  deny         = data.discord_permission.hide_view.deny_bits
}
resource "discord_channel_permission" "members_vote" {
  channel_id   = discord_text_channel.members_vote.id
  type         = "role"
  overwrite_id = discord_role.member.id
  allow        = data.discord_permission.react_only.allow_bits
  deny         = data.discord_permission.react_only.deny_bits
}

# --- Governance ---
resource "discord_text_channel" "governance_links" {
  server_id = discord_server.server.id
  name      = "governance-links"
  category  = discord_category_channel.governance.id
  topic     = "Links to governance resources"
  position  = 9
}
resource "discord_text_channel" "governance_debate" {
  server_id = discord_server.server.id
  name      = "governance-debate"
  category  = discord_category_channel.governance.id
  topic     = "Propose and debate governance resolutions"
  position  = 10
  sync_perms_with_category = false
}
resource "discord_channel_permission" "governance_debate_everyone" {
  channel_id   = discord_text_channel.governance_debate.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.hide_view.allow_bits
  deny         = data.discord_permission.hide_view.deny_bits
}
resource "discord_channel_permission" "governance_debate" {
  channel_id   = discord_text_channel.governance_debate.id
  type         = "role"
  overwrite_id = discord_role.member.id
  allow        = data.discord_permission.read_post.allow_bits
  deny         = data.discord_permission.read_post.deny_bits
}
resource "discord_text_channel" "governance_vote" {
  server_id = discord_server.server.id
  name      = "governance-vote"
  category  = discord_category_channel.governance.id
  topic     = "Vote on governance resolutions"
  position  = 11
}
resource "discord_channel_permission" "governance_vote_everyone" {
  channel_id   = discord_text_channel.governance_vote.id
  type         = "role"
  overwrite_id = discord_server.server.id
  allow        = data.discord_permission.hide_view.allow_bits
  deny         = data.discord_permission.hide_view.deny_bits
}
resource "discord_channel_permission" "governance_vote" {
  channel_id   = discord_text_channel.governance_vote.id
  type         = "role"
  overwrite_id = discord_role.member.id
  allow        = data.discord_permission.react_only.allow_bits
  deny         = data.discord_permission.react_only.deny_bits
}
resource "discord_text_channel" "governance_discussion" {
  server_id = discord_server.server.id
  name      = "governance-discussion"
  category  = discord_category_channel.governance.id
  topic     = "Moderator discussions"
  position  = 12
}
resource "discord_text_channel" "governance_bot" {
  server_id = discord_server.server.id
  name      = "governance-bot"
  category  = discord_category_channel.governance.id
  topic     = "Bot Commands"
  position  = 13
  lifecycle { ignore_changes = [position] }
}

# --- Regional & Local ---
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
}