# SongNodes Maintenance Scripts

This directory contains automated maintenance scripts for the SongNodes project, implementing comprehensive project cleanup, dependency management, and health monitoring.

## Scripts Overview

### 🧹 cleanup.sh
Automated project cleanup and organization script.

**Features:**
- Docker resource cleanup (containers, images, volumes, networks)
- Node.js artifacts cleanup (node_modules, package-lock.json, npm cache)
- Python artifacts cleanup (__pycache__, .pyc files, build/dist directories)
- Log file rotation (keeps last 30 days)
- Temporary file removal
- Large file detection and reporting
- Root directory file count validation
- Dependency security auditing

**Usage:**
```bash
# Full cleanup
./scripts/maintenance/cleanup.sh

# Docker only
./scripts/maintenance/cleanup.sh --docker-only

# Node.js only
./scripts/maintenance/cleanup.sh --node-only

# Python only
./scripts/maintenance/cleanup.sh --python-only

# Dry run (show what would be cleaned)
./scripts/maintenance/cleanup.sh --dry-run
```

**NPM Scripts:**
```bash
npm run maintenance:cleanup
```

### 📦 update-dependencies.sh
Automated dependency update and security audit script.

**Features:**
- Node.js dependency updates (npm update, security fixes)
- Python dependency updates (pip/uv upgrade)
- Docker base image updates
- System package checking
- Security vulnerability scanning
- Dependency backup before updates
- Service testing after updates
- Comprehensive update reporting

**Usage:**
```bash
# Full dependency update
./scripts/maintenance/update-dependencies.sh

# Node.js only
./scripts/maintenance/update-dependencies.sh --node-only

# Python only
./scripts/maintenance/update-dependencies.sh --python-only

# Docker images only
./scripts/maintenance/update-dependencies.sh --docker-only

# Security scan only
./scripts/maintenance/update-dependencies.sh --security-only

# Dry run
./scripts/maintenance/update-dependencies.sh --dry-run
```

**NPM Scripts:**
```bash
npm run maintenance:update
```

### 🏥 health-check.sh
Comprehensive project health monitoring and diagnostic script.

**Features:**
- Project structure validation
- System dependency verification
- Docker service health monitoring
- MCP server connectivity testing
- API Gateway availability checking
- Database connectivity validation
- Log error detection
- Disk usage monitoring
- Security configuration validation
- Health scoring and reporting

**Usage:**
```bash
# Full health check
./scripts/maintenance/health-check.sh

# Services only
./scripts/maintenance/health-check.sh --services-only

# Security only
./scripts/maintenance/health-check.sh --security-only

# Quick check
./scripts/maintenance/health-check.sh --quick
```

**NPM Scripts:**
```bash
npm run maintenance:health
npm run maintenance:full  # Health check + cleanup
```

## Automation Setup

### Cron Jobs
Use the provided crontab example for automated scheduling:

```bash
# Copy cron configuration
cp scripts/maintenance/crontab.example /tmp/songnodes-cron

# Edit paths and schedule as needed
nano /tmp/songnodes-cron

# Install cron jobs
crontab /tmp/songnodes-cron

# Verify installation
crontab -l
```

### Recommended Schedule

| Task | Frequency | Time | Purpose |
|------|-----------|------|---------|
| Health Check | Daily | 8:00 AM | Monitor system health |
| Cleanup | Weekly | Sunday 2:00 AM | Clean up artifacts |
| Dependency Updates | Bi-weekly | 1st/15th 3:00 AM | Security and features |
| Full Maintenance | Monthly | 1st 4:00 AM | Comprehensive check |

### Systemd Timers (Alternative to Cron)

Create systemd timer units for more robust scheduling:

```bash
# Health check timer
sudo systemctl enable --now songnodes-health.timer

# Cleanup timer
sudo systemctl enable --now songnodes-cleanup.timer

# Update timer
sudo systemctl enable --now songnodes-update.timer
```

## Output and Reporting

### Log Files
All scripts generate detailed logs in `logs/` directory:

- `cleanup-YYYYMMDD-HHMMSS.log` - Cleanup execution logs
- `dependency-update-YYYYMMDD-HHMMSS.log` - Update execution logs
- `health-check-YYYYMMDD-HHMMSS.log` - Health check execution logs

### Reports
Comprehensive markdown reports are generated:

- `cleanup-report-YYYYMMDD-HHMMSS.md` - Cleanup summary and metrics
- `dependency-update-report-YYYYMMDD-HHMMSS.md` - Update summary and status
- `health-report-YYYYMMDD-HHMMSS.md` - Health score and recommendations

### Health Scoring
The health check script provides a 0-100 health score:

- **90-100**: Excellent - No action needed
- **70-89**: Good - Address minor warnings
- **50-69**: Fair - Attention required
- **<50**: Poor - Immediate action required

## Integration with CI/CD

### GitHub Actions
Integrate maintenance scripts with GitHub Actions:

```yaml
name: Maintenance
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  maintenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run maintenance
        run: |
          ./scripts/maintenance/health-check.sh
          ./scripts/maintenance/cleanup.sh
```

### Docker Integration
Run maintenance scripts in Docker containers:

```bash
# Create maintenance container
docker build -t songnodes-maintenance -f scripts/maintenance/Dockerfile .

# Run maintenance
docker run --rm -v $(pwd):/workspace songnodes-maintenance
```

## Monitoring and Alerting

### Email Notifications
Configure email alerts for maintenance issues:

```bash
# Install mail utilities
sudo apt-get install mailutils

# Add to crontab
0 9 * * 1 cd $PROJECT_ROOT && ./scripts/maintenance/health-check.sh | mail -s "Weekly Health Report" admin@yourdomain.com
```

### Slack/Discord Integration
Send notifications to team channels:

```bash
# Webhook notification example
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"SongNodes maintenance completed"}' \
  $SLACK_WEBHOOK_URL
```

### Monitoring Dashboard
Create a simple monitoring dashboard:

```bash
# Generate status page
./scripts/maintenance/health-check.sh --quick > status.html
```

## Best Practices

### Before Running Scripts
1. **Backup Important Data**: Scripts include backup mechanisms but ensure critical data is protected
2. **Test in Development**: Run scripts in development environment first
3. **Review Configurations**: Check environment-specific settings
4. **Monitor Resources**: Ensure adequate disk space and memory

### Regular Maintenance
1. **Review Reports**: Check generated reports weekly
2. **Monitor Health Scores**: Track health trends over time
3. **Update Scripts**: Keep maintenance scripts current
4. **Adjust Schedules**: Optimize timing based on usage patterns

### Troubleshooting
1. **Check Logs**: Review execution logs for errors
2. **Verify Permissions**: Ensure scripts have execute permissions
3. **Test Manually**: Run scripts manually to diagnose issues
4. **Monitor Resources**: Check system resources during execution

## Security Considerations

### Script Security
- Scripts run with minimal required permissions
- No hardcoded secrets or credentials
- Secure temporary file handling
- Input validation and sanitization

### Data Protection
- Automatic backup before destructive operations
- Configurable retention policies
- Secure log file permissions
- Sensitive data exclusion

### Access Control
- Restrict script execution to authorized users
- Use service accounts for automated execution
- Monitor script execution and access
- Regular security audits

## Configuration

### Environment Variables
Scripts support environment configuration:

```bash
# Maintenance configuration
export MAINTENANCE_LOG_RETENTION=30    # Days to keep logs
export MAINTENANCE_BACKUP_RETENTION=7  # Days to keep backups
export HEALTH_CHECK_TIMEOUT=30         # Seconds for service checks
```

### Customization
Scripts can be customized for specific environments:

1. **Modify file paths** for different project structures
2. **Adjust thresholds** for health checks and alerts
3. **Add custom checks** for environment-specific requirements
4. **Configure integrations** for monitoring and alerting

## Support

### Getting Help
1. **Check documentation** in this README
2. **Review script help**: `script.sh --help`
3. **Examine logs** for error details
4. **Test in isolation** to identify issues

### Contributing
1. **Follow script patterns** established in existing scripts
2. **Add comprehensive logging** and error handling
3. **Include help documentation** and examples
4. **Test thoroughly** before submitting

---

These maintenance scripts provide comprehensive automation for SongNodes project management, ensuring optimal performance, security, and reliability.