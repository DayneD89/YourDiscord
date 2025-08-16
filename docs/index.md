# YourDiscord Documentation Index

Welcome to the comprehensive documentation for YourDiscord - a Discord community governance bot with Infrastructure as Code management.

## 📚 Quick Navigation

### 🚀 Getting Started
- **[README](../README.md)** - Project overview, features, and quick start guide
- **[Contributing (Non-Dev)](contributing-nondev.md)** - How to contribute without coding experience
- **[Contributing (Dev)](contributing-dev.md)** - Technical contribution guide for developers
- **[Self-Hosting Guide](self-hosting.md)** - Deploy your own instance

### 🔧 Development & Operations
- **[GitHub Actions Workflows](workflows.md)** - CI/CD pipeline documentation
- **[Scripts Documentation](scripts.md)** - Utility scripts for security and Terraform
- **[Architecture Overview](architecture.md)** - System design and component interactions *(coming soon)*
- **[API Reference](api.md)** - Bot commands and event interfaces *(coming soon)*

### 🏗️ Infrastructure
- **[Terraform Documentation](../terraform/readme.md)** - Infrastructure as Code details *(coming soon)*
- **[AWS Setup Guide](aws-setup.md)** - AWS account configuration *(coming soon)*
- **[Discord Bot Setup](discord-setup.md)** - Discord application configuration *(coming soon)*

### 📖 User Guides
- **[User Manual](user-guide.md)** - How to use bot features *(coming soon)*
- **[Proposal System Guide](proposal-guide.md)** - Creating and participating in proposals *(coming soon)*
- **[Commands Reference](commands.md)** - Complete list of bot commands *(coming soon)*

## 🔍 Documentation by Topic

### Security
- [🔒 Security Overview](workflows.md#-security-scan-workflow) - Automated security scanning
- [🛡️ Pre-commit Hooks](scripts.md#setup-securitysh) - Prevent token commits
- [🔐 Secret Management](workflows.md#security-features) - Environment variables and GitHub Secrets

### Testing & Quality
- [🧪 Test Coverage](workflows.md#-test--coverage-workflow) - Automated testing and coverage
- [📊 Coverage Dashboard](https://dayned89.github.io/YourDiscord/) - Live coverage reports
- [🎯 Quality Gates](workflows.md#coverage-requirements) - Merge requirements

### Terraform & Infrastructure
- [🔧 Discord API Issues](scripts.md#terraform-wrappersh) - Handling timeout and rate limits
- [🚀 Deployment Pipeline](workflows.md#-infrastructure-deployment-workflow) - Automated deployments
- [🔄 Retry Strategies](scripts.md#terraform-apply-retrysh) - Reliable infrastructure updates

### Discord Bot
- [🤖 Bot Architecture](../YourBot/readme.md) - Source code structure *(coming soon)*
- [🗳️ Governance System](../terraform/messages/) - Democratic proposal templates
- [🎯 Reaction Roles](../terraform/channels.tf) - Automated role management

## 🛠️ Tools & Scripts Reference

### Available Scripts
```bash
# Security setup
./scripts/setup-security.sh

# Terraform operations (recommended)
./scripts/terraform-wrapper.sh apply
./scripts/terraform-apply-retry.sh

# Testing
npm test                    # Run tests
npm run test:coverage      # Generate coverage
```

### GitHub Actions
- **[Test & Coverage](../.github/workflows/test-and-coverage.yaml)** - Quality assurance
- **[Security Scan](../.github/workflows/security-scan.yaml)** - Secret detection  
- **[Infrastructure Deploy](../.github/workflows/build_infra.yaml)** - AWS/Discord updates

### Configuration Files
- **[Pre-commit Config](../.pre-commit-config.yaml)** - Local security hooks
- **[Jest Config](../YourBot/package.json)** - Test and coverage settings
- **[Terraform Config](../terraform/)** - Infrastructure definitions
- **[Gitignore](../.gitignore)** - Excluded files and secrets

## 📋 Documentation Status

### ✅ Complete Documentation
- [x] Project README with comprehensive overview
- [x] GitHub Actions workflows explanation
- [x] Scripts documentation with usage examples
- [x] Security setup and configuration
- [x] Terraform Discord API handling
- [x] Contributing guidelines for developers and non-developers
- [x] Self-hosting deployment guide

### 🚧 In Progress
- [ ] Architecture overview and system design
- [ ] API reference for bot commands
- [ ] User manual for Discord server members
- [ ] Terraform infrastructure deep-dive

### 📝 Planned Documentation
- [ ] Proposal system user guide
- [ ] Commands reference with examples
- [ ] AWS setup and configuration guide
- [ ] Discord bot application setup
- [ ] Troubleshooting guide with common issues
- [ ] Performance optimization guide

## 🤝 Contributing to Documentation

### How to Help
1. **Fix typos or errors** - Submit PRs for any documentation issues
2. **Add examples** - Real-world usage examples are always helpful
3. **Fill gaps** - Help complete the planned documentation items
4. **User feedback** - Report unclear or missing information

### Documentation Standards
- **Clear headings** - Use descriptive section titles
- **Code examples** - Include working examples with expected output
- **Screenshots** - Visual guides for UI-based processes
- **Links** - Cross-reference related documentation
- **Troubleshooting** - Include common issues and solutions

### Writing Guidelines
- **Audience-focused** - Write for the intended user (developer vs. end-user)
- **Step-by-step** - Break complex processes into clear steps
- **Error handling** - Document what can go wrong and how to fix it
- **Assumptions** - State prerequisites and assumptions clearly

## 🔗 External Resources

### Discord Development
- [Discord.js Documentation](https://discord.js.org/) - Bot library docs
- [Discord Developer Portal](https://discord.com/developers/docs) - Official API reference
- [Discord Server Status](https://discordstatus.com/) - API health monitoring

### Infrastructure & DevOps
- [Terraform Discord Provider](https://registry.terraform.io/providers/Lucky3028/discord/latest/docs) - Infrastructure as Code
- [AWS Documentation](https://docs.aws.amazon.com/) - Cloud infrastructure
- [GitHub Actions Docs](https://docs.github.com/en/actions) - CI/CD workflows

### Testing & Quality
- [Jest Documentation](https://jestjs.io/) - Testing framework
- [GitHub Pages](https://pages.github.com/) - Static site hosting
- [Pre-commit](https://pre-commit.com/) - Git hook framework

## 📞 Getting Help

### Community Support
- **GitHub Issues** - [Report bugs or request features](https://github.com/DayneD89/YourDiscord/issues)
- **Discussions** - Community Q&A and general discussion
- **Discord Server** - Real-time help and community interaction

### Documentation Issues
If you find any documentation that is:
- Unclear or confusing
- Missing important information  
- Contains errors or outdated information
- Needs better examples

Please [open an issue](https://github.com/DayneD89/YourDiscord/issues/new) with the "documentation" label.

---

**Last Updated**: January 2025  
**Maintained by**: YourDiscord Community  
**License**: MIT License