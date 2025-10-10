# SongNodes Enrichment Infrastructure - Deployment Playbook

## Overview

This playbook provides comprehensive guidance for deploying the SongNodes enrichment infrastructure upgrades, including:

- **Medallion Architecture** (Bronze/Silver/Gold data layers)
- **API Integration Gateway** (unified API access with circuit breakers)
- **Dead-Letter Queue Manager** (failure handling and retry system)
- **Configuration-driven Waterfall Enrichment** (dynamic API source management)
- **Enhanced Observability** (Prometheus, Grafana, distributed tracing)

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Steps](#deployment-steps)
3. [Verification Procedures](#verification-procedures)
4. [Rollback Procedures](#rollback-procedures)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Emergency Contacts](#emergency-contacts)

---

## Pre-Deployment Checklist

### Team Preparation

- [ ] Schedule maintenance window (recommended: 2-4 hours)
- [ ] Notify stakeholders of deployment
- [ ] Ensure deployment team availability
- [ ] Review rollback plan with team
- [ ] Confirm emergency contact list

### Environment Validation

Run the environment validation script:

```bash
cd /mnt/my_external_drive/programming/songnodes
./scripts/validate_environment.sh
```

**Required checks:**
- [ ] Docker >= 20.10
- [ ] Docker Compose >= 1.29
- [ ] .env file configured with all required variables
- [ ] At least 10GB free disk space
- [ ] At least 8GB available memory
- [ ] PostgreSQL, Redis, RabbitMQ accessible

### Backup Verification

- [ ] Verify backup directory exists: `backups/database/`
- [ ] Confirm sufficient space for database backup
- [ ] Test database backup/restore procedure (optional but recommended)

### Code Review

- [ ] All changes merged to deployment branch
- [ ] No uncommitted changes in working directory
- [ ] Migration files reviewed and approved
- [ ] Docker Compose files validated

---

## Deployment Steps

### Step 1: Pre-Deployment Validation

**Execute:**
```bash
./scripts/validate_environment.sh
```

**Success criteria:**
- All validation checks pass
- No critical warnings

**On failure:**
- Review error messages
- Fix issues before proceeding
- Re-run validation

**Estimated time:** 2 minutes

---

### Step 2: Database Backup

**Execute:**
```bash
# Automatic backup (included in migration script)
# Or manual backup:
docker exec postgres pg_dump -U musicdb_user -d musicdb --clean --if-exists > backups/database/manual_backup_$(date +%Y%m%d_%H%M%S).sql
gzip backups/database/manual_backup_*.sql
```

**Success criteria:**
- Backup file created in `backups/database/`
- Backup file compressed and validated

**On failure:**
- Check disk space
- Verify PostgreSQL is running
- Verify database credentials

**Estimated time:** 1-5 minutes (depends on database size)

---

### Step 3: Database Migration

**Execute:**
```bash
./scripts/migrate_database.sh
```

**What it does:**
1. Creates automatic backup
2. Applies Medallion architecture migrations (Bronze/Silver/Gold layers)
3. Creates waterfall configuration tables
4. Adds pipeline replay support
5. Verifies all tables created successfully

**Success criteria:**
- All migrations applied successfully
- Verification checks pass
- No rollback triggered

**On failure:**
- Automatic rollback to backup
- Review migration logs
- Contact database administrator

**Estimated time:** 5-10 minutes

**Manual verification (optional):**
```bash
# Check migration status
docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 10;"

# Verify Bronze tables exist
docker exec postgres psql -U musicdb_user -d musicdb -c "\dt raw_*"

# Verify Silver tables exist
docker exec postgres psql -U musicdb_user -d musicdb -c "\dt enrichment_* api_* circuit_*"

# Verify Gold tables exist
docker exec postgres psql -U musicdb_user -d musicdb -c "\dt enriched_* *_metrics *_scores"
```

---

### Step 4: Build Service Images

**Execute:**
```bash
docker compose build api-gateway-internal dlq-manager metadata-enrichment
```

**Success criteria:**
- All images build without errors
- Image sizes reasonable (<500MB each)

**On failure:**
- Review Docker build logs
- Check Dockerfile syntax
- Verify base images accessible

**Estimated time:** 5-10 minutes

---

### Step 5: Deploy New Services

**Execute:**
```bash
# Start API Gateway
docker compose up -d api-gateway-internal

# Wait for service to be healthy
sleep 10

# Start DLQ Manager
docker compose up -d dlq-manager

# Wait for service to be healthy
sleep 10
```

**Success criteria:**
- Containers start successfully
- No immediate crashes
- Health endpoints responding

**Manual verification:**
```bash
# Check container status
docker compose ps api-gateway-internal dlq-manager

# Check logs for errors
docker compose logs api-gateway-internal
docker compose logs dlq-manager
```

**On failure:**
- Review container logs
- Check port conflicts
- Verify environment variables

**Estimated time:** 2-3 minutes

---

### Step 6: Update Existing Services

**Execute:**
```bash
# Restart metadata-enrichment with new configuration
docker compose up -d --force-recreate metadata-enrichment
```

**Success criteria:**
- Service restarts successfully
- Loads new waterfall configuration
- No errors in logs

**Manual verification:**
```bash
# Check service health
curl http://localhost:8020/health

# Verify configuration loaded
curl http://localhost:8020/admin/config | jq '.waterfall_sources'
```

**On failure:**
- Review service logs
- Check configuration files
- Verify database connectivity

**Estimated time:** 1-2 minutes

---

### Step 7: Health Verification

**Execute:**
```bash
./scripts/comprehensive_health_check.sh --wait --timeout 60
```

**Success criteria:**
- All infrastructure services healthy (PostgreSQL, Redis, RabbitMQ)
- All enrichment services healthy (metadata-enrichment, api-gateway, dlq-manager)
- No circuit breakers open
- No critical warnings

**On failure:**
- Review health check output
- Investigate unhealthy services
- Check service logs
- Consider rollback if critical services failing

**Estimated time:** 1-2 minutes

---

### Step 8: Smoke Tests

**Execute:**
```bash
./scripts/smoke_tests.sh --verbose
```

**What it tests:**
- API Gateway health and search endpoints
- Circuit breaker states
- Metadata enrichment health and configuration
- Enrich endpoint functionality
- DLQ Manager health and statistics
- Medallion architecture tables
- Waterfall configuration seeding

**Success criteria:**
- All smoke tests pass
- No critical failures

**On failure:**
- Review test output
- Check specific failing component
- Verify configuration
- Consider rollback if multiple tests failing

**Estimated time:** 2-3 minutes

---

### Step 9: Monitoring Verification

**Execute:**
```bash
# Check Prometheus targets
curl http://localhost:9091/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Verify Grafana dashboards accessible
curl -s http://localhost:3001/api/health | jq '.'
```

**Success criteria:**
- Prometheus scraping all targets
- Grafana healthy and accessible
- Dashboards loading correctly

**On failure:**
- Check Prometheus configuration
- Verify service discovery
- Review Grafana logs

**Estimated time:** 1-2 minutes

---

### Step 10: Post-Deployment Monitoring

**Monitor for 30-60 minutes:**

1. **Service Logs:**
   ```bash
   docker compose logs -f api-gateway-internal dlq-manager metadata-enrichment
   ```

2. **Metrics:**
   - Open Grafana: http://localhost:3001
   - Check API Gateway dashboard
   - Check DLQ Monitoring dashboard
   - Monitor error rates and latencies

3. **Database:**
   ```bash
   # Check Bronze layer ingestion
   docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM raw_track_enrichment_requests;"

   # Check Silver layer processing
   docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM enrichment_requests;"

   # Check Gold layer output
   docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM enriched_tracks;"
   ```

4. **Circuit Breakers:**
   ```bash
   curl http://localhost:8022/health | jq '.api_clients'
   ```

**Success criteria:**
- No errors in logs
- Metrics within expected ranges
- Data flowing through Medallion layers
- Circuit breakers closed

**Estimated time:** 30-60 minutes

---

## Verification Procedures

### Complete Verification Checklist

- [ ] All services running (`docker compose ps`)
- [ ] All health checks passing
- [ ] Smoke tests passing
- [ ] Database migrations applied
- [ ] Medallion tables exist and populated
- [ ] Waterfall configuration loaded
- [ ] API Gateway responding
- [ ] DLQ Manager operational
- [ ] Circuit breakers closed
- [ ] Prometheus scraping targets
- [ ] Grafana dashboards accessible
- [ ] No errors in service logs
- [ ] Enrichment pipeline working end-to-end

### End-to-End Test

**Manual E2E test:**

1. Submit enrichment request:
   ```bash
   curl -X POST http://localhost:8020/enrich \
     -H "Content-Type: application/json" \
     -d '{
       "track_id": "test-e2e-001",
       "artist_name": "Deadmau5",
       "track_title": "Strobe"
     }'
   ```

2. Verify response contains enrichment data
3. Check Bronze layer ingestion:
   ```bash
   docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT * FROM raw_track_enrichment_requests WHERE track_id = 'test-e2e-001';"
   ```

4. Check Silver layer processing:
   ```bash
   docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT * FROM enrichment_requests WHERE track_id = 'test-e2e-001';"
   ```

5. Check Gold layer results:
   ```bash
   docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT * FROM enriched_tracks WHERE track_id = 'test-e2e-001';"
   ```

---

## Rollback Procedures

### Automatic Rollback

The deployment script includes automatic rollback on failure. If deployment fails, rollback is triggered automatically.

### Manual Rollback

**Execute:**
```bash
./scripts/rollback_deployment.sh
```

**Options:**
- `--db-only` - Rollback database only
- `--services-only` - Rollback services only
- `--to-backup <file>` - Restore specific backup

**What it does:**
1. Stops new services (api-gateway-internal, dlq-manager)
2. Reverts metadata-enrichment to previous version
3. Rolls back database migrations
4. Restores from backup if specified

**Verification after rollback:**
```bash
# Verify services running
docker compose ps

# Verify database state
docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"

# Run health checks
./scripts/comprehensive_health_check.sh
```

### Rollback Decision Matrix

| Scenario | Rollback Required? | Rollback Type |
|:---------|:-------------------|:--------------|
| Migration fails | Automatic | Database |
| Service build fails | No | Fix and retry |
| Service deployment fails | Yes | Services only |
| Health checks fail | Yes | Full |
| Smoke tests fail | Evaluate | Depends on severity |
| Performance degradation | Evaluate | Consider partial |
| Data corruption | Yes | Full + restore backup |

---

## Troubleshooting Guide

### Issue: Migration fails

**Symptoms:**
- Migration script exits with error
- Rollback triggered

**Diagnosis:**
```bash
# Check PostgreSQL logs
docker compose logs postgres

# Check migration status
docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT * FROM schema_migrations WHERE success = false;"
```

**Resolution:**
1. Review migration SQL files for syntax errors
2. Check database permissions
3. Verify no conflicting schema changes
4. Restore from backup and retry

---

### Issue: Service won't start

**Symptoms:**
- Container immediately exits
- Container stuck in restart loop

**Diagnosis:**
```bash
# Check container status
docker compose ps [service-name]

# Check logs
docker compose logs [service-name]

# Check for port conflicts
netstat -tulpn | grep [port]
```

**Resolution:**
1. Review environment variables
2. Check port availability
3. Verify dependencies (database, redis) are running
4. Check file permissions
5. Review Dockerfile and entrypoint script

---

### Issue: Health checks failing

**Symptoms:**
- Health check script reports unhealthy services
- Services running but not responding

**Diagnosis:**
```bash
# Manual health check
curl http://localhost:8020/health
curl http://localhost:8022/health
curl http://localhost:8021/health

# Check connectivity
docker exec api-gateway-internal ping -c 3 postgres
docker exec api-gateway-internal ping -c 3 redis
```

**Resolution:**
1. Verify network connectivity between services
2. Check service logs for errors
3. Verify database migrations applied
4. Check configuration files loaded
5. Restart individual services

---

### Issue: Circuit breakers open

**Symptoms:**
- Circuit breakers in open state
- Enrichment failing

**Diagnosis:**
```bash
# Check circuit breaker status
curl http://localhost:8022/health | jq '.api_clients'

# Check API responses
curl http://localhost:8022/api/spotify/search -X POST -d '{"artist_name":"Test","track_title":"Test"}'
```

**Resolution:**
1. Verify external API credentials configured
2. Check rate limits not exceeded
3. Wait for circuit breaker auto-reset (30s-5min)
4. Manual reset if needed (restart api-gateway-internal)
5. Check API client logs for root cause

---

### Issue: Smoke tests failing

**Symptoms:**
- One or more smoke tests fail
- Functionality not working as expected

**Diagnosis:**
```bash
# Run smoke tests with verbose output
./scripts/smoke_tests.sh --verbose

# Check specific failing component
curl http://localhost:8020/admin/config
docker exec postgres psql -U musicdb_user -d musicdb -c "\dt"
```

**Resolution:**
1. Review test output for specific failure
2. Check component logs
3. Verify configuration loaded
4. Check database state
5. Re-run specific test after fix

---

### Issue: Performance degradation

**Symptoms:**
- Slow response times
- High memory/CPU usage
- Database connection pool exhausted

**Diagnosis:**
```bash
# Check resource usage
docker stats

# Check database connections
docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis memory
docker exec redis redis-cli info memory

# Check RabbitMQ queues
docker exec rabbitmq rabbitmqctl list_queues
```

**Resolution:**
1. Scale service replicas if needed
2. Clear Redis cache if bloated
3. Optimize database queries
4. Check for memory leaks
5. Consider horizontal scaling

---

## Emergency Contacts

### Deployment Team

- **Deployment Lead:** [Name] - [Contact]
- **Database Administrator:** [Name] - [Contact]
- **DevOps Engineer:** [Name] - [Contact]
- **Backend Lead:** [Name] - [Contact]

### Escalation Path

1. **Level 1:** Deployment team handles issue
2. **Level 2:** Escalate to tech lead if unresolved in 30 minutes
3. **Level 3:** Escalate to CTO if system-wide impact

### Communication Channels

- **Slack:** #songnodes-deployments
- **Discord:** #deployment-alerts
- **Email:** deployments@songnodes.com
- **Phone:** [Emergency hotline]

---

## Post-Deployment Checklist

- [ ] All verification steps completed
- [ ] Monitoring enabled and functioning
- [ ] Team notified of successful deployment
- [ ] Maintenance window closed
- [ ] Documentation updated
- [ ] Lessons learned documented
- [ ] Rollback plan updated if needed
- [ ] Performance baseline established
- [ ] Alerts configured and tested

---

## Automated Deployment (One Command)

For automated deployment with all checks:

```bash
./scripts/deploy_enrichment_upgrades.sh
```

**Options:**
- `--dry-run` - Preview deployment without executing
- `--skip-tests` - Skip smoke tests (not recommended)
- `--skip-backup` - Skip database backup (not recommended)
- `--no-rollback` - Disable automatic rollback

**Example:**
```bash
# Dry run first
./scripts/deploy_enrichment_upgrades.sh --dry-run

# Full deployment
./scripts/deploy_enrichment_upgrades.sh
```

---

## CI/CD Integration

For automated CI/CD deployments:

```bash
./scripts/ci_deploy.sh --environment staging --notify
```

**Environment variables:**
- `CI_ENVIRONMENT` - Target environment (dev/staging/production)
- `SLACK_WEBHOOK_URL` - Slack notifications
- `DISCORD_WEBHOOK_URL` - Discord notifications
- `PROMETHEUS_PUSHGATEWAY` - Metrics push gateway

**GitHub Actions Example:**
```yaml
- name: Deploy Enrichment Infrastructure
  run: ./scripts/ci_deploy.sh --environment production --notify
  env:
    CI_ENVIRONMENT: production
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Maintenance Window Template

### Pre-Maintenance (T-24 hours)

- [ ] Notify users of maintenance window
- [ ] Post status page update
- [ ] Verify deployment team availability
- [ ] Review deployment checklist

### During Maintenance (T=0)

- [ ] Mark maintenance start on status page
- [ ] Execute deployment steps
- [ ] Monitor progress
- [ ] Document any issues

### Post-Maintenance (T+1 hour)

- [ ] Mark maintenance complete on status page
- [ ] Notify users of completion
- [ ] Monitor for issues
- [ ] Update documentation

---

## Success Criteria

Deployment is considered successful when:

1. ✅ All services healthy
2. ✅ All smoke tests passing
3. ✅ Medallion architecture operational
4. ✅ Data flowing through Bronze → Silver → Gold layers
5. ✅ API Gateway responding correctly
6. ✅ DLQ Manager processing failures
7. ✅ Circuit breakers closed
8. ✅ Monitoring and alerting active
9. ✅ No errors in logs for 30 minutes
10. ✅ End-to-end test successful

---

## Appendix: Quick Reference Commands

```bash
# Environment validation
./scripts/validate_environment.sh

# Database migration
./scripts/migrate_database.sh

# Health check
./scripts/comprehensive_health_check.sh --wait

# Smoke tests
./scripts/smoke_tests.sh

# Full deployment
./scripts/deploy_enrichment_upgrades.sh

# Rollback
./scripts/rollback_deployment.sh

# Check service logs
docker compose logs -f [service-name]

# Check database migrations
docker exec postgres psql -U musicdb_user -d musicdb -c "SELECT * FROM schema_migrations;"

# Check Medallion tables
docker exec postgres psql -U musicdb_user -d musicdb -c "\dt raw_* enrichment_* enriched_*"

# Check circuit breakers
curl http://localhost:8022/health | jq '.api_clients'

# Check DLQ stats
curl http://localhost:8021/dlq/stats | jq '.'
```

---

**Last Updated:** 2025-10-10
**Version:** 1.0.0
**Maintained by:** SongNodes Deployment Team
