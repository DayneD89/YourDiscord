# =============================================================================
# TERRAFORM HELPER CONFIGURATION
# =============================================================================
# This file contains helper resources for Discord API reliability and monitoring
# =============================================================================

# -----------------------------------------------------------------------------
# DISCORD API RELIABILITY HELPERS
# -----------------------------------------------------------------------------

# Simple Discord API connectivity check
resource "null_resource" "discord_api_check" {
  # Run this check before major Discord operations
  provisioner "local-exec" {
    command = <<-EOT
      echo "🔍 Checking Discord API connectivity..."
      
      # Simple connectivity test
      if ! curl -s -f -m 10 https://discord.com/api/v9/gateway >/dev/null; then
        echo "⚠️ Discord API appears to be unreachable or slow"
        echo "💡 This may cause Terraform operations to timeout"
        echo "🔗 Check Discord status: https://discordstatus.com/"
        exit 1
      fi
      
      echo "✅ Discord API is reachable"
    EOT
  }
  
  # Re-run this check when needed
  triggers = {
    always_run = timestamp()
  }
}

# -----------------------------------------------------------------------------
# DEPLOYMENT MONITORING
# -----------------------------------------------------------------------------

# Output deployment information for monitoring
output "deployment_info" {
  description = "Deployment configuration and status information"
  value = {
    environment = var.env
    network_type = var.use_private_subnet ? "private" : "public"
    bot_instance_id = aws_instance.bot.id
    
    troubleshooting_tips = [
      "Use Discord API wrapper scripts: ./scripts/terraform-wrapper.sh",
      "For persistent issues: ./scripts/terraform-apply-retry.sh", 
      "Check Discord status: https://discordstatus.com/",
      "View health checks: curl http://INSTANCE_IP:3000/health"
    ]
  }
}