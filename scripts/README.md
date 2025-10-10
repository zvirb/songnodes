# SongNodes Deployment Scripts

This directory contains automated deployment scripts for the SongNodes enrichment infrastructure upgrades.

## Overview

The deployment automation provides:

- **Zero-downtime deployment** with health verification at each step
- **Automatic rollback** on failure
- **Database migration** with backup and restore
- **Service health checks** with wait mode
- **Smoke tests** for end-to-end validation
- **CI/CD integration** with structured logging and notifications

## Scripts

### Main Deployment

#### `deploy_enrichment_upgrades.sh`
**Primary deployment orchestration script**

Executes complete deployment pipeline:
1. Pre-deployment validation
2. Database migration with backup
3. Service image building
4. New service deployment
5. Existing service updates
6. Health verification
7. Smoke tests
8. Monitoring setup

**Usage:**
```bash
./scripts/deploy_enrichment_upgrades.sh [OPTIONS]

Options:
  --dry-run         Show what would be done without executing
  --skip-tests      Skip smoke tests (not recommended)
  --skip-backup     Skip database backup (not recommended)
  --no-rollback     Don't rollback on failure
```

**Examples:**
```bash
# Dry run to preview deployment
./scripts/deploy_enrichment_upgrades.sh --dry-run

# Full production deployment
./scripts/deploy_enrichment_upgrades.sh

# Development deployment (skip tests)
./scripts/deploy_enrichment_upgrades.sh --skip-tests
```

**Exit codes:**
- `0` - Deployment succeeded
- `1` - Deployment failed
- `2` - Rollback failed (critical)

---

### Environment Validation

#### `validate_environment.sh`
**Pre-deployment environment validation**

Checks:
- Docker and Docker Compose versions
- Required environment variables
- Database, Redis, RabbitMQ connectivity
- Available disk space and memory
- Migration files present
- Docker Compose configuration valid

**Usage:**
```bash
./scripts/validate_environment.sh
```

**Exit codes:**
- `0` - All checks passed
- `1` - One or more checks failed

---

### Database Migration

#### `migrate_database.sh`
**Safe database migration with backup and rollback**

Features:
- Automatic backup before migration
- Transaction-based migration execution
- Rollback on failure
- Migration verification
- Progress tracking

**Usage:**
```bash
./scripts/migrate_database.sh [OPTIONS]

Options:
  --dry-run    Show what would be done
  --rollback   Rollback the last migration batch
```

**Examples:**
```bash
# Preview migrations
./scripts/migrate_database.sh --dry-run

# Apply migrations
./scripts/migrate_database.sh

# Rollback last migration batch
./scripts/migrate_database.sh --rollback
```

**What it migrates:**
1. Medallion Architecture (Bronze/Silver/Gold layers)
2. Waterfall API configuration tables
3. Pipeline replay support
4. Additional enrichment metadata fields

**Backup location:** `backups/database/pre_enrichment_migration_YYYYMMDD_HHMMSS.sql.gz`

---

### Health Checks

#### `comprehensive_health_check.sh`
**Comprehensive service health verification**

Checks:
- Infrastructure services (PostgreSQL, Redis, RabbitMQ)
- Enrichment services (metadata-enrichment, api-gateway, dlq-manager)
- Monitoring services (Prometheus, Grafana)
- Circuit breaker states
- DLQ message counts

**Usage:**
```bash
./scripts/comprehensive_health_check.sh [OPTIONS]

Options:
  --service <name>    Check specific service only
  --timeout <seconds> Override default timeout (default: 30)
  --wait              Wait for services to become healthy
```

**Examples:**
```bash
# Quick health check
./scripts/comprehensive_health_check.sh

# Wait for services to be healthy (deployment)
./scripts/comprehensive_health_check.sh --wait --timeout 60

# Check specific service
./scripts/comprehensive_health_check.sh --service api-gateway-internal
```

**Services checked:**
- `postgres` - PostgreSQL database
- `redis` - Redis cache
- `rabbitmq` - RabbitMQ message broker
- `metadata-enrichment` - Metadata enrichment service
- `api-gateway-internal` - API Integration Gateway
- `dlq-manager` - Dead-Letter Queue Manager
- `prometheus` - Metrics collection (optional)
- `grafana` - Metrics visualization (optional)

---

### Smoke Tests

#### `smoke_tests.sh`
**End-to-end smoke test suite**

Tests:
- API Gateway health and search endpoints
- Circuit breaker states
- Metadata enrichment configuration and enrich endpoint
- DLQ Manager health and statistics
- Medallion architecture tables (Bronze/Silver/Gold)
- Waterfall configuration seeding

**Usage:**
```bash
./scripts/smoke_tests.sh [OPTIONS]

Options:
  --verbose    Show detailed test output
```

**Examples:**
```bash
# Run smoke tests
./scripts/smoke_tests.sh

# Verbose mode
./scripts/smoke_tests.sh --verbose
```

**Test categories:**
- API Gateway Tests (3 tests)
- Metadata Enrichment Tests (3 tests)
- DLQ Manager Tests (2 tests)
- Database Tests (2 tests)

---

### Rollback

#### `rollback_deployment.sh`
**Safe rollback of enrichment upgrades**

Rolls back:
- Database migrations (to previous batch or backup)
- Service versions (to previous Docker images)
- Configuration changes

**Usage:**
```bash
./scripts/rollback_deployment.sh [OPTIONS]

Options:
  --db-only         Rollback database only
  --services-only   Rollback services only
  --to-backup <file> Restore specific database backup
```

**Examples:**
```bash
# Full rollback
./scripts/rollback_deployment.sh

# Database only
./scripts/rollback_deployment.sh --db-only

# Restore specific backup
./scripts/rollback_deployment.sh --to-backup backups/database/backup_20251010.sql.gz
```

**What it does:**
1. Confirms rollback with user
2. Stops new services (api-gateway, dlq-manager)
3. Reverts metadata-enrichment to previous version
4. Rolls back database migrations or restores backup
5. Verifies services healthy after rollback

---

### CI/CD Integration

#### `ci_deploy.sh`
**CI/CD-friendly deployment with notifications and metrics**

Features:
- Structured JSON logging for CI/CD parsers
- Slack/Discord notifications
- Prometheus push gateway support
- Artifact collection
- Exit codes for CI/CD systems

**Usage:**
```bash
./scripts/ci_deploy.sh [OPTIONS]

Options:
  --environment <env>  Deployment environment (dev/staging/production)
  --notify             Enable notifications
```

**Environment variables:**
```bash
CI_ENVIRONMENT=staging        # Target environment
SLACK_WEBHOOK_URL=...         # Slack webhook
DISCORD_WEBHOOK_URL=...       # Discord webhook
PROMETHEUS_PUSHGATEWAY=...    # Metrics push gateway
```

**Examples:**
```bash
# Local CI test
CI_ENVIRONMENT=staging ./scripts/ci_deploy.sh

# Production deployment with notifications
CI_ENVIRONMENT=production \
SLACK_WEBHOOK_URL=$SLACK_WEBHOOK \
./scripts/ci_deploy.sh --notify
```

**GitHub Actions integration:**
```yaml
- name: Deploy Enrichment Infrastructure
  run: ./scripts/ci_deploy.sh --environment production --notify
  env:
    CI_ENVIRONMENT: production
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
    DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK }}
```

---

## Quick Start

### First-time deployment:

```bash
# 1. Validate environment
./scripts/validate_environment.sh

# 2. Preview deployment (dry run)
./scripts/deploy_enrichment_upgrades.sh --dry-run

# 3. Execute deployment
./scripts/deploy_enrichment_upgrades.sh
```

### Updating deployment:

```bash
# Deploy with automatic rollback
./scripts/deploy_enrichment_upgrades.sh
```

### Emergency rollback:

```bash
# Full rollback
./scripts/rollback_deployment.sh

# Or database-only rollback
./scripts/rollback_deployment.sh --db-only
```

---

## Deployment Flow

```
validate_environment.sh
        ↓
deploy_enrichment_upgrades.sh
        ↓
migrate_database.sh (with backup)
        ↓
docker compose build
        ↓
docker compose up -d (new services)
        ↓
docker compose up -d --force-recreate (existing services)
        ↓
comprehensive_health_check.sh --wait
        ↓
smoke_tests.sh
        ↓
[SUCCESS] or [ROLLBACK]
```

---

## Troubleshooting

### Script won't run

**Issue:** Permission denied
```bash
# Fix permissions
chmod +x scripts/*.sh
```

### Environment validation fails

**Issue:** Missing .env file
```bash
# Copy template and configure
cp .env.example .env
# Edit .env with your credentials
```

### Migration fails

**Issue:** Database not accessible
```bash
# Check PostgreSQL is running
docker compose ps postgres

# Check connectivity
docker exec postgres pg_isready -U musicdb_user
```

### Health check fails

**Issue:** Services not ready
```bash
# Wait for services with timeout
./scripts/comprehensive_health_check.sh --wait --timeout 120

# Check specific service logs
docker compose logs api-gateway-internal
```

### Smoke tests fail

**Issue:** Specific test failing
```bash
# Run with verbose output
./scripts/smoke_tests.sh --verbose

# Manual test
curl http://localhost:8020/health
curl http://localhost:8022/health
curl http://localhost:8021/health
```

---

## Best Practices

1. **Always run dry-run first**
   ```bash
   ./scripts/deploy_enrichment_upgrades.sh --dry-run
   ```

2. **Never skip backups in production**
   ```bash
   # DON'T do this in production:
   ./scripts/deploy_enrichment_upgrades.sh --skip-backup
   ```

3. **Always verify health before smoke tests**
   ```bash
   ./scripts/comprehensive_health_check.sh --wait
   ./scripts/smoke_tests.sh
   ```

4. **Monitor logs during deployment**
   ```bash
   # In separate terminal:
   docker compose logs -f api-gateway-internal dlq-manager metadata-enrichment
   ```

5. **Keep rollback plan ready**
   - Know the rollback command
   - Have backup file location ready
   - Test rollback in staging first

---

## Script Dependencies

All scripts are standalone bash scripts with these dependencies:

- **bash** >= 4.0
- **docker** >= 20.10
- **docker-compose** >= 1.29
- **curl** (for health checks and smoke tests)
- **jq** (for JSON parsing)
- **gzip** (for backup compression)

---

## Exit Codes

All scripts follow standard exit code conventions:

- `0` - Success
- `1` - General failure
- `2` - Critical failure (e.g., rollback failed)

---

## Logging

All scripts provide colored output:

- 🟢 **Green [✓]** - Success/info
- 🟡 **Yellow [⚠]** - Warning
- 🔴 **Red [✗]** - Error/failure
- 🔵 **Blue [▶]** - Step/action

CI/CD script (`ci_deploy.sh`) provides structured JSON logging for machine parsing.

---

## Support

For issues or questions:

1. Check the [Deployment Playbook](../docs/DEPLOYMENT_PLAYBOOK.md)
2. Review script output and logs
3. Check [Troubleshooting Guide](../docs/DEPLOYMENT_PLAYBOOK.md#troubleshooting-guide)
4. Contact deployment team (see Emergency Contacts in playbook)

---

**Last Updated:** 2025-10-10
**Version:** 1.0.0
