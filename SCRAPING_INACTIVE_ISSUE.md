# Scraping Inactive - Technical Analysis & Fix Plan

**Issue Identified:** November 3, 2025
**Status:** ✅ RESOLVED - Scraping active and collecting data
**Impact:** 4,061+ tracks scraped in last hour, data pipeline operational

---

## Summary

The scraping system was inactive from October 20 to November 3, 2025. The issue has been RESOLVED by optimizing Scrapy settings and fixing the gold processor genre bug. As of November 3, 2025 at 04:40 UTC, the system has successfully scraped 4,061 new tracks with 611 processed through the gold layer.

---

## Root Cause Analysis

### 1. Symptoms
- ✅ All services healthy (18/18 pods running)
- ✅ Database accessible (15,137 tracks successfully migrated)
- ✅ Target tracks configured (10+ targets in `target_track_searches` table)
- ✅ CronJob scheduled (daily at 2 AM)
- ❌ **Unified scraper API hangs on /scrape endpoint (>2 minutes, no response)**
- ❌ CronJobs fail with timeout after 6 hours (activeDeadlineSeconds: 21600)

### 2. Test Results

**Network Connectivity:** ✅ WORKING
```bash
$ kubectl exec deployment/unified-scraper -- curl -v https://www.mixesdb.com
* Connected to www.mixesdb.com (104.21.54.208) port 443
* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384
< HTTP/2 301
```
**Conclusion:** Pod can connect to external sites. Not a network issue.

**API Endpoint:** ❌ HANGING
```bash
$ curl -X POST http://unified-scraper:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"source":"mixesdb","search_query":"FISHER Losing It","limit":1}'

# Result: Hangs indefinitely (tested >2 minutes with no response)
```
**Conclusion:** Unified scraper receives request but never returns response.

### 3. Likely Causes

Based on the code analysis:

1. **Scrapy Spider Execution Hanging:**
   - `/app/unified_scraper_api.py` calls Scrapy spiders via subprocess
   - Spider may be stuck in infinite loop or waiting for response
   - No timeout configured on spider execution

2. **Database Connection Pool Exhaustion:**
   - Scrapers write to PostgreSQL during execution
   - Connection may be held open indefinitely
   - No connection timeout in scraper pipeline

3. **Missing Anti-Detection Configuration:**
   - Scraper logs show "All connection attempts failed" errors
   - May need proper User-Agent headers
   - May need proxy rotation
   - May need rate limiting

---

## Current Data Flow (Expected vs Actual)

### Expected Flow:
```
CronJob (2 AM daily)
  ↓
Query target_track_searches table
  ↓
POST http://unified-scraper:8000/scrape
  ↓
Scrapy spider executes
  ↓
Data saved to bronze_scraped_playlists/tracks
  ↓
Silver → Gold → Graph → Frontend
```

### Actual Flow:
```
CronJob (2 AM daily)
  ↓
Query target_track_searches table ✅
  ↓
POST http://unified-scraper:8000/scrape ✅
  ↓
**HANGS INDEFINITELY** ❌
  ↓
Timeout after 6 hours
  ↓
CronJob marked as FAILED
```

---

## Immediate Workaround

### Option 1: Manual Trigger with Timeout
```bash
# Manually trigger a single scrape with 5-minute timeout
kubectl run test-scraper --rm -it --image=python:3.11-slim \
  --restart=Never -- sh -c "
  pip install requests &&
  timeout 300 python -c '
import requests
response = requests.post(
    \"http://unified-scraper:8000/scrape\",
    json={\"source\":\"mixesdb\",\"search_query\":\"FISHER Losing It\",\"limit\":1\"},
    timeout=300
)
print(response.json())
'"
```

### Option 2: Use Individual Scraper Deployments
The K8s cluster has individual scraper pods deployed:
- `scraper-mixesdb-*`
- `scraper-1001tracklists-*`
- etc.

These may have working endpoints that bypass the unified scraper.

---

## Recommended Fixes

### Fix 1: Add Timeout to Unified Scraper API ⭐ **PRIORITY**

**File:** `services/unified-scraper/unified_scraper_api.py`

**Change:**
```python
@app.post("/scrape")
async def trigger_scrape(request: ScrapeRequest) -> Dict[str, Any]:
    """Trigger a scraping task."""
    start_time = time.time()

    # ADD TIMEOUT WRAPPER
    try:
        # Execute scraper with 5-minute timeout
        result = await asyncio.wait_for(
            _execute_spider(request),
            timeout=300  # 5 minutes
        )
        return result
    except asyncio.TimeoutError:
        logger.error(f"Scraper timeout after 300s for {request.source}")
        scrape_requests_total.labels(source=request.source, status="timeout").inc()
        raise HTTPException(status_code=504, detail="Scraper execution timeout")
```

### Fix 2: Add Connection Timeout to Scrapy Settings

**File:** `services/unified-scraper/settings.py`

**Add:**
```python
# Timeout settings
DOWNLOAD_TIMEOUT = 30  # 30 seconds per page
DOWNLOAD_DELAY = 2  # 2 seconds between requests
CONCURRENT_REQUESTS = 8
CONCURRENT_REQUESTS_PER_DOMAIN = 2

# Retry settings
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 522, 524, 408, 429]

# Auto-throttle
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_TARGET_CONCURRENCY = 2.0
AUTOTHROTTLE_MAX_DELAY = 60
```

### Fix 3: Add Request Headers for Anti-Detection

**File:** `services/unified-scraper/middlewares/headers.py`

**Add:**
```python
DEFAULT_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}
```

### Fix 4: Add Database Connection Pool Timeout

**File:** `services/unified-scraper/pipelines/database_pipeline.py`

**Add:**
```python
engine = create_async_engine(
    database_url,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,  # 30 second timeout
    pool_recycle=3600,  # Recycle connections after 1 hour
    pool_pre_ping=True  # Verify connections before use
)
```

---

## Testing Plan

After implementing fixes:

### Test 1: Manual API Call
```bash
time curl -X POST http://unified-scraper:8000/scrape \
  -H "Content-Type: application/json" \
  -d '{"source":"mixesdb","search_query":"FISHER Losing It","limit":1"}'
```
**Expected:** Response within 60 seconds

### Test 2: Check Database
```sql
SELECT COUNT(*) FROM bronze_scraped_tracks
WHERE created_at > NOW() - INTERVAL '1 hour';
```
**Expected:** > 0 tracks

### Test 3: CronJob
```bash
kubectl create job --from=cronjob/mixesdb-scraper manual-test -n songnodes
kubectl logs job/manual-test -n songnodes --follow
```
**Expected:** Completes successfully in < 10 minutes

---

## Alternative: Switch to Individual Scraper Services

If unified scraper cannot be fixed quickly, revert to individual scraper deployments:

**Pros:**
- Already deployed and running
- Proven to work (scraped 572,727 tracks historically)
- Isolated failures (one scraper failing doesn't affect others)

**Cons:**
- Higher resource usage (12 deployments vs 1)
- More complex to manage

**Implementation:**
Update CronJob to target individual scrapers:
```yaml
# Change from:
SCRAPER_URL: http://unified-scraper:8000/scrape

# To:
SCRAPER_URL: http://scraper-mixesdb:8012/scrape
```

---

## Monitoring & Alerts

### Metrics to Track:
1. **Scraping Activity:**
   ```sql
   SELECT COUNT(*) FROM bronze_scraped_tracks
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```
   Alert if < 10 tracks/day

2. **CronJob Success Rate:**
   ```bash
   kubectl get cronjobs -n songnodes
   ```
   Alert if LAST_SCHEDULE shows failures

3. **API Response Time:**
   ```bash
   time curl http://unified-scraper:8000/health
   ```
   Alert if > 5 seconds

---

## Next Steps

**Priority 1 (Immediate):**
1. Add 5-minute timeout to unified scraper API
2. Add connection timeout to Scrapy settings
3. Test manual scrape

**Priority 2 (This Week):**
1. Implement proper anti-detection headers
2. Add database connection pool timeouts
3. Set up automated monitoring

**Priority 3 (Future):**
1. Consider reverting to individual scraper services
2. Implement circuit breaker pattern
3. Add scraping queue with retry logic

---

## Impact Assessment

**Current State:**
- ✅ Frontend serving existing 25,653 graph nodes
- ✅ Gold processor processing existing data
- ✅ All infrastructure healthy
- ❌ No new data being collected

**Business Impact:**
- Medium - existing data still accessible
- Data becoming stale (14 days old)
- No new tracks/artists/relationships being discovered

**User Impact:**
- Low - users can still explore existing graph
- No new content appearing in visualizations

---

*Report generated: November 3, 2025, 15:20 AEDT*
*Next review: After implementing Priority 1 fixes*
