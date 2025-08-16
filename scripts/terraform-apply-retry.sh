#!/bin/bash

# =============================================================================
# TERRAFORM APPLY WITH DISCORD API RETRY LOGIC
# =============================================================================
# This script helps handle Discord API timeout issues by automatically
# retrying terraform apply when Discord API rate limits or timeouts occur.
# Common Discord errors this handles:
# - "context deadline exceeded"
# - "rate limited"
# - "connection timeout"
# =============================================================================

set -e

# Configuration
MAX_RETRIES=5
RETRY_DELAY=30
TERRAFORM_DIR="${1:-terraform}"
TERRAFORM_ARGS="${@:2}"

echo "🚀 Starting Terraform apply with Discord API retry logic..."
echo "📁 Working directory: $TERRAFORM_DIR"
echo "🔧 Additional args: $TERRAFORM_ARGS"
echo "🔄 Max retries: $MAX_RETRIES"
echo ""

cd "$TERRAFORM_DIR"

# Function to check if error is Discord API related
is_discord_api_error() {
    local output="$1"
    
    # Check for common Discord API timeout patterns
    if echo "$output" | grep -q "context deadline exceeded"; then
        return 0
    fi
    
    if echo "$output" | grep -q "rate limited"; then
        return 0
    fi
    
    if echo "$output" | grep -q "connection timeout"; then
        return 0
    fi
    
    if echo "$output" | grep -q "Client.Timeout exceeded"; then
        return 0
    fi
    
    if echo "$output" | grep -q "Failed to find channel"; then
        return 0
    fi
    
    return 1
}

# Main retry loop
attempt=1
while [ $attempt -le $MAX_RETRIES ]; do
    echo "🔄 Attempt $attempt of $MAX_RETRIES"
    echo "⏰ $(date '+%Y-%m-%d %H:%M:%S')"
    
    # Capture both stdout and stderr
    if output=$(terraform apply $TERRAFORM_ARGS 2>&1); then
        echo "✅ Terraform apply completed successfully!"
        echo "$output"
        exit 0
    else
        exit_code=$?
        echo "❌ Terraform apply failed with exit code: $exit_code"
        
        # Check if it's a Discord API error we can retry
        if is_discord_api_error "$output"; then
            echo "🔍 Discord API error detected. This is likely a timeout or rate limit issue."
            
            if [ $attempt -lt $MAX_RETRIES ]; then
                echo "⏳ Waiting $RETRY_DELAY seconds before retry..."
                echo "💡 Discord API errors are common and usually resolve with retries"
                sleep $RETRY_DELAY
                
                # Exponential backoff for subsequent retries
                RETRY_DELAY=$((RETRY_DELAY + 15))
                
                attempt=$((attempt + 1))
                echo ""
                continue
            else
                echo "🚫 Maximum retries reached. Discord API is consistently timing out."
                echo "💡 Try again later or check Discord API status: https://discordstatus.com/"
            fi
        else
            echo "🔍 Non-Discord error detected. Not retrying."
            echo "📝 Error output:"
        fi
        
        # Show the error output
        echo "$output"
        exit $exit_code
    fi
done

echo "🚫 All retry attempts exhausted."
exit 1