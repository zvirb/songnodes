# Rollback Procedures

## Quick Reference

| Scenario | Rollback Time | Complexity | Risk | Data Loss |
|----------|--------------|------------|------|-----------|
| Service failure | 5 minutes | Low | Low | None |
| Database migration issue | 15 minutes | Medium | Medium | Since migration |
| Complete system failure | 30 minutes | High | High | Potential |
| Configuration corruption | 2 minutes | Low | Low | None |
| Enrichment degradation | 10 minutes | Medium | Low | None |

## Rollback Decision Tree

### 1. Severity Assessment

**P0 - Critical (Immediate Rollback)**
- Complete system outage
- Data corruption in progress
- Security breach
- Database unavailable

**P1 - High (Rollback within 1 hour)**
- Service degradation >50%
- Multiple circuit breakers open
- DLQ overflow (>5000 messages)
- Migration failures

**P2 - Medium (Fix Forward Preferred)**
- Single service failure
- Configuration issues
- Performance degradation <50%

**P3 - Low (Always Fix Forward)**
- Minor bugs
- Non-critical alerts
- UI issues

### 2. Impact Assessment Checklist

Before rolling back, assess:
- [ ] Data loss potential (check last backup time)
- [ ] Service availability impact (how many users affected)
- [ ] Time to fix forward vs rollback
- [ ] Dependencies (what else will break)
- [ ] Team availability (can we manage the rollback)

### 3. Rollback Authorization

| Severity | Authorization Required |
|----------|------------------------|
| P0 | On-call engineer (immediate) |
| P1 | Engineering lead approval |
| P2 | Team consensus |
| P3 | No rollback (fix forward) |

## Rollback Procedures

### Scenario 1: New Service Failure (api-gateway-internal, dlq-manager)

**Symptoms:**
- Service won't start
- Continuous crash loops
- Health check failures
- High CPU/memory usage
- Dependency errors

**Pre-Rollback Checklist:**
- [ ] Verify service logs: `docker compose logs api-gateway-internal --tail=100`
- [ ] Check dependent services status
- [ ] Confirm backup availability
- [ ] Notify team in #incidents channel

**Rollback Steps:**

```bash
# 1. Stop the failed service
docker compose stop api-gateway-internal dlq-manager

# 2. Backup current configuration
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d-%H%M%S)

# 3. Remove or comment out service definitions
# Edit docker-compose.yml - comment out:
#   - api-gateway-internal service block
#   - dlq-manager service block

# 4. Update scrapers to fall back to direct enrichment
# The APIEnrichmentPipeline will automatically fall back
# to inline enrichment if METADATA_ENRICHMENT_URL is unreachable

# 5. Restart affected services
docker compose up -d scraper-mixesdb scraper-1001tracklists

# 6. Verify system health
./scripts/health_check.sh

# 7. Monitor for 15 minutes
watch -n 30 'docker compose ps && curl -s http://localhost:8082/health'
```

**Verification:**
```bash
# Check scraper logs for successful enrichment
docker compose logs scraper-mixesdb --tail=50 | grep -i "enrichment"

# Verify no errors
docker compose logs scraper-mixesdb --tail=100 | grep -i "error"
```

**Rollback Time:** ~5 minutes
**Data Loss:** None (enrichment continues via fallback)
**Risk:** Low

---

### Scenario 2: Database Migration Failure

**Symptoms:**
- Migration script errors
- Table corruption
- Foreign key constraint violations
- Data inconsistency
- Services can't connect to database

**Pre-Rollback Checklist:**
- [ ] Identify which migration failed
- [ ] Check database backup age: `ls -lth /backups/postgres/ | head -5`
- [ ] Verify backup integrity: `./scripts/validate_backup.sh`
- [ ] Estimate data loss window
- [ ] Get approval from engineering lead

**Rollback Steps:**

```bash
# 1. IMMEDIATE: Stop all services to prevent further corruption
docker compose down

# 2. Backup current state (even if corrupted - for forensics)
docker compose exec postgres pg_dump -U musicdb_user musicdb > \
  /backups/postgres/corrupted-state-$(date +%Y%m%d-%H%M%S).sql

# 3. Restore database from last known good backup
./scripts/restore_database.sh /backups/postgres/pre-migration-YYYY-MM-DD-HHMMSS.sql

# 4. Verify restoration
./scripts/validate_database.sh

# 5. Apply DOWN migrations in reverse order
cd /mnt/my_external_drive/programming/songnodes

# Apply medallion migrations in reverse
psql -h localhost -p 5433 -U musicdb_user -d musicdb \
  < sql/migrations/medallion/005_pipeline_replay_support_down.sql

psql -h localhost -p 5433 -U musicdb_user -d musicdb \
  < sql/migrations/medallion/004_waterfall_configuration_down.sql

psql -h localhost -p 5433 -U musicdb_user -d musicdb \
  < sql/migrations/medallion/003_api_coordination_metadata_down.sql

psql -h localhost -p 5433 -U musicdb_user -d musicdb \
  < sql/migrations/medallion/002_dead_letter_queue_down.sql

psql -h localhost -p 5433 -U musicdb_user -d musicdb \
  < sql/migrations/medallion/001_metadata_quality_framework_down.sql

# Apply enrichment metadata rollback
psql -h localhost -p 5433 -U musicdb_user -d musicdb \
  < sql/migrations/008_enrichment_metadata_fields_down.sql

# 6. Verify database schema
psql -h localhost -p 5433 -U musicdb_user -d musicdb -c "\dt" | grep -E "enrichment|medallion|dlq"

# 7. Restart services with old configuration
docker compose up -d

# 8. Verify all services healthy
./scripts/health_check.sh

# 9. Monitor for 30 minutes
watch -n 60 './scripts/health_check.sh && docker compose ps'
```

**Verification:**
```bash
# Check database integrity
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
-- Verify track count
SELECT COUNT(*) FROM tracks;

-- Verify no orphaned records
SELECT COUNT(*) FROM enrichment_audit WHERE track_id NOT IN (SELECT track_id FROM tracks);

-- Check for NULL required fields
SELECT COUNT(*) FROM tracks WHERE artist_name IS NULL OR track_name IS NULL;
EOF

# Verify services can connect
curl http://localhost:8082/health | jq
curl http://localhost:8084/health | jq
```

**Rollback Time:** ~15-30 minutes (depends on database size)
**Data Loss:** All data since backup (potentially 6 hours with default backup schedule)
**Risk:** Medium (data loss)

**Post-Rollback Actions:**
1. Schedule immediate backup: `./scripts/backup_database.sh`
2. File incident report
3. Schedule post-mortem
4. Review migration script for issues
5. Test migration in staging before retry

---

### Scenario 3: Enrichment Service Degradation

**Symptoms:**
- High error rates (>30%)
- Circuit breakers constantly OPEN
- DLQ filling rapidly (>100 messages/min)
- Enrichment timeouts
- Low cache hit rate

**Pre-Rollback Checklist:**
- [ ] Check circuit breaker states: `curl http://localhost:8020/health | jq '.api_clients'`
- [ ] Review DLQ stats: `curl http://localhost:8024/dlq/stats`
- [ ] Check external API status (Spotify, MusicBrainz)
- [ ] Verify not a temporary issue (wait 5 minutes)

**Rollback Steps:**

```bash
# 1. Assess severity
curl http://localhost:8020/stats | jq '.error_rate'
curl http://localhost:8024/dlq/stats | jq

# 2. If error rate > 50%, disable enrichment workers
docker compose stop metadata-enrichment-worker-1 metadata-enrichment-worker-2

# 3. Revert scrapers to inline enrichment (temporary)
# Create rollback version of pipeline
cat > /tmp/api_enrichment_rollback.py << 'EOF'
# Emergency rollback: Use simplified inline enrichment
class APIEnrichmentPipeline:
    def __init__(self):
        self.spotify_client = SpotifyClient()  # Fallback to direct calls

    async def process_item(self, item, spider):
        # Simplified inline enrichment
        try:
            spotify_data = await self.spotify_client.search_track(
                item['artist_name'],
                item['track_name']
            )
            if spotify_data:
                item['spotify_id'] = spotify_data['id']
                item['isrc'] = spotify_data.get('isrc')
        except Exception as e:
            spider.logger.warning(f"Enrichment failed: {e}")
        return item
EOF

# 4. Apply rollback (backup first)
cp scrapers/pipelines/api_enrichment_pipeline.py \
   scrapers/pipelines/api_enrichment_pipeline.py.backup

cp /tmp/api_enrichment_rollback.py \
   scrapers/pipelines/api_enrichment_pipeline.py

# 5. Rebuild and restart scrapers
docker compose build scraper-mixesdb scraper-1001tracklists
docker compose restart scraper-mixesdb scraper-1001tracklists

# 6. Monitor error rates
watch -n 30 'docker compose logs scraper-mixesdb --tail=50 | grep -c ERROR'

# 7. If stable after 15 minutes, proceed with investigation
# Keep monitoring for 1 hour before declaring stable
```

**Alternative: Disable Problematic Provider**

```bash
# If only one provider is failing, disable it temporarily
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
-- Disable Spotify if it's failing
UPDATE metadata_enrichment_config
SET enabled = false
WHERE priority_1_provider = 'spotify'
   OR priority_2_provider = 'spotify'
   OR priority_3_provider = 'spotify';
EOF

# Reload configuration
curl -X POST http://localhost:8020/admin/config/reload

# Verify
curl http://localhost:8020/admin/config | jq '.providers'
```

**Verification:**
```bash
# Check error rate improved
curl http://localhost:8020/stats | jq '.error_rate'

# Verify enrichment working
docker compose logs scraper-mixesdb --tail=100 | grep -i "spotify_id"

# Check DLQ not growing
watch -n 30 'curl -s http://localhost:8024/dlq/stats | jq .total_messages'
```

**Rollback Time:** ~10 minutes
**Data Loss:** None (enrichment continues with reduced functionality)
**Risk:** Low (degraded service, not outage)

---

### Scenario 4: Configuration Corruption

**Symptoms:**
- Wrong provider priorities
- Invalid waterfall configuration
- Enrichment producing incorrect data
- Configuration validation errors

**Pre-Rollback Checklist:**
- [ ] Backup current config: `./scripts/backup_config.sh`
- [ ] Identify what changed: `git log -p sql/migrations/medallion/004_waterfall_configuration_up.sql`
- [ ] Check config table: `psql -c "SELECT * FROM metadata_enrichment_config;"`

**Rollback Steps:**

```bash
# 1. Stop enrichment to prevent bad data
docker compose stop metadata-enrichment-worker-1 metadata-enrichment-worker-2

# 2. Backup corrupted configuration (for analysis)
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF > /tmp/corrupted_config.sql
COPY metadata_enrichment_config TO STDOUT WITH CSV HEADER;
EOF

# 3. Truncate and restore default configuration
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
-- Clear corrupted config
TRUNCATE TABLE metadata_enrichment_config CASCADE;

-- Restore defaults
INSERT INTO metadata_enrichment_config (
    enabled, batch_size, priority_1_provider, priority_2_provider,
    priority_3_provider, timeout_seconds, retry_attempts, cache_ttl_hours
) VALUES
    (true, 10, 'spotify', 'musicbrainz', 'lastfm', 30, 3, 168);

-- Verify
SELECT * FROM metadata_enrichment_config;
EOF

# 4. Force reload configuration in service
curl -X POST http://localhost:8020/admin/config/reload

# 5. Verify configuration
curl http://localhost:8020/admin/config | jq

# 6. Restart enrichment workers
docker compose start metadata-enrichment-worker-1 metadata-enrichment-worker-2

# 7. Test with single track
curl -X POST http://localhost:8020/enrich \
  -H "Content-Type: application/json" \
  -d '{
    "track_id": "test-123",
    "artist_name": "Deadmau5",
    "track_title": "Strobe"
  }' | jq
```

**Verification:**
```bash
# Verify waterfall order correct
curl http://localhost:8020/admin/config | jq '.providers'

# Expected output:
# {
#   "priority_1": "spotify",
#   "priority_2": "musicbrainz",
#   "priority_3": "lastfm"
# }

# Test enrichment produces correct data
docker compose logs metadata-enrichment-worker-1 --tail=50 | grep -i "enrichment completed"
```

**Rollback Time:** ~2 minutes
**Data Loss:** None
**Risk:** Very Low

---

### Scenario 5: Complete System Failure

**Symptoms:**
- All services down
- Database unreachable
- Network issues
- Docker daemon issues

**Pre-Rollback Checklist:**
- [ ] Verify Docker daemon running: `systemctl status docker`
- [ ] Check disk space: `df -h`
- [ ] Check system resources: `free -h && top`
- [ ] Review system logs: `journalctl -xe`

**Rollback Steps:**

```bash
# 1. EMERGENCY STOP (if system unstable)
./scripts/emergency_stop.sh

# 2. Check system health
df -h  # Disk space
free -h  # Memory
docker ps -a  # Container status
docker volume ls  # Volumes intact?

# 3. If disk space issue, clean up
docker system prune -af --volumes  # DANGER: Only if desperate

# 4. Restore from known good state
cd /mnt/my_external_drive/programming/songnodes

# Reset to last known good commit
git stash  # Save any local changes
git log --oneline -10  # Find last good commit
# git reset --hard <commit-hash>  # Only if approved

# 5. Rebuild entire system
docker compose down -v  # DANGER: Removes volumes
docker compose build --no-cache
docker compose up -d

# 6. Restore database
./scripts/restore_database.sh /backups/postgres/latest.sql

# 7. Verify all services
./scripts/health_check.sh

# 8. Monitor system resources
watch -n 30 'docker stats --no-stream'
```

**Rollback Time:** ~30 minutes
**Data Loss:** Up to 6 hours (last backup)
**Risk:** High

---

## Emergency Contacts

### Primary Contacts
- **On-Call Engineer**: [Setup PagerDuty/OpsGenie]
- **Database Admin**: [Contact Info]
- **DevOps Lead**: [Contact Info]
- **Engineering Manager**: [Contact Info]

### Communication Channels
- **Incident Channel**: `#incidents` (Slack/Discord)
- **Status Page**: [Setup status page URL]
- **Escalation**: [PagerDuty/OpsGenie link]

---

## Post-Rollback Checklist

After any rollback, complete this checklist:

### Immediate (Within 1 hour)
- [ ] All services report healthy status
- [ ] Database integrity verified (`./scripts/validate_database.sh`)
- [ ] Metrics normalized (check Grafana)
- [ ] Error rates below threshold (<5%)
- [ ] DLQ depth stable (<100 messages)
- [ ] Circuit breakers CLOSED
- [ ] Incident documented in `#incidents`

### Within 24 hours
- [ ] Post-mortem scheduled
- [ ] Incident report filed
- [ ] Stakeholders notified
- [ ] Monitoring alerts reviewed
- [ ] Backup schedule verified

### Within 1 week
- [ ] Post-mortem completed
- [ ] Action items assigned
- [ ] Documentation updated
- [ ] Runbook updated (if new scenario)
- [ ] Training conducted (if needed)

---

## Rollback Testing

Test rollback procedures in staging quarterly:

### Q1: Test service rollback
```bash
# Staging environment
docker compose stop api-gateway-internal
# Verify fallback works
# Restore service
```

### Q2: Test database rollback
```bash
# Staging environment
./scripts/restore_database.sh /backups/test-backup.sql
# Verify integrity
```

### Q3: Test configuration rollback
```bash
# Staging environment
# Corrupt config intentionally
# Execute rollback procedure
# Verify restoration
```

### Q4: Test complete system rollback
```bash
# Staging environment
docker compose down -v
# Full restore from backups
# Verify all services
```

---

## Rollback Automation

### Automated Rollback Script

Location: `/mnt/my_external_drive/programming/songnodes/scripts/rollback_deployment.sh`

Usage:
```bash
# Service rollback
./scripts/rollback_deployment.sh --service api-gateway-internal

# Database rollback
./scripts/rollback_deployment.sh --database --backup /backups/postgres/latest.sql

# Full system rollback
./scripts/rollback_deployment.sh --full --confirm
```

### Automated Health Checks

Location: `/mnt/my_external_drive/programming/songnodes/scripts/health_check.sh`

Run after every rollback:
```bash
./scripts/health_check.sh --full --verbose
```

---

## Version History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-10 | 1.0 | Initial rollback procedures | System |

---

## Related Documentation

- [Emergency Response Playbook](EMERGENCY_RESPONSE.md)
- [Disaster Recovery Plan](DISASTER_RECOVERY.md)
- [Operations Runbooks](RUNBOOKS.md)
- [Incident Templates](INCIDENT_TEMPLATES.md)
