# Discord Reaction Role Bot

A modular Discord bot that manages role assignments based on message reactions. The bot automatically assigns or removes roles when users add or remove reactions from configured messages.

## Project Structure

### Core Bot Files

- **`bot.js`** - Main entry point that initializes and starts the bot
- **`package.json`** - Node.js dependencies and project configuration
- **`runtime.config.json`** - Runtime configuration (created by deployment, contains Discord IDs and bot token)

### Source Code (`src/`)

- **`DiscordReactionBot.js`** - Main bot class that coordinates all other components
- **`ConfigManager.js`** - Handles loading/saving reaction configurations to/from S3
- **`EventHandlers.js`** - Processes Discord events (reactions, messages)
- **`ActionExecutor.js`** - Executes actions like adding/removing roles
- **`CommandHandler.js`** - Handles bot commands (`!help`, `!addconfig`, etc.)
- **`UserValidator.js`** - Validates user permissions and eligibility for actions

### Infrastructure (`terraform/`)

- **`main.tf`** - Primary Terraform configuration
- **`variables.tf`** - Input variables for deployment
- **`locals.tf`** - Local values and computed configurations
- **`data.tf`** - Data sources (AMIs, etc.)
- **`provider.tf`** - Terraform provider configuration
- **`roles.tf`** - IAM roles and policies for EC2 instance
- **`channels.tf`** - Discord channel configurations
- **`user_data.sh.tpl`** - EC2 instance initialization script
- **`bot.tf`** - EC2 instance and S3 deployment configuration

## How It Works

1. **Configuration Storage**: Reaction configurations are stored in S3 and loaded on startup
2. **Reaction Monitoring**: Bot watches for reactions on configured messages
3. **Role Management**: When reactions are added/removed, bot assigns/removes corresponding roles
4. **Command Interface**: Moderators can manage configurations via bot commands in a designated channel

## Key Features

- **Persistent Configuration**: All settings stored in S3, survives restarts and deployments
- **Modular Architecture**: Easy to extend with new actions and features
- **Role-Based Access**: Only moderators can manage bot configurations
- **Message Pre-caching**: Ensures reactions work immediately on startup
- **Automatic Deployment**: Terraform handles infrastructure and code deployment

## Configuration Format

Each reaction configuration specifies:
- `from`: Message ID to monitor
- `action`: Emoji to react with
- `to`: Action when reaction is added (optional)
- `unto`: Action when reaction is removed (optional)

Example:
```json
{
  "from": "1234567890",
  "action": "✅",
  "to": "AddRole(user_id,'member')",
  "unto": "RemoveRole(user_id,'member')"
}
```

## Bot Commands

Available to users with moderator role in the designated command channel:

- `!help` - Show available commands
- `!viewconfig` - View current reaction configurations
- `!addconfig <json>` - Add new reaction configuration
- `!removeconfig <message_id> <action>` - Remove specific configuration

## Deployment

The bot is deployed via Terraform which:
1. Packages the bot code into a zip file
2. Uploads it to S3
3. Launches an EC2 instance with the bot code
4. Configures systemd service for automatic startup

When code changes, Terraform automatically replaces the EC2 instance with the updated version.

## Future Extensions

The modular architecture supports adding:
- Time-based actions (wait X days then do something)
- Additional action types beyond role management
- More sophisticated user validation rules
- Scheduled tasks and cleanup operations