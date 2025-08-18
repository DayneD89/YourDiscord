# DynamoDB table for storing proposal and voting data
# Uses on-demand billing for cost-effectiveness with variable workloads
# Stores dynamic data while keeping static config in S3

resource "aws_dynamodb_table" "proposals" {
  name         = "discord-proposals-${var.env}"
  billing_mode = "PAY_PER_REQUEST" # Serverless pricing - pay only for actual usage
  hash_key     = "guild_id"        # Partition key - separates data by Discord server
  range_key    = "message_id"      # Sort key - allows multiple proposals per guild

  # Define the table schema
  attribute {
    name = "guild_id"
    type = "S" # String - Discord guild (server) ID
  }

  attribute {
    name = "message_id"
    type = "S" # String - Discord message ID (unique per proposal)
  }

  attribute {
    name = "status"
    type = "S" # String - proposal status: voting, passed, failed
  }

  attribute {
    name = "proposal_type"
    type = "S" # String - type of proposal: policy, governance, etc.
  }

  attribute {
    name = "end_time"
    type = "S" # String - ISO timestamp when voting ends
  }

  # Global Secondary Index for querying by status
  # Enables efficient queries like "get all active votes"
  global_secondary_index {
    name            = "status-index"
    hash_key        = "guild_id"
    range_key       = "status"
    projection_type = "ALL" # Include all attributes in index
  }

  # Global Secondary Index for querying by proposal type
  # Enables queries like "get all policy proposals"
  global_secondary_index {
    name            = "type-index"
    hash_key        = "guild_id"
    range_key       = "proposal_type"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying by end time
  # Enables efficient monitoring of expiring votes
  global_secondary_index {
    name            = "end-time-index"
    hash_key        = "guild_id"
    range_key       = "end_time"
    projection_type = "ALL"
  }

  # Time To Live configuration
  # Automatically removes old completed proposals after 90 days
  # Keeps storage costs minimal and data fresh
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery for data protection
  # Allows recovery from accidental deletions or corruption
  point_in_time_recovery {
    enabled = true
  }

  # Encryption at rest for security
  # Protects sensitive voting data
  server_side_encryption {
    enabled = true
  }

  # Environment-specific tagging for cost tracking and organization
  tags = {
    Name        = "Discord Proposals - ${title(var.env)}"
    Environment = var.env
    Service     = "discord-bot"
    Purpose     = "proposal-voting-storage"
    ManagedBy   = "terraform"
    CostCenter  = "discord-infrastructure"
  }

  # Prevent accidental deletion of production data
  lifecycle {
    prevent_destroy = true
  }
}

# Output the table name for use in application configuration
output "dynamodb_proposals_table_name" {
  description = "Name of the DynamoDB table for proposal storage"
  value       = aws_dynamodb_table.proposals.name
}

# Output the table ARN for IAM policy creation
output "dynamodb_proposals_table_arn" {
  description = "ARN of the DynamoDB table for proposal storage"
  value       = aws_dynamodb_table.proposals.arn
}

# Output index ARNs for comprehensive IAM permissions
output "dynamodb_proposals_table_indexes" {
  description = "ARNs of DynamoDB table indexes"
  value = [
    "${aws_dynamodb_table.proposals.arn}/index/status-index",
    "${aws_dynamodb_table.proposals.arn}/index/type-index",
    "${aws_dynamodb_table.proposals.arn}/index/end-time-index"
  ]
}

# DynamoDB table for storing community events
# Stores event information with regional/local targeting and reminder scheduling
resource "aws_dynamodb_table" "events" {
  name         = "discord-events-${var.env}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "guild_id"
  range_key    = "event_id"

  # Define the table schema
  attribute {
    name = "guild_id"
    type = "S" # String - Discord guild (server) ID
  }

  attribute {
    name = "event_id"
    type = "S" # String - Unique event ID (UUID)
  }

  attribute {
    name = "region"
    type = "S" # String - Region for the event
  }

  attribute {
    name = "event_date"
    type = "S" # String - ISO timestamp of the event
  }

  attribute {
    name = "reminder_status"
    type = "S" # String - tracks which reminders have been sent
  }

  # Global Secondary Index for querying by region
  global_secondary_index {
    name            = "region-index"
    hash_key        = "guild_id"
    range_key       = "region"
    projection_type = "ALL"
  }

  # Global Secondary Index for querying by event date (for reminders)
  global_secondary_index {
    name            = "date-index"
    hash_key        = "guild_id"
    range_key       = "event_date"
    projection_type = "ALL"
  }

  # Global Secondary Index for reminder processing
  global_secondary_index {
    name            = "reminder-index"
    hash_key        = "guild_id"
    range_key       = "reminder_status"
    projection_type = "ALL"
  }

  # Time To Live - remove events 30 days after they occur
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = true
  }

  # Encryption at rest for security
  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Discord Events - ${title(var.env)}"
    Environment = var.env
    Service     = "discord-bot"
    Purpose     = "event-storage"
    ManagedBy   = "terraform"
  }

  lifecycle {
    prevent_destroy = true
  }
}