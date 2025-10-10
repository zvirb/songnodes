# Emergency Response Playbook

## Incident Severity Levels

### P0 - Critical (30min response time)
**Definition:** Complete system unavailability or imminent data loss

**Criteria:**
- Complete system outage (all services down)
- Active data corruption in progress
- Security breach or unauthorized access
- Database completely unavailable
- Critical data loss (>1000 tracks)

**Response SLA:**
- Initial response: 15 minutes
- Stakeholder notification: 30 minutes
- Mitigation started: 30 minutes
- Updates: Every 15 minutes

**Authorization:** On-call engineer (immediate action)

---

### P1 - High (2hr response time)
**Definition:** Significant service degradation affecting users

**Criteria:**
- Major service degradation (>50% error rate)
- Multiple circuit breakers open
- DLQ overflow (>5000 messages)
- Database migration failures
- Performance degradation (>5x normal latency)

**Response SLA:**
- Initial response: 1 hour
- Stakeholder notification: 2 hours
- Mitigation started: 2 hours
- Updates: Every 30 minutes

**Authorization:** Engineering lead approval required

---

### P2 - Medium (24hr response time)
**Definition:** Single service failure or moderate degradation

**Criteria:**
- Single service failure (others operational)
- Elevated error rates (10-50%)
- Performance degradation (2-5x normal)
- Configuration issues
- Non-critical feature broken

**Response SLA:**
- Initial response: 4 hours
- Investigation started: 8 hours
- Updates: Daily

**Authorization:** Team consensus

---

### P3 - Low (48hr response time)
**Definition:** Minor issues with minimal user impact

**Criteria:**
- Minor bugs
- Non-critical alerts
- UI/UX issues
- Documentation errors
- Monitoring false positives

**Response SLA:**
- Response: Next business day
- Fix: Within sprint

**Authorization:** Standard development workflow

---

## Emergency Response Workflows

### P0: Complete System Outage

#### Phase 1: Immediate Actions (0-5 minutes)

```bash
# 1. DECLARE INCIDENT
# Post in Slack/Discord #incidents channel:
```

**Incident Declaration Template:**
```
🚨 P0 INCIDENT DECLARED

Service: ALL SYSTEMS
Issue: Complete system outage
Impact: All users unable to access system
Status: Investigating
Incident Lead: @oncall-engineer
War Room: #incident-YYYYMMDD-HHMM

Updates every 15 minutes in thread 👇
```

```bash
# 2. PAGE ON-CALL TEAM
# Use PagerDuty/OpsGenie or call directly

# 3. ENABLE MAINTENANCE MODE
curl -X POST http://localhost:8082/admin/maintenance/enable

# 4. STOP BLEEDING - Disable all scrapers
docker compose stop scraper-mixesdb scraper-1001tracklists scraper-ra

# 5. SNAPSHOT CURRENT STATE
docker compose ps > /tmp/incident-state-$(date +%Y%m%d-%H%M%S).log
docker compose logs --tail=1000 > /tmp/incident-logs-$(date +%Y%m%d-%H%M%S).log
```

#### Phase 2: Assessment (5-15 minutes)

```bash
# 1. CHECK SERVICE HEALTH
./scripts/health_check.sh --full

# 2. CHECK CRITICAL SERVICES
docker compose ps | grep -E "postgres|redis|rabbitmq|rest-api"

# 3. REVIEW RECENT LOGS (last 1000 lines)
docker compose logs --tail=1000 | grep -i "error\|critical\|fatal"

# 4. CHECK METRICS IN GRAFANA
# Open: http://localhost:3001
# Dashboard: System Overview
# Look for: CPU spikes, memory exhaustion, network issues

# 5. CHECK DISK SPACE
df -h
docker system df

# 6. CHECK DOCKER DAEMON
systemctl status docker

# 7. IDENTIFY ROOT CAUSE
# Common causes:
# - Disk space exhaustion
# - Memory exhaustion
# - Database connection pool exhausted
# - Network issues
# - Recent deployment issues
```

**Root Cause Decision Tree:**

```
Disk Full (df -h shows >95%)
  → ACTION: Emergency cleanup (see Phase 3a)

Memory Exhausted (free -h shows <100MB available)
  → ACTION: Kill memory-heavy services (see Phase 3b)

Database Down (postgres not responding)
  → ACTION: Database recovery (see Phase 3c)

Recent Deployment (<2 hours ago)
  → ACTION: Rollback deployment (see Phase 3d)

Unknown
  → ACTION: Full system restart (see Phase 3e)
```

#### Phase 3: Mitigation (15-30 minutes)

**3a. Disk Space Emergency Cleanup**

```bash
# WARNING: This deletes data. Get approval first.

# 1. Check what's consuming space
du -sh /var/lib/docker/* | sort -h | tail -10

# 2. Clean Docker (removes stopped containers, unused images)
docker system prune -f

# 3. Clean logs (keep last 100MB per service)
truncate -s 100M /var/lib/docker/containers/*/*-json.log

# 4. Remove old backups (keep last 7 days)
find /backups/postgres -name "*.sql" -mtime +7 -delete

# 5. Verify space recovered
df -h

# 6. Restart services
docker compose up -d

# 7. Monitor disk space
watch -n 30 'df -h | grep -E "/$|/var"'
```

**3b. Memory Exhaustion Recovery**

```bash
# 1. Identify memory hog
docker stats --no-stream | sort -k4 -h | tail -5

# 2. Restart heavy services one at a time
docker compose restart rest-api
sleep 30
docker compose restart metadata-enrichment

# 3. If still critical, reduce worker count
# Edit docker-compose.enrichment-workers.yml
# Change: replicas: 2 → replicas: 1

docker compose -f docker-compose.yml \
  -f docker-compose.enrichment-workers.yml up -d

# 4. Monitor memory
watch -n 30 'free -h'
```

**3c. Database Recovery**

```bash
# 1. Check if database is running
docker compose ps postgres

# 2. Check database logs
docker compose logs postgres --tail=200 | grep -i "error\|fatal"

# 3. If corrupted, restore from backup
./scripts/rollback_deployment.sh --database \
  --backup /backups/postgres/latest.sql

# 4. If locked, force restart
docker compose restart postgres

# 5. Wait for database ready
until docker compose exec postgres pg_isready -U musicdb_user; do
  echo "Waiting for database..."
  sleep 2
done

# 6. Verify database integrity
./scripts/validate_database.sh

# 7. Restart dependent services
docker compose restart rest-api graph-api metadata-enrichment
```

**3d. Rollback Recent Deployment**

```bash
# Execute rollback procedure
./scripts/rollback_deployment.sh --full --confirm

# Monitor recovery
./scripts/health_check.sh --watch
```

**3e. Full System Restart (Nuclear Option)**

```bash
# WARNING: Last resort. Get approval from engineering lead.

# 1. Emergency stop
./scripts/emergency_stop.sh

# 2. Clear Docker state (keeps volumes)
docker compose down

# 3. Restart from scratch
docker compose up -d

# 4. Monitor startup
watch -n 10 'docker compose ps && ./scripts/health_check.sh'
```

#### Phase 4: Communication (Ongoing)

**Update Template (Every 15 minutes):**

```
⏱️ UPDATE - T+15 minutes

Current Status: Investigating disk space exhaustion
Actions Taken:
- Stopped all scrapers
- Cleaned Docker cache (recovered 15GB)
- Restarted core services

Current State:
- Database: ✅ Healthy
- REST API: ✅ Healthy
- Scrapers: ⏸️ Paused

Next Steps:
- Monitor disk space for 15 minutes
- Re-enable scrapers gradually
- Implement automated cleanup

ETA to Resolution: 30 minutes
```

#### Phase 5: Recovery (30-60 minutes)

```bash
# 1. GRADUAL SERVICE RESTORATION

# Start with monitoring stack
docker compose start prometheus grafana

# Wait 2 minutes, verify
sleep 120
curl http://localhost:9091/-/ready
curl http://localhost:3001/api/health

# Start database-dependent services
docker compose start rest-api graph-api

# Wait 2 minutes, verify
sleep 120
curl http://localhost:8082/health
curl http://localhost:8084/health

# Start enrichment stack
docker compose start metadata-enrichment api-gateway-internal dlq-manager

# Wait 2 minutes, verify
sleep 120
curl http://localhost:8020/health
curl http://localhost:8022/health

# Finally, start scrapers (one at a time)
docker compose start scraper-mixesdb
sleep 60
docker compose logs scraper-mixesdb --tail=50

docker compose start scraper-1001tracklists
sleep 60
docker compose logs scraper-1001tracklists --tail=50

# 2. COMPREHENSIVE HEALTH CHECK
./scripts/health_check.sh --full --verbose

# 3. VERIFY DATA INTEGRITY
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
-- Check for data corruption
SELECT COUNT(*) FROM tracks;
SELECT COUNT(*) FROM enrichment_audit;
SELECT COUNT(*) FROM dead_letter_queue;
EOF

# 4. MONITOR FOR STABILITY (30 minutes)
watch -n 60 './scripts/health_check.sh && docker compose ps'

# 5. ALL-CLEAR SIGNAL (after 30 minutes of stability)
# Post in #incidents:
```

**All-Clear Template:**

```
✅ RESOLVED - P0 Incident

Total Duration: 45 minutes
Root Cause: Disk space exhaustion due to unrotated logs
Fix Applied: Emergency cleanup + log rotation implemented

Verification:
- All services healthy ✅
- Database integrity verified ✅
- No data loss ✅
- Monitoring stable for 30 minutes ✅

Post-Mortem: Scheduled for 2025-10-11 10:00 AM

Action Items:
- [ ] Implement automated log rotation (Owner: DevOps, Due: 2025-10-12)
- [ ] Add disk space alerting (Owner: SRE, Due: 2025-10-12)
- [ ] Document cleanup procedures (Owner: Eng, Due: 2025-10-15)
```

---

### P1: DLQ Overflow

**Symptoms:**
- DLQ depth > 1000 messages
- Alert: `DLQDepthCritical` firing
- Enrichment failures increasing rapidly
- Disk space consumed by DLQ

**Response Workflow:**

```bash
# PHASE 1: ASSESS (0-10 min)

# 1. Check DLQ statistics
curl http://localhost:8024/dlq/stats | jq

# Example output:
# {
#   "total_messages": 2500,
#   "oldest_message_age_minutes": 120,
#   "error_rate_per_minute": 25,
#   "estimated_time_to_fill": "2 hours"
# }

# 2. Group errors by type
curl http://localhost:8024/dlq/errors/grouped | jq

# Example output:
# {
#   "circuit_breaker_open": 1200,
#   "timeout": 800,
#   "invalid_data": 300,
#   "api_rate_limit": 200
# }

# 3. Identify top error
TOP_ERROR=$(curl -s http://localhost:8024/dlq/errors/grouped | jq -r 'to_entries | max_by(.value) | .key')
echo "Top error: $TOP_ERROR"

# PHASE 2: MITIGATE (10-30 min)

# If circuit breaker errors (most common)
if [[ "$TOP_ERROR" == "circuit_breaker_open" ]]; then
  # Check which circuit breakers are open
  curl http://localhost:8020/health | jq '.api_clients'

  # Wait for auto-recovery (recommended)
  echo "Circuit breakers auto-recover in 60 seconds. Waiting..."
  sleep 60

  # Check if recovered
  curl http://localhost:8020/health | jq '.api_clients'

  # If still open after 5 minutes, manual reset
  sleep 240
  STILL_OPEN=$(curl -s http://localhost:8020/health | jq '.api_clients | to_entries | map(select(.value.state == "OPEN")) | length')

  if [[ $STILL_OPEN -gt 0 ]]; then
    echo "Circuit breakers still open. Resetting..."
    curl -X POST http://localhost:8020/admin/circuit-breakers/reset-all
  fi
fi

# If timeout errors
if [[ "$TOP_ERROR" == "timeout" ]]; then
  # Temporarily increase timeout
  psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET timeout_seconds = 60
WHERE timeout_seconds < 60;
EOF

  # Reload config
  curl -X POST http://localhost:8020/admin/config/reload
fi

# If API rate limit errors
if [[ "$TOP_ERROR" == "api_rate_limit" ]]; then
  # Pause scrapers temporarily
  docker compose stop scraper-mixesdb scraper-1001tracklists

  echo "Scrapers paused for 15 minutes to allow API quotas to recover"
  sleep 900  # 15 minutes

  # Restart with reduced concurrency
  docker compose start scraper-mixesdb scraper-1001tracklists
fi

# If invalid data errors
if [[ "$TOP_ERROR" == "invalid_data" ]]; then
  # Sample failed messages
  curl http://localhost:8024/dlq/messages?limit=10 | jq '.[] | {track_id, error}'

  # Fix data validation and purge bad messages
  # (Manual investigation required)
  echo "Manual investigation required for invalid data"
fi

# PHASE 3: REPLAY (30-60 min)

# Once root cause fixed, replay DLQ
# Start with small batch
curl -X POST http://localhost:8024/dlq/replay/batch \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 10}'

# Monitor success rate
watch -n 30 'curl -s http://localhost:8024/dlq/stats | jq .total_messages'

# If successful, increase batch size
curl -X POST http://localhost:8024/dlq/replay/batch \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 100}'

# Continue until DLQ empty
```

**Success Criteria:**
- DLQ depth < 100 messages
- No new messages entering DLQ
- Circuit breakers CLOSED
- Error rate < 5%

---

### P1: Circuit Breaker Storm

**Symptoms:**
- Multiple circuit breakers OPEN simultaneously
- Alert: `CircuitBreakerOpen` firing for multiple providers
- Enrichment success rate < 50%
- No enrichment data being acquired

**Response Workflow:**

```bash
# PHASE 1: ASSESS (0-5 min)

# 1. Check all circuit breaker states
curl http://localhost:8020/health | jq '.api_clients'

# Example output:
# {
#   "spotify": {"state": "OPEN", "failure_count": 50, "last_failure": "2025-10-10T..."},
#   "musicbrainz": {"state": "HALF_OPEN", "failure_count": 25, "last_failure": "..."},
#   "lastfm": {"state": "CLOSED", "failure_count": 0, "last_failure": null}
# }

# 2. Check Grafana for API health
# Dashboard: API Gateway Dashboard
# Panel: External API Response Times

# 3. Check if external APIs are down
curl -I https://api.spotify.com/v1/search
curl -I https://musicbrainz.org/ws/2/
curl -I https://ws.audioscrobbler.com/2.0/

# PHASE 2: DECIDE (5-10 min)

# Decision tree:
# - All providers OPEN → Wait for auto-recovery (Option A)
# - Spotify OPEN, others OK → Disable Spotify temporarily (Option B)
# - All providers timeout → Network issue (Option C)

# OPTION A: Wait for auto-recovery (RECOMMENDED)
echo "Circuit breakers will auto-recover in 60 seconds after failures stop"
echo "Waiting for 5 minutes..."

for i in {1..5}; do
  sleep 60
  echo "Check $i/5:"
  curl -s http://localhost:8020/health | jq '.api_clients | to_entries | map({key: .key, state: .value.state})'
done

# If recovered, you're done!

# OPTION B: Disable problematic provider
OPEN_PROVIDERS=$(curl -s http://localhost:8020/health | jq -r '.api_clients | to_entries | map(select(.value.state == "OPEN")) | .[].key')

echo "Open circuit breakers: $OPEN_PROVIDERS"

for provider in $OPEN_PROVIDERS; do
  psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET enabled = false
WHERE priority_1_provider = '$provider'
   OR priority_2_provider = '$provider'
   OR priority_3_provider = '$provider';
EOF
done

# Reload configuration
curl -X POST http://localhost:8020/admin/config/reload

# Verify
curl http://localhost:8020/admin/config | jq '.providers'

# OPTION C: Network issue investigation
# Check container networking
docker network inspect songnodes_default

# Check DNS resolution
docker compose exec api-gateway-internal nslookup api.spotify.com

# Check firewall rules
sudo iptables -L -n | grep -E "spotify|musicbrainz"

# PHASE 3: MANUAL RESET (if necessary)

# Only if circuit breakers don't auto-recover after 5 minutes
curl -X POST http://localhost:8020/admin/circuit-breakers/reset-all

# Or reset individual breaker
curl -X POST http://localhost:8020/admin/circuit-breakers/spotify/reset

# PHASE 4: MONITOR RECOVERY

watch -n 30 'curl -s http://localhost:8020/health | jq ".api_clients"'

# Check enrichment success rate recovering
watch -n 30 'curl -s http://localhost:8020/stats | jq ".success_rate"'
```

**Success Criteria:**
- All circuit breakers CLOSED or HALF_OPEN
- Enrichment success rate > 70%
- DLQ not growing
- API response times normal

---

### P2: Low Enrichment Success Rate

**Symptoms:**
- Success rate 50-70% (below optimal)
- Alert: `EnrichmentSuccessRateLow` firing
- Partial enrichment data
- Increased cache misses

**Response Workflow:**

```bash
# PHASE 1: INVESTIGATE (0-15 min)

# 1. Check current success rate
curl http://localhost:8020/stats | jq

# 2. Break down by provider
curl http://localhost:8020/stats/by-provider | jq

# 3. Check cache hit rate
curl http://localhost:8020/stats | jq '.cache_hit_rate'

# 4. Sample failed enrichments
curl http://localhost:8024/dlq/messages?limit=10 | jq

# PHASE 2: TUNE (15-30 min)

# If cache hit rate is low (<50%), warm cache
curl -X POST http://localhost:8020/admin/cache/warm

# If specific provider failing, adjust priorities
# Example: If MusicBrainz is slow, deprioritize it
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET priority_2_provider = 'lastfm',
    priority_3_provider = 'musicbrainz';
EOF

curl -X POST http://localhost:8020/admin/config/reload

# If timeouts are common, increase timeout
psql -h localhost -p 5433 -U musicdb_user -d musicdb << EOF
UPDATE metadata_enrichment_config
SET timeout_seconds = 45
WHERE timeout_seconds < 45;
EOF

curl -X POST http://localhost:8020/admin/config/reload

# PHASE 3: MONITOR (30-60 min)

# Watch success rate improve
watch -n 60 'curl -s http://localhost:8020/stats | jq ".success_rate"'

# If not improving after 30 minutes, escalate to P1
```

---

## Incident Communication

### Slack/Discord Templates

**Incident Declaration:**
```
🚨 INCIDENT DECLARED - P{0/1/2}

Service: [Service Name]
Issue: [Brief description]
Impact: [User impact - specific numbers if available]
Status: Investigating
Incident Lead: @engineer
War Room: #incident-YYYYMMDD-HHMM

Updates every {15/30/60} minutes in thread 👇
```

**Status Update:**
```
⏱️ UPDATE - T+{X} minutes

Current Status: [Investigating/Mitigating/Monitoring/Resolved]

Actions Taken:
- [Action 1 with result]
- [Action 2 with result]

Current State:
- Service A: {✅/⚠️/❌} [Details]
- Service B: {✅/⚠️/❌} [Details]

Next Steps:
- [Next step 1 - Owner - ETA]
- [Next step 2 - Owner - ETA]

ETA to Resolution: [Time estimate or "Unknown - investigating"]
```

**Resolution:**
```
✅ RESOLVED - Total Duration: {X} minutes/hours

Root Cause: [Brief explanation]
Fix Applied: [What was done]
Verification:
- [Verification check 1] ✅
- [Verification check 2] ✅

Data Loss: {None/Minimal/Significant - details}
Affected Users: {number/percentage}

Post-Mortem: Scheduled for [Date/Time]
Document: [Link when available]
```

---

## Post-Incident Checklist

### Immediately After Resolution
- [ ] All services reporting healthy
- [ ] Metrics normalized (check Grafana)
- [ ] Error rates below threshold
- [ ] DLQ depth stable
- [ ] Incident timeline documented
- [ ] Stakeholders notified of resolution

### Within 24 Hours
- [ ] Post-mortem scheduled
- [ ] Incident report drafted
- [ ] Data loss quantified (if any)
- [ ] Monitoring gaps identified
- [ ] Temporary fixes documented

### Within 1 Week
- [ ] Post-mortem completed
- [ ] Action items assigned with owners and deadlines
- [ ] Runbook updated (if new scenario)
- [ ] Alerts tuned (if false positive or missed alert)
- [ ] Documentation updated
- [ ] Team training conducted (if needed)

---

## Emergency Scripts

### Health Check
```bash
./scripts/health_check.sh --full --verbose
```

### Emergency Stop
```bash
./scripts/emergency_stop.sh
```

### Database Restore
```bash
./scripts/restore_database.sh /backups/postgres/latest.sql
```

### Full Rollback
```bash
./scripts/rollback_deployment.sh --full --confirm
```

---

## Related Documentation

- [Rollback Procedures](ROLLBACK_PROCEDURES.md)
- [Disaster Recovery Plan](DISASTER_RECOVERY.md)
- [Operations Runbooks](RUNBOOKS.md)
- [Incident Templates](INCIDENT_TEMPLATES.md)
- [Monitoring & Observability Guide](monitoring-observability-guide.md)
