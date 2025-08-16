data discord_local_image logo {
    file = "images/server_icon.jpg"
}

resource discord_server server {
    name = var.env == "main" ? "Your Party Supporters" : "YPS - ${var.env}"
    default_message_notifications = 0
    icon_data_uri = data.discord_local_image.logo.data_uri
}

resource discord_invite this {
  channel_id = discord_text_channel.welcome_start_here.id
  max_age    = 0
}

output invite {
  value = "https://discord.gg/${discord_invite.this.code}"
}
output server {
  value = discord_server.server.id
}
output welcome {
  value = discord_message.welcome.id
}
output member {
  value = discord_role.member.id
}
output mod {
  value = discord_role.moderator.id
}
output bot {
  value = discord_text_channel.governance_bot.id
}