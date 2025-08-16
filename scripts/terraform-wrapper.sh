#!/bin/bash

# =============================================================================
# TERRAFORM WRAPPER FOR DISCORD API RELIABILITY
# =============================================================================
# This script wraps terraform commands with Discord-specific optimizations:
# - Automatic retry on Discord API timeouts
# - Reduced parallelism to prevent rate limiting
# - Pre-flight checks for Discord API availability
# - Intelligent error handling and suggestions
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_PARALLELISM=3
MAX_RETRIES=3
RETRY_DELAY=30

print_banner() {
    echo -e "${BLUE}"
    echo "🤖 Discord Terraform Wrapper"
    echo "Optimized for Discord API reliability"
    echo -e "${NC}"
}

print_usage() {
    echo "Usage: $0 <terraform-command> [args...]"
    echo ""
    echo "Examples:"
    echo "  $0 plan"
    echo "  $0 apply"
    echo "  $0 apply -auto-approve"
    echo "  $0 destroy"
    echo ""
    echo "This wrapper automatically:"
    echo "  ✓ Reduces parallelism to prevent Discord rate limits"
    echo "  ✓ Retries on Discord API timeouts"
    echo "  ✓ Checks Discord API health before operations"
    echo "  ✓ Provides intelligent error suggestions"
}

check_discord_api() {
    echo -e "${BLUE}🔍 Checking Discord API health...${NC}"
    
    if ! curl -s -f -m 10 --connect-timeout 5 https://discord.com/api/v9/gateway >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️ Discord API health check failed${NC}"
        echo "This might cause Terraform operations to timeout"
        echo "Check Discord status: https://discordstatus.com/"
        
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Discord API is healthy${NC}"
    fi
}

is_discord_error() {
    local output="$1"
    
    # Check for Discord API specific errors
    if echo "$output" | grep -qi "context deadline exceeded"; then
        return 0
    fi
    
    if echo "$output" | grep -qi "client\.timeout exceeded"; then
        return 0
    fi
    
    if echo "$output" | grep -qi "failed to find channel"; then
        return 0
    fi
    
    if echo "$output" | grep -qi "discord.*rate.*limit"; then
        return 0
    fi
    
    if echo "$output" | grep -qi "connection timeout"; then
        return 0
    fi
    
    return 1
}

suggest_fixes() {
    local error_output="$1"
    
    echo -e "${YELLOW}💡 Suggestions to fix Discord API issues:${NC}"
    echo ""
    
    if echo "$error_output" | grep -qi "context deadline exceeded"; then
        echo "• This is usually a temporary Discord API timeout"
        echo "• Try running the command again in a few minutes"
        echo "• Consider using: terraform apply -parallelism=1"
    fi
    
    if echo "$error_output" | grep -qi "rate.*limit"; then
        echo "• Discord API rate limit hit"
        echo "• Wait 60 seconds and try again"
        echo "• Use lower parallelism: terraform apply -parallelism=1"
    fi
    
    if echo "$error_output" | grep -qi "failed to find channel"; then
        echo "• Channel may have been deleted outside Terraform"
        echo "• Try: terraform refresh to sync state"
        echo "• Check Discord server manually"
    fi
    
    echo ""
    echo "General tips:"
    echo "• Check Discord status: https://discordstatus.com/"
    echo "• Use retry script: ./scripts/terraform-apply-retry.sh"
    echo "• Break large changes into smaller batches"
}

run_terraform_with_retries() {
    local command="$1"
    shift
    local args="$@"
    
    # Optimize arguments for Discord API
    local optimized_args=""
    local has_parallelism=false
    
    # Check if parallelism is already specified
    for arg in $args; do
        if [[ "$arg" == *"parallelism"* ]]; then
            has_parallelism=true
        fi
        optimized_args="$optimized_args $arg"
    done
    
    # Add parallelism limit if not specified and command can use it
    if [[ ! $has_parallelism ]] && [[ "$command" =~ ^(apply|plan|destroy)$ ]]; then
        optimized_args="$optimized_args -parallelism=$DEFAULT_PARALLELISM"
        echo -e "${BLUE}ℹ️ Using parallelism=$DEFAULT_PARALLELISM to prevent Discord rate limits${NC}"
    fi
    
    local attempt=1
    while [ $attempt -le $MAX_RETRIES ]; do
        echo -e "${BLUE}🔄 Attempt $attempt of $MAX_RETRIES${NC}"
        echo "Running: terraform $command $optimized_args"
        echo ""
        
        # Capture both stdout and stderr
        if output=$(terraform $command $optimized_args 2>&1); then
            echo -e "${GREEN}✅ Terraform command completed successfully!${NC}"
            echo "$output"
            return 0
        else
            local exit_code=$?
            echo -e "${RED}❌ Terraform command failed (exit code: $exit_code)${NC}"
            
            # Check if it's a Discord-specific error we can retry
            if is_discord_error "$output"; then
                echo -e "${YELLOW}🔍 Discord API error detected${NC}"
                
                if [ $attempt -lt $MAX_RETRIES ]; then
                    echo -e "${YELLOW}⏳ Waiting $RETRY_DELAY seconds before retry...${NC}"
                    sleep $RETRY_DELAY
                    
                    # Increase delay for next attempt (exponential backoff)
                    RETRY_DELAY=$((RETRY_DELAY + 15))
                    attempt=$((attempt + 1))
                    continue
                else
                    echo -e "${RED}🚫 Maximum retries reached${NC}"
                    suggest_fixes "$output"
                fi
            else
                echo -e "${RED}🔍 Non-Discord error detected. Not retrying.${NC}"
            fi
            
            echo -e "${RED}Error output:${NC}"
            echo "$output"
            return $exit_code
        fi
    done
    
    return 1
}

main() {
    if [ $# -eq 0 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        print_usage
        exit 0
    fi
    
    print_banner
    
    # Change to terraform directory
    if [ ! -d "$TERRAFORM_DIR" ]; then
        echo -e "${RED}❌ Terraform directory not found: $TERRAFORM_DIR${NC}"
        exit 1
    fi
    
    cd "$TERRAFORM_DIR"
    
    # Check Discord API health for operations that interact with Discord
    local command="$1"
    if [[ "$command" =~ ^(plan|apply|destroy|refresh)$ ]]; then
        check_discord_api
        echo ""
    fi
    
    # Run terraform with retries
    run_terraform_with_retries "$@"
}

main "$@"