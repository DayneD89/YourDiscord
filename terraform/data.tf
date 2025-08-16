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

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

locals {
  vpc_id    = data.aws_vpc.default.id
  subnet_id = data.aws_subnets.default.ids[0]
  name      = "yourdiscord-${var.env}"
}