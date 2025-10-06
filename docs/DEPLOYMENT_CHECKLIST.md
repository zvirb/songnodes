# Silent Failure Detection - Deployment Checklist

**Date:** 2025-10-06
**Version:** 2.0 - Complete Silent Failure Prevention
**Status:** Ready for Deployment

---

## 📋 Pre-Deployment Checklist

### 1. Database Migration (CRITICAL - Do First)
- [ ] **Backup database** before running migration
  ```bash
  docker exec -it postgres pg_dump -U musicdb_user musicdb > backup_$(date +%Y%m%d).sql
  ```

- [ ] **Run migration script**
  ```bash
  docker exec -i postgres psql -U musicdb_user -d musicdb < sql/migrations/002_add_playlist_validation.sql
  ```

- [ ] **Verify migration succeeded**
  ```bash
  docker exec -it postgres psql -U musicdb_user -d musicdb -c "
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'playlists'
    AND column_name IN ('tracklist_count', 'scrape_error', 'last_scrape_attempt', 'parsing_version');
  "
  ```
  Should return 4 rows.

- [ ] **Test constraint**
  ```bash
  # This should FAIL with constraint violation
  docker exec -it postgres psql -U musicdb_user -d musicdb -c "
    INSERT INTO playlists (name, source, tracklist_count)
    VALUES ('test', 'test', 0);
  "
  ```

### 2. Code Deployment
- [ ] **Pull latest code** on production servers
  ```bash
  git pull origin main
  ```

- [ ] **Verify files updated:**
  - `scrapers/pipelines/persistence_pipeline.py` - validation logic
  - `scrapers/spiders/1001tracklists_spider.py` - 0-track detection
  - `scrapers/spiders/mixesdb_spider.py` - parsing version update
  - `monitoring/prometheus/alerts.yml` - alert rules

- [ ] **Install Prometheus client** (if not already installed)
  ```bash
  pip install prometheus-client
  ```

- [ ] **Rebuild scraper containers**
  ```bash
  docker compose build scraper-orchestrator
  docker compose up -d scraper-orchestrator
  ```

### 3. Monitoring Setup
- [ ] **Update Prometheus configuration**
  ```bash
  # Copy alert rules to Prometheus
  cp monitoring/prometheus/alerts.yml /path/to/prometheus/alerts/

  # Reload Prometheus
  curl -X POST http://localhost:9091/-/reload
  ```

- [ ] **Verify alerts loaded**
  ```bash
  curl http://localhost:9091/api/v1/rules | jq '.data.groups[].name'
  ```
  Should show: `scraping_silent_failures`, `scraping_errors`, etc.

- [ ] **Configure Alertmanager** (if not already done)
  - Add Slack webhook for #engineering-alerts
  - Add PagerDuty for critical alerts
  - Test notification delivery

### 4. Grafana Dashboard
- [ ] **Import dashboard JSON**
  - Location: `monitoring/grafana/dashboards/scraping-health.json`
  - Go to Grafana → Dashboards → Import

- [ ] **Verify queries work:**
  - Silent failure rate
  - Parser version performance
  - Scraping success rate by source

### 5. Testing & Verification
- [ ] **Run verification script**
  ```bash
  python scripts/verify_silent_failure_fixes.py
  ```
  All tests should pass (5/5).

- [ ] **Manual test: Trigger a scrape**
  ```bash
  # MixesDB
  curl -X POST http://localhost:8080/api/scrape/mixesdb \
    -H "Content-Type: application/json" \
    -d '{"url": "https://www.mixesdb.com/db/index.php/2024-10-06_-_Test_DJ_@_Test_Venue"}'

  # Check logs for validation messages
  docker logs scraper-orchestrator -f | grep "SILENT FAILURE"
  ```

- [ ] **Verify metrics in Prometheus**
  ```
  # Should show data
  playlists_created_total
  silent_scraping_failures_total
  tracks_extracted_total
  ```

### 6. Backfill Failed Scrapes (MixesDB Incident)
- [ ] **Generate backfill list**
  ```bash
  docker exec -it postgres psql -U musicdb_user -d musicdb -c "
    COPY (
      SELECT source_url
      FROM playlists
      WHERE source = 'mixesdb'
      AND (tracklist_count = 0 OR tracklist_count IS NULL)
      AND created_at >= '2025-10-02'
      AND created_at <= '2025-10-06'
    ) TO STDOUT
  " > scripts/mixesdb_failed_urls.csv
  ```

- [ ] **Run backfill script**
  ```bash
  python scripts/requeue_mixesdb_urls.py --file scripts/mixesdb_failed_urls.csv --delay 90
  ```
  Estimated time: 1,137 URLs × 90s = ~28 hours

- [ ] **Monitor backfill progress**
  ```sql
  -- Check how many are being re-scraped successfully
  SELECT
    DATE(last_scrape_attempt) as date,
    COUNT(*) FILTER (WHERE tracklist_count > 0) as successful,
    COUNT(*) FILTER (WHERE tracklist_count = 0) as failed
  FROM playlists
  WHERE source = 'mixesdb'
    AND last_scrape_attempt >= NOW() - INTERVAL '24 hours'
  GROUP BY DATE(last_scrape_attempt);
  ```

---

## 🔍 Post-Deployment Verification

### Day 1 (Immediate)
- [ ] **Check for constraint violations in logs**
  ```bash
  docker logs scraper-orchestrator | grep "constraint violation"
  ```
  Should see some as pipeline catches issues.

- [ ] **Verify silent failure detection**
  ```bash
  docker logs scraper-orchestrator | grep "SILENT FAILURE DETECTED"
  ```
  Should be 0 (or very few) if scrapers are working correctly.

- [ ] **Check Prometheus metrics**
  ```promql
  # Should be 0 or very low
  rate(silent_scraping_failures_total[5m])

  # Should be > 0 (tracks are being extracted)
  rate(tracks_extracted_total[5m])
  ```

- [ ] **Run health query**
  ```sql
  SELECT * FROM get_scraping_health_summary(1);  -- Last 1 day
  ```
  Success rates should be > 90%.

### Week 1 (Ongoing)
- [ ] **Monday: Review v_scraping_health view**
  ```sql
  SELECT * FROM v_scraping_health
  WHERE scrape_date >= CURRENT_DATE - 7
  ORDER BY scrape_date DESC;
  ```

- [ ] **Wednesday: Check parser performance**
  ```sql
  SELECT * FROM v_parser_performance
  WHERE failure_rate_percent > 10
  ORDER BY failure_rate_percent DESC;
  ```

- [ ] **Friday: Verify alert firing** (if any issues occurred)
  - Check Slack #engineering-alerts channel
  - Review PagerDuty incidents
  - Confirm alerts were actionable

### Month 1 (Long-term)
- [ ] **Compare pre/post metrics**
  ```sql
  -- Before fix (Oct 2-6)
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN tracklist_count = 0 THEN 1 ELSE 0 END) as failures
  FROM playlists
  WHERE created_at BETWEEN '2025-10-02' AND '2025-10-06';

  -- After fix (current month)
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN tracklist_count = 0 THEN 1 ELSE 0 END) as failures
  FROM playlists
  WHERE created_at >= '2025-10-07';
  ```

- [ ] **Review false positive rate**
  - Any playlists incorrectly flagged as silent failures?
  - Adjust validation logic if needed

- [ ] **Document lessons learned**
  - Update runbook with any new findings
  - Add to incident postmortem

---

## 🚨 Rollback Plan (If Needed)

### If Database Migration Fails:
1. **Restore from backup**
   ```bash
   docker exec -i postgres psql -U musicdb_user -d musicdb < backup_YYYYMMDD.sql
   ```

2. **Verify restoration**
   ```bash
   docker exec -it postgres psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM playlists;"
   ```

### If Constraint Breaks Production:
1. **Temporarily disable constraint**
   ```sql
   ALTER TABLE playlists DROP CONSTRAINT IF EXISTS chk_tracklist_count_valid;
   ```

2. **Fix data issues**
   ```sql
   UPDATE playlists
   SET scrape_error = 'Legacy record - pre-validation'
   WHERE tracklist_count = 0 AND scrape_error IS NULL;
   ```

3. **Re-enable constraint**
   ```sql
   ALTER TABLE playlists ADD CONSTRAINT chk_tracklist_count_valid
   CHECK ((tracklist_count > 0) OR (scrape_error IS NOT NULL AND last_scrape_attempt IS NOT NULL));
   ```

### If Scrapers Fail:
1. **Revert code changes**
   ```bash
   git revert HEAD
   docker compose build scraper-orchestrator
   docker compose up -d scraper-orchestrator
   ```

2. **Check logs for root cause**
   ```bash
   docker logs scraper-orchestrator --tail 100
   ```

---

## 📊 Success Criteria

Deployment is successful when:

1. ✅ **All verification tests pass** (5/5 in `verify_silent_failure_fixes.py`)
2. ✅ **Zero undetected silent failures** in 48 hours
3. ✅ **Prometheus alerts fire correctly** for test failures
4. ✅ **Backfill completes** for 1,137 MixesDB URLs
5. ✅ **Success rate > 90%** for all scrapers
6. ✅ **No database constraint violations** in production logs

---

## 📞 Emergency Contacts

- **Database Issues:** @database-team (Slack: #db-oncall)
- **Scraper Issues:** @backend-team (Slack: #engineering-alerts)
- **Monitoring Issues:** @sre-team (Slack: #sre-oncall)
- **PagerDuty:** backend-on-call rotation

---

## 📚 Related Documentation

- [Silent Failure Detection Audit](./SILENT_FAILURE_DETECTION_AUDIT.md)
- [Database Migration Script](../sql/migrations/002_add_playlist_validation.sql)
- [Prometheus Alert Rules](../monitoring/prometheus/alerts.yml)
- [Verification Script](../scripts/verify_silent_failure_fixes.py)
- [Incident Postmortem: MixesDB Oct 2-6](./incidents/2025-10-06-mixesdb-silent-failure.md)

---

**Deployment Lead:** _________________
**Date Deployed:** _________________
**Verified By:** _________________
**Sign-off:** _________________
