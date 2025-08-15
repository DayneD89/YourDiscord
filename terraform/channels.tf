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
resource "discord_text_channel" "rules_and_guide" {
  server_id = discord_server.server.id
  name      = "rules-and-guide"
  category  = discord_category_channel.entry_info.id
  topic     = "Server constitution and how to get started."
  position  = 1
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
  sync_perms_with_category = false
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