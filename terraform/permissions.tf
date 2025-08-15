data "discord_permission" "hide_view" {
  view_channel = "deny"
}

data "discord_permission" "read_only" {
  view_channel          = "allow"
  read_message_history  = "allow"
  add_reactions         = "allow"
  send_messages         = "deny"
}

data "discord_permission" "read_post" {
  view_channel          = "allow"
  read_message_history  = "allow"
  send_messages         = "allow"
}

data "discord_permission" "react_only" {
  view_channel          = "allow"
  read_message_history  = "allow"
  add_reactions         = "allow"
  send_messages         = "deny"
}