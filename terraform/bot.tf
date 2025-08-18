# Security groups are now defined in networking.tf

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
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
  # S3 permissions for config storage and bot code
  statement {
    actions = ["s3:ListBucket"]
    resources = [
      "arn:aws:s3:::yourdiscord-terraform-state"
    ]
  }
  statement {
    actions = ["s3:*"]
    resources = [
      "arn:aws:s3:::yourdiscord-terraform-state/bot/*"
    ]
  }

  # DynamoDB permissions for proposal storage
  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:DescribeTable"
    ]
    resources = [
      aws_dynamodb_table.proposals.arn,
      "${aws_dynamodb_table.proposals.arn}/index/*"
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

resource "aws_iam_role_policy_attachment" "cwagent" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

data "aws_ami" "al2023_arm" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-kernel-6.1-arm64*"]
  }
}

locals {
  base_reaction_rules = [
    {
      from   = local.messages["welcome_start_here_welcome_message"]
      action = "✅"
      to     = "AddRole(user_id,'member')"
      unto   = "RemoveRole(user_id,'member')"
    }
  ]

  region_reaction_rules = [
    for i, r in local.region_objs : {
      from   = local.messages["welcome_start_here_region_picker"]
      action = local.emoji_pool[i]
      to     = format("AddRole(user_id,'%s')", r.name)
      unto   = format("RemoveRole(user_id,'%s')", r.name)
    } if i < length(local.emoji_pool)
  ]

  town_reaction_rules = flatten([
    for r in local.region_objs : [
      for j, t in r.towns : {
        from   = local.messages["welcome_start_here_town_picker_${r.key}"]
        action = local.emoji_pool[j]
        to     = format("AddRole(user_id,'%s')", t)
        unto   = format("RemoveRole(user_id,'%s')", t)
      } if j < length(local.emoji_pool)
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
  # Enhanced user data with health checks and readiness monitoring
  user_data_enhanced = templatefile("${path.module}/user_data_enhanced.sh.tpl", {
    name                      = local.name
    bot_token                 = var.discord_token
    guild_id                  = discord_server.server.id
    moderator_role_id         = discord_role.moderator.id
    member_role_id            = discord_role.member.id
    command_channel_id        = local.channels["governance_bot"]
    member_command_channel_id = local.channels["members_bot"]
    proposalConfig = jsonencode({
      policy = {
        debateChannelId      = local.channels["members_debate"]
        voteChannelId        = local.channels["members_vote"]
        resolutionsChannelId = local.channels["members_resolutions"]
        supportThreshold     = var.env == "main" ? 5 : 1
        voteDuration         = var.env == "main" ? 604800000 : 300000
        formats              = ["Policy"]
      }
      governance = {
        debateChannelId      = local.channels["governance_debate"]
        voteChannelId        = local.channels["governance_vote"]
        resolutionsChannelId = local.channels["governance_discussion"]
        supportThreshold     = var.env == "main" ? 3 : 1
        voteDuration         = var.env == "main" ? 259200000 : 300000
        formats              = ["Governance"]
      }
      moderator = {
        debateChannelId  = local.channels["governance_debate"]
        voteChannelId    = local.channels["governance_vote"]
        supportThreshold = var.env == "main" ? 3 : 1
        voteDuration     = var.env == "main" ? 259200000 : 300000
        formats          = ["Add Moderator", "Remove Moderator"]
      }
    })
    s3_bucket          = aws_s3_object.bot_code.bucket
    s3_key             = aws_s3_object.bot_code.key
    code_hash          = data.archive_file.bot_code.output_md5
    reactionRoleConfig = local.config
    dynamodb_table     = aws_dynamodb_table.proposals.name
    network_type       = var.use_private_subnet ? "private" : "public"
  })

  # Legacy user data for compatibility
  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    name                      = local.name
    bot_token                 = var.discord_token
    guild_id                  = discord_server.server.id
    moderator_role_id         = discord_role.moderator.id
    member_role_id            = discord_role.member.id
    command_channel_id        = local.channels["governance_bot"]
    member_command_channel_id = local.channels["members_bot"]
    proposalConfig = jsonencode({
      policy = {
        debateChannelId      = local.channels["members_debate"]
        voteChannelId        = local.channels["members_vote"]
        resolutionsChannelId = local.channels["members_resolutions"]
        supportThreshold     = var.env == "main" ? 5 : 1
        voteDuration         = var.env == "main" ? 604800000 : 300000
        formats              = ["Policy"]
      }
      governance = {
        debateChannelId      = local.channels["governance_debate"]
        voteChannelId        = local.channels["governance_vote"]
        resolutionsChannelId = local.channels["governance_discussion"]
        supportThreshold     = var.env == "main" ? 3 : 1
        voteDuration         = var.env == "main" ? 259200000 : 300000
        formats              = ["Governance"]
      }
      moderator = {
        debateChannelId  = local.channels["governance_debate"]
        voteChannelId    = local.channels["governance_vote"]
        supportThreshold = var.env == "main" ? 3 : 1
        voteDuration     = var.env == "main" ? 259200000 : 300000
        formats          = ["Add Moderator", "Remove Moderator"]
      }
    })
    s3_bucket          = aws_s3_object.bot_code.bucket
    s3_key             = aws_s3_object.bot_code.key
    code_hash          = data.archive_file.bot_code.output_md5
    reactionRoleConfig = local.config
    dynamodb_table     = aws_dynamodb_table.proposals.name
    network_type       = var.use_private_subnet ? "private" : "public"
  })
}

data "archive_file" "bot_code" {
  type        = "zip"
  output_path = "${path.module}/../bundle-${var.env}.zip"

  source {
    content  = file("${path.module}/../YourBot/bot.js")
    filename = "bot.js"
  }

  source {
    content  = file("${path.module}/../YourBot/package.json")
    filename = "package.json"
  }

  dynamic "source" {
    for_each = fileset("${path.module}/../YourBot/src", "*.js")
    content {
      content  = file("${path.module}/../YourBot/src/${source.value}")
      filename = "src/${source.value}"
    }
  }

  dynamic "source" {
    for_each = fileset("${path.module}/../YourBot/deployment", "*")
    content {
      content  = file("${path.module}/../YourBot/deployment/${source.value}")
      filename = "deployment/${source.value}"
    }
  }
}

resource "aws_s3_object" "bot_code" {
  bucket      = "yourdiscord-terraform-state"
  key         = "bot/bundle-${var.env}.zip"
  source      = data.archive_file.bot_code.output_path
  source_hash = data.archive_file.bot_code.output_md5
}

# =============================================================================
# DISCORD BOT INSTANCE 
# =============================================================================

# Launch template for zero-downtime deployments
resource "aws_launch_template" "bot" {
  name_prefix = "${local.name}-"
  description = "Launch template for Discord bot with health checking"

  image_id      = data.aws_ami.al2023_arm.id
  instance_type = var.env == "main" ? "t4g.micro" : "t4g.nano"
  key_name      = "yourdiscord"

  vpc_security_group_ids = [aws_security_group.bot_enhanced.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2.name
  }

  user_data = base64encode(local.user_data_enhanced)

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 30
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = local.name
      Network     = var.use_private_subnet ? "Private" : "Public"
      HealthCheck = "Enabled"
      Environment = var.env
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Application Load Balancer for health checks
resource "aws_lb" "bot_health" {
  name               = "${local.name}-health-lb"
  internal           = true # Internal only, just for health checks
  load_balancer_type = "application"
  security_groups    = [aws_security_group.bot.id]
  subnets            = [local.selected_subnet_id, local.backup_subnet_id]

  enable_deletion_protection = false

  tags = {
    Name        = "${local.name}-health-lb"
    Environment = var.env
  }
}

# Target group for health checks
resource "aws_lb_target_group" "bot_health" {
  name     = "${local.name}-health-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = local.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2  # Consider healthy after 2 successful checks
    unhealthy_threshold = 3  # Consider unhealthy after 3 failed checks
    timeout             = 10 # 10 second timeout per check
    interval            = 15 # Check every 15 seconds
    path                = "/health"
    matcher             = "200"
    protocol            = "HTTP"
    port                = "3000"
  }

  # Fast deregistration for quicker deployments
  deregistration_delay = 30 # Reduced from default 300s to 30s

  tags = {
    Name        = "${local.name}-health-tg"
    Environment = var.env
  }
}

# Load balancer listener
resource "aws_lb_listener" "bot_health" {
  load_balancer_arn = aws_lb.bot_health.arn
  port              = "3000"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.bot_health.arn
  }
}

# Auto Scaling Group for zero-downtime deployments
resource "aws_autoscaling_group" "bot" {
  name                      = "${local.name}-asg"
  vpc_zone_identifier       = [local.selected_subnet_id]
  health_check_type         = "ELB" # Use ELB health checks for proper bot readiness detection
  health_check_grace_period = 120   # 2 minutes for bot to start and report ready (reduced from 5 minutes)
  target_group_arns         = [aws_lb_target_group.bot_health.arn]

  min_size         = 1
  max_size         = 2
  desired_capacity = 1

  # Zero-downtime deployment settings
  wait_for_capacity_timeout = "10m"

  launch_template {
    id      = aws_launch_template.bot.id
    version = "$Latest"
  }

  # Instance refresh for deployments
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup        = 120 # 2 minutes for bot to start and report ready
      checkpoint_delay       = 60  # 1 minute delay before terminating old instance (reduced from 5 minutes)
    }
    triggers = ["tag"]
  }

  tag {
    key                 = "Name"
    value               = "${local.name}-asg"
    propagate_at_launch = false
  }

  tag {
    key                 = "Environment"
    value               = var.env
    propagate_at_launch = true
  }

  tag {
    key                 = "HealthCheck"
    value               = "Enabled"
    propagate_at_launch = true
  }

  tag {
    key                 = "LaunchTemplateVersion"
    value               = aws_launch_template.bot.latest_version
    propagate_at_launch = false
  }

  depends_on = [
    aws_s3_object.bot_code
  ]
}

resource "aws_cloudwatch_log_group" "bot" {
  name              = "/ec2/${local.name}-logs"
  retention_in_days = 7
}

# Output for monitoring deployment status
output "asg_name" {
  description = "Name of the Auto Scaling Group for deployment monitoring"
  value       = aws_autoscaling_group.bot.name
}

output "launch_template_version" {
  description = "Launch template version for deployment tracking"
  value       = aws_launch_template.bot.latest_version
}

output "health_check_url" {
  description = "Health check endpoint URL (internal access only)"
  value       = "http://<instance-ip>:3000/health"
}