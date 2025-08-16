resource "aws_security_group" "bot" {
  name        = "${local.name}-sg"
  description = "Egress-only for Discord bot"
  vpc_id      = local.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals { 
      type = "Service" 
      identifiers = ["ec2.amazonaws.com"] 
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "${local.name}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name}-instance-profile"
  role = aws_iam_role.ec2.name
}

data "aws_iam_policy_document" "ec2_policy" {
  statement {
    actions   = ["s3:ListBucket"]
    resources = [
      "arn:aws:s3:::yourdiscord-terraform-state"
    ]
  }
  statement {
    actions   = ["s3:*"]
    resources = [
      "arn:aws:s3:::yourdiscord-terraform-state/bot/*"
    ]
  }
}

resource "aws_iam_policy" "ec2_policy" {
  name   = "${local.name}-ec2-policy"
  policy = data.aws_iam_policy_document.ec2_policy.json
}

resource "aws_iam_role_policy_attachment" "ec2_attach" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ec2_policy.arn
}

data "aws_ami" "al2023_arm" {
  most_recent = true
  owners      = ["amazon"]
  filter { 
    name = "name" 
    values = ["al2023-ami-*-kernel-6.1-arm64*"] 
  }
}

locals {
  base_reaction_rules = [
    {
      from   = discord_message.welcome.id
      action = "✅"
      to     = "AddRole(user_id,'member')"
      unto   = "RemoveRole(user_id,'member')"
    }
  ]
  
  region_reaction_rules = [
    for i, r in local.region_objs : {
      from   = discord_message.region_picker.id
      action = local.emoji_pool[i]
      to     = format("AddRole(user_id,'%s')", r.name)
      unto   = format("RemoveRole(user_id,'%s')", r.name)
    }
  ]

  town_reaction_rules = flatten([
    for r in local.region_objs : [
      for j, t in r.towns : {
        from   = discord_message.town_picker[r.key].id
        action = local.emoji_pool[j]
        to     = format("AddRole(user_id,'%s')", t)
        unto   = format("RemoveRole(user_id,'%s')", t)
      }
    ]
  ])

  # 4) Final rules list and JSON
  reaction_rules = concat(
    local.base_reaction_rules,
    local.region_reaction_rules,
    local.town_reaction_rules
  )

  config = jsonencode(local.reaction_rules)
}

locals {
  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    bot_token          = var.discord_token
    guild_id           = discord_server.server.id
    moderator_role_id  = discord_role.moderator.id
    member_role_id     = discord_role.member.id
    command_channel_id = discord_text_channel.governance_bot.id
    s3_bucket          = aws_s3_object.bot_code.bucket
    s3_key             = aws_s3_object.bot_code.key
    code_hash          = data.archive_file.bot_code.output_md5
    config             = local.config
  })
}

data "archive_file" "bot_code" {
  type        = "zip"
  source_dir  = "${path.module}/../YourBot"
  output_path = "${path.module}/../bundle-${var.env}.zip"
  excludes    = ["node_modules", "package-lock.json"]
}

resource "aws_s3_object" "bot_code" {
  bucket = "yourdiscord-terraform-state"
  key    = "bot/bundle-${var.env}.zip"
  source = data.archive_file.bot_code.output_path
  etag   = data.archive_file.bot_code.output_md5
}

resource "aws_instance" "bot" {
  #count = var.env == "main" ? 1 : 0
  ami                    = data.aws_ami.al2023_arm.id
  instance_type          = var.env == "main" ? "t4g.micro" : "t4g.nano"
  subnet_id              = local.subnet_id
  vpc_security_group_ids = [aws_security_group.bot.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name = "yourdiscord"

  user_data              = local.user_data
  user_data_replace_on_change = true

  root_block_device {
    volume_size = "30"
    volume_type = "gp3"
  }

  tags = {
    Name = local.name
  }

  depends_on = [ aws_s3_object.bot_code ]
}