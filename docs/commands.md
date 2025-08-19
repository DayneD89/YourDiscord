# Bot Commands Reference

Complete reference guide for all YourPartyServer Discord bot commands.

## 📋 Overview

The bot supports different commands based on your role and the channel you're in:

- **Member Commands**: Available in the member bot channel for users with member role
- **Moderator Commands**: Available in the moderator bot channel for users with moderator role or "Manage Roles" permission
- **Regional/Local Commands**: Available in regional and local channels for specific features

## 👥 Member Commands

### 📊 Proposal Information
- **`!proposals`** - View pending proposals needing support
  - Shows up to 5 proposals (3 closest to passing + 2 most recent)
  - Displays progress bars and support thresholds
  - Includes clickable links to original proposals

- **`!activevotes`** - View currently active votes
  - Shows all ongoing voting processes
  - Displays current vote counts (Yes vs No)
  - Shows time remaining for each vote
  - Includes links to voting messages

- **`!voteinfo <vote_message_id>`** - Get detailed info about a specific vote
  - Shows complete voting status and history
  - Displays final results for completed votes
  - Provides timeline of proposal progression

### 📅 Event Information
- **`!events`** - View upcoming events *(only works in regional/local channels)*
  - Shows next 3 upcoming events for that area
  - Includes events that started within the last hour
  - Displays event dates, locations, links, and organizers
  - Automatically filters by channel location (regional vs local)

### 🏛️ Community Information
- **`!moderators`** - View current server moderators
  - Lists all users with moderator role
  - Shows online status and join dates
  - Includes instructions for becoming a moderator

- **`!help`** - Show help message with available commands
  - Context-aware help based on your permissions
  - Includes information about the proposal system
  - Shows current channel configurations

### 📍 Usage Examples

#### Member Bot Channel (`#members-bot`)
```
!proposals           # View proposals needing support
!activevotes         # See what's currently being voted on
!voteinfo 123456789  # Get details on a specific vote
!moderators          # See who the current moderators are
!help                # Show member help
```

#### Regional Channel (`#regional-north-east`)
```
!events              # Show next 3 events in North East region
```

#### Local Channel (`#local-newcastle`)
```
!events              # Show next 3 events specifically in Newcastle
```

## 🛡️ Moderator Commands

### 📊 Proposal Management
- **`!proposals`** - View pending proposals (same as member command)
- **`!activevotes`** - View currently active votes (same as member command)
- **`!voteinfo <vote_message_id>`** - Get detailed vote information (same as member command)
- **`!forcevote <vote_message_id>`** - Force end an active vote (emergency use)
  - Immediately ends the voting period
  - Processes results and moves to resolution phase
  - Should only be used in exceptional circumstances

### 🎉 Event Management
- **`!addevent @RegionRole @LocationRole "Event Name" | YYYY-MM-DD HH:MM | <link>`** - Create new events
  - Requires valid Discord role mentions for region and location
  - Date must be in the future using YYYY-MM-DD HH:MM format
  - Link is optional but recommended
  - Automatically sends notifications to appropriate channels
  - Sets up automated reminder system

#### Event Creation Examples
```bash
# Regional event
!addevent @"North East" @Newcastle "Community Meeting" | 2025-08-25 18:00 | https://facebook.com/events/123

# Regional-wide event (no specific location)
!addevent @Yorkshire "Regional Rally" | 2025-08-30 14:00 | https://eventbrite.com/tickets/456

# Event with complex location name
!addevent @"North East" @"Blyth/Ashington/Morpeth" "Local Meetup" | 2025-08-28 19:30 | https://meetup.com/event/789
```

#### Event Validation
The bot validates:
- **Role Mentions**: Must be valid Discord roles that exist in the server
- **Date Format**: Must be YYYY-MM-DD HH:MM (24-hour format)
- **Future Dates**: Event date must be in the future
- **Valid Links**: URLs must start with http:// or https://
- **Role Types**: Helps prevent using location roles for regions and vice versa

### 🏛️ Community Information
- **`!moderators`** - View current server moderators (same as member command)
- **`!help`** - Show moderator help with additional commands

### 📍 Usage Examples

#### Moderator Bot Channel (`#governance-bot`)
```
!addevent @London @"Central London" "Policy Meeting" | 2025-08-25 19:00 | https://example.com/event
!forcevote 987654321    # Emergency: force end a problematic vote
!proposals              # Check proposal status
!help                   # Show moderator help
```

## 🎯 Proposal System Commands

### Creating Proposals
Proposals are created by posting specially formatted messages in debate channels:

#### Policy Proposals (`#members-debate`)
```
**Policy**: Implement 4-day working week

This proposal suggests implementing a nationwide 4-day working week policy.

Key points:
- Maintain full-time pay for reduced hours
- Improve work-life balance
- Boost productivity and job satisfaction
```

#### Governance Proposals (`#governance-debate`)
```
**Governance**: Update voting duration to 5 days

Current voting periods are too short. This proposal extends voting from 3 days to 5 days.

Benefits:
- More time for community consideration
- Higher participation rates
- Better democratic outcomes
```

#### Moderator Management (`#governance-debate`)
```
**Add Moderator**: @username

Nominating @username for moderator role based on their excellent community contributions and fair judgment.
```

```
**Remove Moderator**: @username

Requesting removal of @username from moderator role due to inactivity over the past 6 months.
```

### Proposal Progression
1. **Debate Phase**: Proposal posted in debate channel
2. **Support Gathering**: Community reacts with ✅ to show support
3. **Threshold Met**: Proposal automatically advances to voting when threshold reached
4. **Voting Phase**: Time-limited voting with ✅ (Yes) and ❌ (No) reactions
5. **Resolution**: Passed proposals become official resolutions

## 📅 Event System

### Event Lifecycle
1. **Creation**: Moderator uses `!addevent` command
2. **Notification**: Automatic announcements in regional/local channels
3. **Reminders**: Automated reminders sent based on environment
   - **Production**: 7 days before + 24 hours before
   - **Development**: 2 minutes after creation + 1 minute after first reminder
4. **Visibility**: Events show in `!events` until 1 hour after start time
5. **Cleanup**: Events automatically removed 30 days after event date

### Event Display
Events in `!events` show:
- **Event Name**: Title of the event
- **Date & Time**: When the event occurs
- **Time Until/Since**: Relative time display
  - `in 3 days` - Future events
  - `started 15m ago` - Recently started events
- **Location**: Region and specific location (if applicable)
- **Link**: Direct link to event page (if provided)
- **Organizer**: Who created the event

### Regional vs Local Events
- **Regional Events**: Show in `#regional-*` channels, visible region-wide
- **Local Events**: Show in `#local-*` channels, specific to that location
- **Channel Detection**: Bot automatically determines scope based on channel name
  - `regional-north-east` → Shows events for "North East" region
  - `local-newcastle` → Shows events for "Newcastle" location

## 🔒 Permissions & Restrictions

### Role Requirements
- **Member Commands**: Require member role
- **Moderator Commands**: Require moderator role OR "Manage Roles" permission
- **Event Commands**: Available in regional/local channels with member role

### Channel Restrictions
- **Bot Commands**: Only work in designated bot channels
- **Event Viewing**: `!events` only works in regional/local channels
- **Proposal Creation**: Only works in designated debate channels
- **Voting**: Only works in designated vote channels

### Error Messages
The bot provides helpful error messages for:
- **Permission Issues**: "❌ You need the member role to use bot commands"
- **Channel Restrictions**: "❌ This command only works in regional/local channels"
- **Invalid Formats**: "❌ Invalid date format. Use: YYYY-MM-DD HH:MM"
- **Missing Roles**: "❌ Region role 'North East' not found"

## 🆘 Help & Support

### Getting Help
- Use `!help` in any bot channel for context-appropriate help
- Check this documentation for detailed command information
- Ask moderators for assistance with complex features
- Report issues in the appropriate support channels

### Troubleshooting
- **Commands not working**: Check you're in the right channel with the right role
- **Events not showing**: Make sure you're in a regional or local channel
- **Proposals not advancing**: Check if support threshold has been met
- **Permission errors**: Verify you have the required role

### Common Mistakes
- Using `!events` in bot channels instead of regional/local channels
- Forgetting to mention roles properly in `!addevent` command
- Using wrong date format (use YYYY-MM-DD HH:MM)
- Trying to create proposals in vote/resolution channels instead of debate channels

---

**Last Updated**: August 2025  
**Bot Version**: Latest with Event System  
**Coverage**: All current commands and features