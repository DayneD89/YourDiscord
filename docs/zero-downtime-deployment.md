# Zero-Downtime Deployment Guide

This document explains the zero-downtime deployment system implemented for the YourDiscord bot, including health checks, private subnet deployment, and migration strategies.

## 🚀 Overview

The enhanced deployment system ensures that:
- ✅ **New bot code is fully ready** before terminating the old instance
- ✅ **Discord connectivity is verified** before switching over
- ✅ **Private subnet security** is available with NAT Gateway
- ✅ **Health monitoring** provides deployment confidence
- ✅ **Migration path** from legacy to enhanced deployment

## 🏗️ Architecture

### Enhanced Instance Features
- **Private Subnet Deployment** - Enhanced security with NAT Gateway
- **Health Check Endpoint** - HTTP endpoint at `:3000/health`  
- **Application Readiness** - Bot signals when fully connected to Discord
- **Enhanced Logging** - Separate streams for bot and health check logs
- **Graceful Shutdown** - Proper cleanup on termination signals

### Network Security
```
Internet → NAT Gateway → Private Subnet → Bot Instance
                                       ↓
                              Discord API (outbound only)
```

## 🔧 Configuration Variables

### Core Settings
```hcl
# Enable private subnet with NAT Gateway (recommended)
use_private_subnet = true

# Control legacy instance during migration
enable_legacy_instance = false
```

### Migration Settings
For migrating from existing deployment:
```hcl
# Step 1: Enable both instances
enable_legacy_instance = true
use_private_subnet = true

# Step 2: After verification, disable legacy
enable_legacy_instance = false
```

## 📊 Health Check System

### Health Endpoint
The bot exposes a health check endpoint at `http://localhost:3000/health`:

**Healthy Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "uptime": 45.123
}
```

**Starting Response (503 Service Unavailable):**
```json
{
  "status": "starting", 
  "timestamp": "2024-01-15T14:29:30.000Z"
}
```

### Health Check Flow
1. **Instance Starts** - Health endpoint responds with "starting"
2. **Bot Connects** - Discord.js establishes connection
3. **Ready Signal** - Bot emits readiness event
4. **Health File Created** - `/tmp/bot-ready` file signals readiness
5. **Healthy Status** - Health endpoint responds with "healthy"

## 🚀 Deployment Process

### New Deployment (Enhanced Only)
```bash
# Deploy with enhanced system
terraform apply -var="use_private_subnet=true"

# Monitor deployment
terraform output network_configuration
```

### Migration from Legacy
```bash
# Step 1: Enable both instances
terraform apply -var="enable_legacy_instance=true" -var="use_private_subnet=true"

# Step 2: Verify enhanced instance health
curl -f http://ENHANCED_INSTANCE_IP:3000/health

# Step 3: Disable legacy instance
terraform apply -var="enable_legacy_instance=false"
```

## 🔍 Monitoring & Verification

### CloudWatch Logs
Enhanced logging provides separate streams:
- **Bot Logs**: `/ec2/{environment}-logs/{instance-id}-bot`
- **Health Logs**: `/ec2/{environment}-logs/{instance-id}-health`

### Health Verification
```bash
# Check health endpoint
curl -f http://INSTANCE_IP:3000/health

# View health logs
aws logs tail /ec2/yourdiscord-main-logs --follow

# Check systemd services
sudo systemctl status discord-bot
sudo systemctl status discord-health
```

### Network Verification
```bash
# Test outbound connectivity (from instance)
curl -I https://discord.com/api/v9/gateway

# Check NAT Gateway traffic (from AWS Console)
# VPC → NAT Gateways → Monitoring
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Code changes tested locally
- [ ] S3 bucket accessible
- [ ] Discord token valid
- [ ] AWS credentials configured

### Deployment Verification
- [ ] Instance launches successfully
- [ ] Health endpoint responds "starting"
- [ ] Bot connects to Discord
- [ ] Health endpoint responds "healthy"
- [ ] CloudWatch logs flowing
- [ ] Discord bot commands working

### Post-Deployment
- [ ] Monitor health endpoint for 24 hours
- [ ] Verify Discord functionality
- [ ] Check CloudWatch metrics
- [ ] Disable legacy instance (if applicable)

## 🛠️ Troubleshooting

### Health Check Failures

**Health endpoint not responding:**
```bash
# Check if health service is running
sudo systemctl status discord-health

# Check port binding
sudo netstat -tlnp | grep :3000

# Check health service logs
sudo journalctl -u discord-health -f
```

**Bot not becoming ready:**
```bash
# Check bot logs
sudo journalctl -u discord-bot -f

# Check Discord connectivity
curl -I https://discord.com/api/v9/gateway

# Check bot readiness file
ls -la /tmp/bot-ready
cat /tmp/bot-ready
```

### Network Issues

**Private subnet connectivity:**
```bash
# Check NAT Gateway status
aws ec2 describe-nat-gateways --filters Name=vpc-id,Values=VPC_ID

# Check route table
aws ec2 describe-route-tables --filters Name=vpc-id,Values=VPC_ID

# Test DNS resolution
nslookup discord.com
```

**Security group issues:**
```bash
# Check security group rules
aws ec2 describe-security-groups --group-ids SG_ID

# Test port connectivity
telnet localhost 3000
```

### Deployment Orchestration

**Terraform health check failures:**
```bash
# Check instance accessibility
aws ec2 describe-instances --instance-ids INSTANCE_ID

# Manual health check
curl -f http://PRIVATE_IP:3000/health

# Review orchestration logs
terraform apply -var="enable_legacy_instance=true" 2>&1 | tee deploy.log
```

## 📈 Performance Monitoring

### Key Metrics
- **Instance Launch Time** - Time from start to health check passing
- **Bot Readiness Time** - Time from start to Discord connection
- **Health Check Response Time** - Latency of health endpoint
- **Memory Usage** - Bot memory consumption over time
- **Network Throughput** - NAT Gateway data transfer

### Alerting Recommendations
```bash
# CloudWatch Alarms
- Health check failures > 3 in 5 minutes
- Instance CPU > 80% for 10 minutes  
- Memory usage > 90% for 5 minutes
- NAT Gateway error rate > 1%
```

## 🔐 Security Considerations

### Private Subnet Benefits
- **No Direct Internet Access** - Instance cannot be reached from internet
- **NAT Gateway Filtering** - Only outbound connections allowed
- **VPC Network Controls** - Traffic controlled by security groups
- **Enhanced Monitoring** - VPC Flow Logs capture all traffic

### Security Best Practices
- Health check port (3000) only accessible within VPC
- Discord token stored in environment variables
- S3 access via IAM roles (no hardcoded credentials)
- CloudWatch logs encrypted at rest

## 🔄 Rollback Procedures

### Emergency Rollback
If enhanced instance fails:
```bash
# Re-enable legacy instance immediately
terraform apply -var="enable_legacy_instance=true"

# Monitor legacy instance health
sudo systemctl status discord-bot

# Investigate enhanced instance issues
terraform destroy -target=aws_instance.bot_enhanced
```

### Planned Rollback
For planned reversion to legacy:
```bash
# Set variables for legacy deployment
terraform apply \
  -var="enable_legacy_instance=true" \
  -var="use_private_subnet=false"

# Verify legacy instance working
# Disable enhanced instance
terraform destroy -target=aws_instance.bot_enhanced
```

## 📝 Best Practices

### Development Workflow
1. **Test Locally** - Verify bot functionality before deployment
2. **Staging Environment** - Use dev environment for testing
3. **Health Monitoring** - Always verify health checks pass
4. **Gradual Rollout** - Enable enhanced alongside legacy initially
5. **Monitor Metrics** - Watch CloudWatch for anomalies

### Production Deployment
1. **Maintenance Windows** - Deploy during low-usage periods
2. **Backup Strategy** - Ensure S3 state backup before changes
3. **Communication** - Notify users of potential brief disruptions
4. **Rollback Plan** - Have tested rollback procedure ready
5. **Post-Deployment** - Monitor for 24 hours after deployment

---

**Last Updated**: January 2025  
**Maintained by**: YourDiscord Infrastructure Team