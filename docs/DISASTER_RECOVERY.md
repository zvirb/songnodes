# Disaster Recovery Plan

## Overview

This document outlines the disaster recovery (DR) strategy for SongNodes, including backup procedures, recovery objectives, and step-by-step recovery processes for various disaster scenarios.

---

## Recovery Objectives

### RTO (Recovery Time Objective)

Maximum acceptable time to restore service after a disaster:

| Component | RTO | Justification |
|-----------|-----|---------------|
| Database (PostgreSQL) | 4 hours | Critical data, requires validation |
| Core Services (REST API, Graph API) | 1 hour | Rebuild from Git |
| Enrichment Services | 2 hours | Includes queue restoration |
| Frontend | 30 minutes | Static build, fast deployment |
| Complete System | 6 hours | Worst case, all components |

### RPO (Recovery Point Objective)

Maximum acceptable data loss:

| Data Type | RPO | Backup Frequency |
|-----------|-----|------------------|
| Track Data | 6 hours | Database backup every 6 hours |
| Enrichment Metadata | 6 hours | Database backup every 6 hours |
| Configuration | 0 (no loss) | Git version control |
| Logs | 24 hours | Best effort |
| Cache (Redis) | Acceptable loss | Not backed up (rebuilt on demand) |
| Queue Messages (RabbitMQ) | 1 hour | Included in DB backup (DLQ) |

---

## Backup Strategy

### 1. Database Backups (PostgreSQL)

**Frequency:** Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
**Retention:** 30 days
**Location:** `/backups/postgres/`
**Method:** `pg_dump` with compression

**Automated Backup Script:** `/mnt/my_external_drive/programming/songnodes/scripts/backup_database.sh`

```bash
#!/bin/bash
# Database backup script - runs via cron

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/postgres"
BACKUP_FILE="$BACKUP_DIR/musicdb_backup_$TIMESTAMP.sql.gz"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Perform backup
docker compose exec -T postgres pg_dump -U musicdb_user musicdb | gzip > "$BACKUP_FILE"

# Verify backup integrity
if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
    echo "✅ Backup successful: $BACKUP_FILE"

    # Calculate backup size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup size: $SIZE"

    # Log to monitoring
    echo "$(date): Backup successful - $BACKUP_FILE ($SIZE)" >> "$BACKUP_DIR/backup.log"
else
    echo "❌ Backup verification failed: $BACKUP_FILE"
    exit 1
fi

# Clean up old backups (keep 30 days)
find "$BACKUP_DIR" -name "musicdb_backup_*.sql.gz" -mtime +30 -delete

# Keep latest 48 backups regardless of age (safety net)
ls -t "$BACKUP_DIR"/musicdb_backup_*.sql.gz | tail -n +49 | xargs -r rm

echo "Backup cleanup complete"
```

**Cron Configuration:**
```bash
# Edit crontab
crontab -e

# Add this line to run every 6 hours
0 */6 * * * /mnt/my_external_drive/programming/songnodes/scripts/backup_database.sh
```

**Manual Backup:**
```bash
# Create immediate backup
./scripts/backup_database.sh

# Create backup with custom name
docker compose exec -T postgres pg_dump -U musicdb_user musicdb | \
  gzip > /backups/postgres/pre-migration-$(date +%Y%m%d-%H%M%S).sql.gz
```

---

### 2. Configuration Backups

**Frequency:** On every change (Git commits)
**Retention:** Infinite (Git history)
**Location:** Git repository

**What's Backed Up:**
- All code (services, scrapers, frontend)
- Docker configurations (`docker-compose.yml`)
- SQL migrations
- Environment templates (`.env.example`)
- Documentation

**NOT Backed Up (Secrets):**
- `.env` file (contains passwords)
- SSL certificates
- API keys

**Backup Process:**
```bash
# Commit changes
git add .
git commit -m "feat: configuration update"
git push origin main

# Tag important configurations
git tag -a v1.5.0 -m "Production deployment 2025-10-10"
git push origin v1.5.0
```

---

### 3. Secrets Backup

**Frequency:** After any secret changes
**Retention:** Encrypted, offline storage
**Location:** Secure vault (1Password, Bitwarden, etc.)

**What to Backup:**
- `.env` file (encrypted)
- API keys (Spotify, MusicBrainz, etc.)
- SSL certificates
- Database passwords
- Service account credentials

**Backup Process:**
```bash
# Encrypt .env file
gpg --encrypt --recipient admin@songnodes.com .env
mv .env.gpg /secure/backup/location/

# Or use password manager CLI
op create document .env --title "SongNodes Production .env" --vault Production
```

---

### 4. Volume Backups (Docker Volumes)

**Frequency:** Weekly
**Retention:** 4 weeks
**Location:** `/backups/volumes/`

**Volumes to Backup:**
- `musicdb_postgres_data` (covered by pg_dump, this is redundant backup)
- `redis_data` (optional - can be rebuilt)
- Logs (if retention needed)

**Backup Script:**
```bash
#!/bin/bash
# Volume backup script

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/backups/volumes"

mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL data volume
docker run --rm \
  -v musicdb_postgres_data:/source:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/postgres_volume_$TIMESTAMP.tar.gz" -C /source .

echo "✅ PostgreSQL volume backed up: postgres_volume_$TIMESTAMP.tar.gz"

# Clean up old volume backups (keep 4 weeks)
find "$BACKUP_DIR" -name "postgres_volume_*.tar.gz" -mtime +28 -delete
```

---

## Disaster Scenarios & Recovery Procedures

### Scenario 1: Complete Database Loss

**Cause:** Disk failure, corruption, accidental deletion
**RTO:** 4 hours
**RPO:** 6 hours (last backup)

**Recovery Steps:**

```bash
# STEP 1: Stop all services (0-5 min)
cd /mnt/my_external_drive/programming/songnodes
docker compose down

# STEP 2: Verify latest backup (5-10 min)
ls -lth /backups/postgres/ | head -5

# Identify latest backup
LATEST_BACKUP=$(ls -t /backups/postgres/musicdb_backup_*.sql.gz | head -1)
echo "Latest backup: $LATEST_BACKUP"

# Verify backup integrity
gunzip -t "$LATEST_BACKUP"
if [ $? -eq 0 ]; then
    echo "✅ Backup is valid"
else
    echo "❌ Backup corrupted, trying previous backup"
    LATEST_BACKUP=$(ls -t /backups/postgres/musicdb_backup_*.sql.gz | head -2 | tail -1)
fi

# STEP 3: Provision new database (10-20 min)
# If using same Docker container:
docker compose up -d postgres

# Wait for PostgreSQL to be ready
until docker compose exec postgres pg_isready -U musicdb_user; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

# STEP 4: Restore database (20-60 min, depends on size)
echo "Restoring database from $LATEST_BACKUP..."

gunzip -c "$LATEST_BACKUP" | docker compose exec -T postgres psql -U musicdb_user -d musicdb

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully"
else
    echo "❌ Restore failed, check logs"
    docker compose logs postgres
    exit 1
fi

# STEP 5: Verify database integrity (60-90 min)
./scripts/validate_database.sh

# Check critical tables
docker compose exec postgres psql -U musicdb_user -d musicdb << EOF
-- Verify table counts
SELECT 'tracks' AS table_name, COUNT(*) FROM tracks
UNION ALL
SELECT 'artists', COUNT(*) FROM artists
UNION ALL
SELECT 'enrichment_audit', COUNT(*) FROM enrichment_audit;

-- Check for orphaned records
SELECT COUNT(*) FROM enrichment_audit WHERE track_id NOT IN (SELECT track_id FROM tracks);

-- Verify schema version
SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 5;
EOF

# STEP 6: Restore dependent services (90-120 min)
docker compose up -d redis rabbitmq

# Wait for services ready
sleep 30

docker compose up -d rest-api graph-api websocket-api

# Wait and verify
sleep 30
curl http://localhost:8082/health
curl http://localhost:8084/health

# STEP 7: Restore enrichment stack (120-150 min)
docker compose up -d metadata-enrichment api-gateway-internal dlq-manager

# Verify
sleep 30
curl http://localhost:8020/health
curl http://localhost:8022/health

# STEP 8: Gradually restore scrapers (150-180 min)
docker compose up -d scraper-mixesdb
sleep 60
docker compose logs scraper-mixesdb --tail=50

# If stable, continue
docker compose up -d scraper-1001tracklists scraper-ra

# STEP 9: Comprehensive health check (180-210 min)
./scripts/health_check.sh --full --verbose

# STEP 10: Verify data integrity (210-240 min)
# Run sample queries
curl http://localhost:8082/api/tracks?limit=10
curl http://localhost:8084/api/graph/artist/deadmau5

# Check enrichment working
docker compose logs metadata-enrichment --tail=100 | grep "enrichment completed"

# STEP 11: Document recovery
echo "Database recovery completed at $(date)" >> /var/log/songnodes/disaster_recovery.log
```

**Post-Recovery Checklist:**
- [ ] All services healthy
- [ ] Database integrity verified
- [ ] No orphaned records
- [ ] Enrichment operational
- [ ] Scrapers running
- [ ] Metrics normal
- [ ] Data loss quantified (time window)
- [ ] Stakeholders notified
- [ ] Post-mortem scheduled

**Estimated Total Time:** 4 hours

---

### Scenario 2: Complete Infrastructure Loss

**Cause:** Server failure, data center outage, hardware destruction
**RTO:** 6 hours
**RPO:** 6 hours

**Recovery Steps:**

```bash
# STEP 1: Provision new infrastructure (0-60 min)
# - New server/VM
# - Install Docker and Docker Compose
# - Configure network, firewall

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# STEP 2: Clone repository (60-70 min)
git clone https://github.com/your-org/songnodes.git /mnt/my_external_drive/programming/songnodes
cd /mnt/my_external_drive/programming/songnodes

# Checkout production tag/commit
git checkout v1.5.0  # Or specific commit

# STEP 3: Restore secrets (70-90 min)
# Retrieve from secure vault
# If using password manager CLI:
op get document "SongNodes Production .env" > .env

# Or decrypt backup
gpg --decrypt /secure/backup/.env.gpg > .env

# Verify secrets
./scripts/validate_secrets.sh

# STEP 4: Restore database backup (90-120 min)
# Transfer backup to new server
scp backup-server:/backups/postgres/latest.sql.gz /backups/postgres/

# Start database
docker compose up -d postgres

# Wait for ready
until docker compose exec postgres pg_isready -U musicdb_user; do
    sleep 2
done

# Restore
gunzip -c /backups/postgres/latest.sql.gz | \
  docker compose exec -T postgres psql -U musicdb_user -d musicdb

# STEP 5: Build and start services (120-240 min)
# Build all images
docker compose build

# Start services in order
docker compose up -d postgres redis rabbitmq
sleep 60

docker compose up -d rest-api graph-api websocket-api
sleep 60

docker compose up -d metadata-enrichment api-gateway-internal dlq-manager
sleep 60

docker compose up -d scraper-mixesdb scraper-1001tracklists

# STEP 6: Verify and test (240-300 min)
./scripts/health_check.sh --full --verbose

# Test critical paths
curl http://localhost:8082/health
curl http://localhost:8084/api/graph/artist/test

# STEP 7: Monitor for 1 hour (300-360 min)
watch -n 60 './scripts/health_check.sh && docker compose ps'
```

**Estimated Total Time:** 6 hours

---

### Scenario 3: Partial Service Corruption

**Cause:** Bad deployment, configuration error, software bug
**RTO:** 1 hour
**RPO:** 0 (no data loss)

**Recovery Steps:**

```bash
# STEP 1: Identify corrupted service (0-10 min)
docker compose ps
docker compose logs --tail=100 | grep -i "error\|fatal"

# STEP 2: Stop corrupted service (10-15 min)
docker compose stop [corrupted-service]

# STEP 3: Rebuild from Git (15-30 min)
git status
git log -10 --oneline

# If recent bad commit, revert
git revert HEAD
# Or reset to known good commit
git reset --hard <commit-hash>

# Rebuild service
docker compose build [service-name]

# STEP 4: Restart and verify (30-60 min)
docker compose up -d [service-name]

# Monitor
docker compose logs [service-name] -f

# Verify
curl http://localhost:[port]/health
```

**Estimated Total Time:** 1 hour

---

### Scenario 4: Ransomware / Data Corruption

**Cause:** Malware, malicious actor, software bug
**RTO:** 8 hours
**RPO:** 6 hours

**Recovery Steps:**

```bash
# STEP 1: IMMEDIATE ISOLATION (0-5 min)
# Disconnect from network
sudo iptables -A INPUT -j DROP
sudo iptables -A OUTPUT -j DROP

# Stop all services
docker compose down

# STEP 2: Forensics (5-60 min)
# Capture current state for investigation
tar czf /tmp/compromised-system-$(date +%Y%m%d).tar.gz \
  /var/lib/docker \
  /mnt/my_external_drive/programming/songnodes \
  /var/log

# Move to secure location for analysis
# DO NOT restore from this

# STEP 3: Provision clean infrastructure (60-120 min)
# Use new server/VM
# Follow Scenario 2 (Complete Infrastructure Loss)

# STEP 4: Restore from backup BEFORE incident (120-180 min)
# Identify last known good backup (before corruption)
# Restore using Scenario 1 procedure

# STEP 5: Security hardening (180-300 min)
# - Update all passwords
# - Rotate API keys
# - Review access logs
# - Implement additional security measures

# STEP 6: Gradual restoration (300-480 min)
# Restore services one by one
# Monitor for any signs of reinfection
```

**Estimated Total Time:** 8 hours

---

## Backup Validation

### Monthly Backup Test

Perform a test restoration monthly to verify backup integrity:

```bash
# Create test environment
docker compose -f docker-compose.test.yml up -d postgres-test

# Restore latest backup
LATEST_BACKUP=$(ls -t /backups/postgres/musicdb_backup_*.sql.gz | head -1)
gunzip -c "$LATEST_BACKUP" | \
  docker compose -f docker-compose.test.yml exec -T postgres-test \
  psql -U musicdb_user -d musicdb_test

# Verify data
docker compose -f docker-compose.test.yml exec postgres-test \
  psql -U musicdb_user -d musicdb_test -c "SELECT COUNT(*) FROM tracks;"

# Cleanup
docker compose -f docker-compose.test.yml down -v
```

---

## Backup Monitoring

### Automated Monitoring

```bash
# Check backup age (alert if > 8 hours old)
LATEST_BACKUP=$(ls -t /backups/postgres/musicdb_backup_*.sql.gz | head -1)
BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))

if [ $BACKUP_AGE_HOURS -gt 8 ]; then
    echo "⚠️ ALERT: Latest backup is $BACKUP_AGE_HOURS hours old"
    # Send alert
fi

# Check backup size (alert if significantly different from average)
BACKUP_SIZE=$(stat -c %s "$LATEST_BACKUP")
AVG_SIZE=$(ls -l /backups/postgres/musicdb_backup_*.sql.gz | awk '{sum+=$5; count++} END {print sum/count}')

SIZE_DIFF_PERCENT=$(( (BACKUP_SIZE - AVG_SIZE) * 100 / AVG_SIZE ))

if [ $SIZE_DIFF_PERCENT -gt 50 ] || [ $SIZE_DIFF_PERCENT -lt -50 ]; then
    echo "⚠️ ALERT: Backup size anomaly: ${SIZE_DIFF_PERCENT}% difference from average"
fi
```

### Prometheus Metrics

Add to monitoring:
```yaml
# backup_metrics.yml
backup_age_hours: [value]
backup_size_bytes: [value]
backup_success: [0/1]
last_backup_timestamp: [unix timestamp]
```

---

## DR Testing Schedule

| Frequency | Test Scenario | Duration |
|-----------|---------------|----------|
| Monthly | Database restore to test environment | 1 hour |
| Quarterly | Full system restore in staging | 4 hours |
| Semi-annually | Complete infrastructure rebuild | 1 day |
| Annually | Full DR drill (simulated disaster) | 2 days |

---

## Emergency Contacts

### Primary Contacts
- **Database Administrator**: [Contact]
- **Infrastructure Lead**: [Contact]
- **Security Lead**: [Contact]
- **Engineering Manager**: [Contact]

### Vendor Support
- **Cloud Provider**: [Support number]
- **Database Hosting**: [Support number]
- **Backup Service**: [Support number]

---

## Related Documentation

- [Rollback Procedures](ROLLBACK_PROCEDURES.md)
- [Emergency Response Playbook](EMERGENCY_RESPONSE.md)
- [Operations Runbooks](RUNBOOKS.md)
- [Backup Scripts](/mnt/my_external_drive/programming/songnodes/scripts/backup_database.sh)

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-10 | 1.0 | Initial disaster recovery plan | System |
