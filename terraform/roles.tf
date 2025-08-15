resource "discord_role" "moderator" {
  server_id   = discord_server.server.id
  name        = "Moderator"
  color       = "16711680"
  mentionable = true
  
  permissions = "8"
}

resource "discord_role" "member" {
  server_id = discord_server.server.id
  name      = "Member"
  color     = "16719390"
}

resource "discord_role" "region" {
  for_each = { for r in local.region_objs : r.key => r }

  server_id = discord_server.server.id
  name      = each.value.name
}
resource "discord_role" "town" {
  for_each = {
    for o in local.town_objs : "${o.region_key}__${o.town_key}" => o
  }

  server_id = discord_server.server.id
  name      = each.value.town_name
}
