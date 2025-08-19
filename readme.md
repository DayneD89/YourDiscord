# YourPartyServer - Discord Community Governance Bot

A powerful Discord bot that enables democratic community governance through automated proposal systems, voting mechanisms, and role management. Built with Node.js and deployed on AWS infrastructure.

[![Bot Status](https://img.shields.io/badge/status-active-brightgreen)](https://github.com/DayneD89/YourDiscord)
[![Node.js](https://img.shields.io/badge/node.js-v18+-blue)](https://nodejs.org/)
[![AWS](https://img.shields.io/badge/AWS-deployed-orange)](https://aws.amazon.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/DayneD89/YourDiscord/blob/main/LICENSE)
[![Tests](https://github.com/DayneD89/YourDiscord/actions/workflows/test-and-coverage.yaml/badge.svg)](https://github.com/DayneD89/YourDiscord/actions/workflows/test-and-coverage.yaml)
[![Coverage](https://img.shields.io/badge/coverage-report-blue)](https://dayned89.github.io/YourDiscord/)
[![Security](https://github.com/DayneD89/YourDiscord/actions/workflows/security-scan.yaml/badge.svg)](https://github.com/DayneD89/YourDiscord/actions/workflows/security-scan.yaml)

## 🚀 Features

### 🎯 Reaction Role System
- **Automated Role Assignment**: Users get roles by reacting to configured messages
- **Persistent Configuration**: S3-backed storage survives bot restarts and deployments
- **Flexible Actions**: Support for adding/removing roles based on reactions
- **Message Pre-caching**: Ensures reliable reaction detection across restarts

### 🗳️ Democratic Proposal System
- **Multi-Type Proposals**: Support for different governance categories (policy, governance, etc.)
- **Support Thresholds**: Proposals advance to voting based on community support reactions
- **Automated Voting**: Time-limited voting periods with automatic result processing
- **Resolution Management**: Passed proposals become official resolutions with withdrawal support
- **Withdrawal System**: Community can democratically reverse previous decisions

### 📅 Community Event Management
- **Moderator Event Creation**: `!addevent` command for scheduling regional and local events
- **Automated Notifications**: Event announcements sent to appropriate regional/local channels
- **Smart Reminder System**: Automated 7-day and 24-hour reminders with role targeting
- **DynamoDB Storage**: Persistent event data with TTL-based automatic cleanup
- **Regional Targeting**: Events target specific regions and locations with proper role integration

### 🔐 Permission Management
- **Role-Based Access**: Separate permissions for moderators and members
- **Channel Restrictions**: Commands only work in designated channels
- **User Validation**: Comprehensive eligibility checking for all actions
- **Bot Protection**: Prevents automation loops and unauthorized access

### 🛡️ Security Features
- **Pre-commit Security Hooks**: Prevent Discord tokens, AWS credentials, and secrets from being committed
- **Automated Security Scanning**: GitHub Actions workflows scan for vulnerabilities on every commit
- **Documentation Exclusions**: Smart filtering excludes security pattern documentation from scans
- **Secure Secret Management**: Environment variables and GitHub Secrets for sensitive data
- **Private Key Detection**: Automated detection of SSH and API keys before commits

### 🏗️ Infrastructure
- **Zero-Downtime Deployment**: Health check verified deployments with no service interruption
- **Private Subnet Security**: Enhanced security with NAT Gateway and no direct internet access
- **Environment Isolation**: Separate CIDR blocks for main and feature branch deployments
- **Application Health Checks**: HTTP endpoint monitoring for deployment confidence
- **Hybrid Storage**: S3 for configurations, DynamoDB for proposals and events
- **Smart Terraform Wrappers**: Discord API retry logic and timeout handling for reliable deployments
- **GitHub Actions CI/CD**: Automated testing, coverage, and deployment pipeline

### 📊 Testing & Coverage
- **Comprehensive Test Suite**: 843+ unit and integration tests with Jest framework
- **Code Coverage Enforcement**: Strict coverage thresholds (95%+ statements)
- **Current Coverage**: 94.91% statements, 88.43% branches, 92.3% functions, 95.52% lines
- **High-Quality Standards**: 100% coverage for core components (ConfigManager, EventManager, processors)
- **Analytics Dashboard**: Interactive coverage reports with code metrics and charts
- **Automated Coverage Reports**: GitHub Pages deployment with visual analytics
- **PR Coverage Comments**: Automatic coverage feedback on pull requests
- **Test Utilities**: Unified test helpers and mock factories for consistent testing patterns

## 📁 Project Structure

```
yourpartyserver/
├── YourBot/                    # Discord bot application
│   ├── src/                    # Source code modules (clean architecture)
│   │   ├── core/               # Core system components (lifecycle, orchestration, config)
│   │   ├── handlers/           # Event and command handlers
│   │   ├── managers/           # Business logic managers (proposals, events)
│   │   ├── processors/         # Specialized processors (parsing, validation)
│   │   ├── storage/            # Data persistence layer (DynamoDB, S3)
│   │   ├── validators/         # Permission and data validation
│   │   └── DiscordReactionBot.js # Main bot coordinator
│   ├── tests/                  # Comprehensive test suite (843+ tests)
│   │   ├── unit/               # Unit tests organized by module
│   │   │   └── core/           # Tests for core components
│   │   ├── integration/        # Integration tests
│   │   ├── helpers/            # Unified test utilities and factories
│   │   └── examples/           # Test pattern examples
│   ├── coverage/               # Generated coverage reports (95%+ overall)
│   ├── deployment/             # Health check and deployment files
│   ├── bot.js                  # Application entry point
│   └── package.json            # Node.js dependencies with Jest configuration
├── terraform/                  # Infrastructure as Code
│   ├── *.tf                    # Terraform configuration files
│   ├── modules/                # Reusable Terraform modules
│   ├── networking.tf           # VPC, subnets, NAT Gateway configuration
│   ├── user_data_enhanced.sh.tpl # Health check enabled EC2 initialization
│   ├── messages/               # Discord channel content templates
│   └── images/                 # Server branding assets
├── docs/                       # Comprehensive documentation
│   ├── workflows.md            # GitHub Actions workflow documentation
│   ├── scripts.md              # Utility script documentation
│   └── zero-downtime-deployment.md # Deployment strategy guide
├── scripts/                    # Security and deployment utilities
│   ├── setup-security.sh       # Pre-commit hook installation
│   ├── terraform-wrapper.sh    # Discord API resilient Terraform wrapper
│   └── terraform-apply-retry.sh # Retry logic for Discord timeouts
└── .github/workflows/          # Advanced CI/CD automation
    ├── test-and-coverage.yaml  # Testing with coverage enforcement
    ├── security-scan.yaml      # Automated security scanning
    └── build_infra.yaml        # Zero-downtime deployment pipeline
```

### 📊 Coverage Dashboard
View live analytics and coverage reports: **[Coverage Dashboard](https://dayned89.github.io/YourDiscord/)**

**Features:**
- 📈 Interactive charts showing code distribution and test coverage
- 📊 Real-time metrics on lines of code by category
- 🎯 Visual indicators for untested files
- 📱 Mobile-responsive design with modern UI

## 🚀 Getting Started

### 🎯 Quick Start for New Contributors

Want to make your first contribution? Here's a complete walkthrough from cloning to creating a pull request!

#### 🔧 Prerequisites
- Git installed on your computer
- Node.js 18+ installed
- GitHub account
- Text editor (VS Code recommended)

#### 📦 Step 1: Clone and Setup
```bash
# 1. Fork the repository on GitHub (click Fork button)
# 2. Clone your fork locally
git clone https://github.com/YOUR_USERNAME/YourDiscord.git
cd YourDiscord

# 3. Set up security measures (prevents accidentally committing tokens)
./scripts/setup-security.sh

# 4. Add upstream remote to stay in sync
git remote add upstream https://github.com/DayneD89/YourDiscord.git

# 5. Install dependencies
cd YourBot
npm install
```

#### ✏️ Step 2: Make Your First Change
Let's fix a simple spelling mistake in a message:

```bash
# 1. Create a feature branch
git checkout -b fix/improve-help-message

# 2. Find and edit a message file
# Example: Edit YourBot/src/handlers/CommandRouter.js
# Look for a help message or user-facing text

# 3. Make your change (example)
# Before: "Here's the available commands"
# After:  "Here are the available commands"
```

#### 🧪 Step 3: Test Your Changes
```bash
# 1. Run the test suite to ensure nothing broke
npm test

# 2. Check code coverage (should maintain >94%)
npm run test:coverage

# 3. If tests pass, you're ready to commit!
```

#### 💾 Step 4: Commit Your Changes
```bash
# 1. Stage your changes
git add .

# 2. Commit with a descriptive message
git commit -m "Fix grammar in help command message

- Change 'Here's the' to 'Here are the' for grammatical correctness
- Improve readability of user-facing text"

# 3. Push to your fork
git push origin fix/improve-help-message
```

#### 🔄 Step 5: Create Pull Request
1. **Go to GitHub**: Visit your fork on GitHub
2. **Create PR**: Click "Compare & pull request" button
3. **Fill out template**: 
   - **Title**: `Fix grammar in help command message`
   - **Description**: Explain what you changed and why
   - **Testing**: "Ran full test suite, all 843+ tests pass"

#### 🚀 Step 6: Request Development Testing
In your PR description or comments, add:

```markdown
@DayneD89 Could you please deploy this to the dev environment for testing?

This change updates user-facing text and I'd like to verify it displays correctly in Discord before merging.
```

**Important**: You can ask for dev deployment at any time after creating your PR. This allows testing the actual functionality in a real Discord environment before the code is merged to main.

#### 🎉 Step 7: Follow Through
- **Respond to feedback**: Address any review comments
- **Keep updated**: If requested, update your PR with changes
- **Celebrate**: Once approved and merged, your contribution is live!

### 📋 More Examples of Beginner-Friendly Changes
- **Messages**: Fix spelling/grammar in bot responses
- **Documentation**: Improve README files or add examples  
- **Error Messages**: Make error messages more helpful
- **Comments**: Add explanatory comments to complex code
- **Tests**: Add test cases for edge cases
- **Configuration**: Improve configuration validation messages

### 🎯 Quick Start for Different User Types

#### For Discord Server Users
1. Join a server with YourPartyServer deployed
2. Get the member role by reacting to the welcome message
3. Use `!help` in the member command channel to see available commands
4. Participate in proposals by reacting with ✅ for support
5. Vote on proposals that advance to the voting phase

#### For Experienced Contributors
1. **Security Setup**: Run `./scripts/setup-security.sh` to install pre-commit hooks
2. **Environment Setup**: Copy `.env.example` to `.env` and add your Discord token
3. **Never Commit Tokens**: Our security measures prevent accidental token commits
4. **Test Coverage**: Maintain >94% statement coverage and >92% function coverage
5. **Terraform Operations**: Use `./scripts/terraform-wrapper.sh apply` for reliability

#### For Server Administrators
1. **Deploy Your Own**: Follow the [Self-Hosting Guide](docs/self-hosting.md)
2. **Configure Channels**: Set up debate, voting, and resolution channels
3. **Manage Configurations**: Use moderator commands to configure reaction roles
4. **Monitor Proposals**: Watch the democratic process unfold in your community

## 🛡️ Security

### 🔒 Token Protection
This project includes comprehensive security measures to prevent accidental exposure of Discord tokens and other secrets:

- **Pre-commit Hooks**: Automatically scan for Discord tokens, AWS credentials, and other secrets
- **GitHub Actions Security**: Automated secret detection on every commit and PR
- **Comprehensive .gitignore**: Prevents common secret files from being committed
- **Environment Variables**: All sensitive data managed through environment variables

### 🚀 Setup Security Measures
```bash
# Install pre-commit hooks and security scanning
./scripts/setup-security.sh

# Verify security setup
pre-commit run --all-files
```

## 📖 Documentation

### 📋 Complete Documentation Index
**[📚 Browse All Documentation](docs/index.md)** - Comprehensive guide to all available documentation

### 🚀 Quick Links
- **[🛠️ Developer Guide](docs/contributing-dev.md)** - Code contributions and architecture
- **[👥 Non-Developer Guide](docs/contributing-nondev.md)** - Documentation and community contributions  
- **[🏠 Self-Hosting Guide](docs/self-hosting.md)** - Deploy your own instance
- **[🔄 Workflows Documentation](docs/workflows.md)** - GitHub Actions CI/CD pipeline
- **[🔧 Scripts Documentation](docs/scripts.md)** - Security and Terraform utility scripts

### 🎯 New Contributors Start Here
1. **[Contributing Guidelines](docs/contributing-nondev.md)** - Choose your contribution path
2. **[Security Setup](docs/scripts.md#setup-securitysh)** - Install token protection: `./scripts/setup-security.sh`
3. **[Development Workflow](docs/workflows.md)** - Understand our quality gates and CI/CD

### 🔧 Operations & Troubleshooting
- **[Zero-Downtime Deployment](docs/zero-downtime-deployment.md)** - Health check verified deployments
- **[Discord API Issues](docs/scripts.md#terraform-wrappersh)** - Fix "context deadline exceeded" errors
- **[Coverage Requirements](docs/workflows.md#coverage-requirements)** - Test coverage standards
- **[Security Features](docs/workflows.md#-security-scan-workflow)** - Automated secret detection

## 🤝 Contributing

We welcome contributions from developers and non-developers alike! Here's how you can help:

### 🧑‍💻 For Developers
- **Code Contributions**: Add features, fix bugs, improve performance
- **Architecture Improvements**: Help migrate to serverless, optimize costs
- **Infrastructure**: Enhance Terraform configurations and deployment processes
- **Testing**: Add tests, improve reliability, performance optimization

[Read the Developer Contributing Guide →](docs/contributing-dev.md)

### 👥 For Non-Developers
- **Documentation**: Improve guides, write tutorials, create examples
- **Bug Reports**: Report issues, test features, provide feedback
- **Community**: Help others, answer questions, suggest improvements
- **Content**: Create channel messages, governance templates, community resources

[Read the Non-Developer Contributing Guide →](docs/contributing-nondev.md)

### 🚀 Self-Hosting
Want to run your own instance? Our comprehensive guide covers everything from AWS account setup to Discord bot configuration.

[Read the Self-Hosting Guide →](docs/self-hosting.md)

## 🔧 Current Architecture

### Deployment Model
- **EC2 Instance**: Single instance running the Node.js bot
- **S3 Storage**: Persistent data storage for configurations and proposals
- **Terraform**: Infrastructure management and automated deployments
- **GitHub Actions**: CI/CD pipeline for code and infrastructure updates

### Quality Assurance
- **Test Coverage**: 95%+ statement coverage with 100% for critical modules
- **Security Scanning**: Automated token and credential detection
- **Pre-commit Hooks**: Local security validation before commits
- **Automated Testing**: Comprehensive test suite with 817+ tests
- **Clean Architecture**: Modular design with unified test utilities and documentation
- **DynamoDB Storage**: Modern AWS SDK v3 with efficient querying and persistence

### Future Roadmap
- **Serverless Migration**: Move to AWS Lambda for cost optimization
- ✅ **Database Integration**: DynamoDB implemented for proposal storage (completed)
- ✅ **Event Management System**: Complete event system with reminders and notifications (completed)
- **Multi-Guild Support**: Enable single deployment to serve multiple Discord servers
- **Plugin System**: Modular architecture for custom community features

## 📊 Project Stats

[![GitHub stars](https://img.shields.io/github/stars/DayneD89/YourDiscord)](https://github.com/DayneD89/YourDiscord/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/DayneD89/YourDiscord)](https://github.com/DayneD89/YourDiscord/network)
[![GitHub issues](https://img.shields.io/github/issues/DayneD89/YourDiscord)](https://github.com/DayneD89/YourDiscord/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/DayneD89/YourDiscord)](https://github.com/DayneD89/YourDiscord/commits)

- **Code Coverage**: Enforced quality gates with 94.91% statements and 92.3% functions coverage
- **Test Suite**: 843+ comprehensive tests across unit and integration scenarios  
- **Infrastructure**: Fully automated deployment with Terraform and AWS (ALB health checks)
- **CI/CD Pipeline**: Continuous integration with GitHub Actions and coverage enforcement
- **Security**: Automated secret detection and pre-commit security validation

## 🐛 Support & Issues

### Reporting Bugs
Found a bug? Please help us improve by [creating an issue](https://github.com/DayneD89/YourDiscord/issues/new) with:
- Detailed description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- Screenshots or error messages (if applicable)

### Feature Requests
Have an idea for a new feature? [Submit a feature request](https://github.com/DayneD89/YourDiscord/issues/new) and let's discuss how to make it happen!

### Community Discussion
- **GitHub Repository**: [DayneD89/YourDiscord](https://github.com/DayneD89/YourDiscord)
- **GitHub Issues**: [Report Bugs & Request Features](https://github.com/DayneD89/YourDiscord/issues)
- **Coverage Reports**: [Live Coverage Dashboard](https://dayned89.github.io/YourDiscord/)

## 🔧 Troubleshooting

### Discord API Timeout Issues
If you encounter "context deadline exceeded" errors with Terraform:

```bash
# Use the wrapper script with automatic retries
./scripts/terraform-wrapper.sh apply

# Or use the manual retry script
./scripts/terraform-apply-retry.sh terraform apply

# For persistent issues, reduce parallelism
terraform apply -parallelism=1
```

### Common Error Patterns
- **"context deadline exceeded"**: Discord API timeout - retry after 30 seconds
- **"Failed to find channel"**: Channel deleted outside Terraform - run `terraform refresh`
- **"rate limited"**: Too many API calls - wait 60 seconds and retry
- **Check Discord status**: https://discordstatus.com/

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Discord.js**: Excellent Discord API library
- **AWS**: Reliable cloud infrastructure
- **Terraform**: Infrastructure as Code framework
- **Community Contributors**: Everyone who helps make this project better

## 🔗 Links

- **GitHub Repository**: [DayneD89/YourDiscord](https://github.com/DayneD89/YourDiscord)
- **Code Coverage**: [Live Coverage Reports](https://dayned89.github.io/YourDiscord/)
- **CI/CD Pipeline**: [GitHub Actions](https://github.com/DayneD89/YourDiscord/actions)
- **Security Scans**: [Security Workflow](https://github.com/DayneD89/YourDiscord/actions/workflows/security-scan.yaml)
- **Issue Tracker**: [GitHub Issues](https://github.com/DayneD89/YourDiscord/issues)
- **Deployment Guide**: [Self-Hosting Documentation](docs/self-hosting.md)

---

**Made with ❤️ by the YourPartyServer community**

*Empowering Discord communities with democratic governance and automated moderation.*