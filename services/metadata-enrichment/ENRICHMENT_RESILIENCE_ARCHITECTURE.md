# Enrichment System Resilience Architecture

## Overview

This document describes the refactored enrichment pipeline architecture that ensures complete independence of enrichment sources, preventing cascading failures.

**Version:** 2.0
**Date:** 2025-10-07
**Author:** Claude Code (Anthropic)

---

## Problem Statement

### Original Architecture Issues

The original enrichment pipeline had the following cascading failure problem:

1. **Sequential Dependency**: If one enrichment source failed (e.g., Sonoteller), it would block subsequent sources
2. **No Individual Error Handling**: Errors in one source would propagate and prevent other sources from running
3. **Binary Success/Failure**: A track was either "completed" or "failed" - no partial success tracking
4. **No Source-Level Retry**: Failed sources couldn't be retried independently

### Impact

- A single API outage (e.g., Spotify rate limit) could cause ALL enrichments to fail
- Circuit breaker openings would block tracks entirely, even if other sources were available
- Lost enrichment opportunities when 80% of sources were working but one was down

---

## Refactored Architecture

### Core Principles

1. **Complete Source Independence**: Each enrichment source has its own try-catch block
2. **Fail-Forward Design**: Source failures log warnings but never stop execution
3. **Granular Success Tracking**: Track which specific sources succeeded/failed
4. **Individual Retry Capability**: Failed sources can be retried without re-running successful ones

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              Enrichment Pipeline (enrich_track)              │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Step 0: ISRC Check (non-blocking warning)             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────┐   ┌─────────────────────┐          │
│  │  Step 1: Spotify    │   │  Step 2: ISRC       │          │
│  │  (try-catch)        │   │  (try-catch)        │          │
│  │  - ID Lookup        │   │  - Spotify ISRC     │          │
│  │  - Metadata         │   │  - MusicBrainz ISRC │          │
│  │  ✓ Success: Add to  │   │  ✓ Success: Add to  │          │
│  │    sources_used     │   │    sources_used     │          │
│  │  ✗ Failure: Log +   │   │  ✗ Failure: Log +   │          │
│  │    Continue         │   │    Continue         │          │
│  └─────────────────────┘   └─────────────────────┘          │
│           │                          │                        │
│           ▼                          ▼                        │
│  ┌─────────────────────┐   ┌─────────────────────┐          │
│  │  Step 3: Text Search│   │  Step 4: MusicBrainz│          │
│  │  (try-catch)        │   │  (try-catch)        │          │
│  │  - Spotify Search   │   │  - Text Search      │          │
│  │  ✓ Success: Add     │   │  ✓ Success: Add     │          │
│  │  ✗ Failure: Log +   │   │  ✗ Failure: Log +   │          │
│  │    Continue         │   │    Continue         │          │
│  └─────────────────────┘   └─────────────────────┘          │
│           │                          │                        │
│           ▼                          ▼                        │
│  ┌─────────────────────┐   ┌─────────────────────┐          │
│  │  Step 5: Discogs    │   │  Step 6: Last.fm    │          │
│  │  (try-catch)        │   │  (try-catch)        │          │
│  │  - Release Metadata │   │  - Tags & Popularity│          │
│  │  ✓ Success: Add     │   │  ✓ Success: Add     │          │
│  │  ✗ Failure: Log +   │   │  ✗ Failure: Log +   │          │
│  │    Continue         │   │    Continue         │          │
│  └─────────────────────┘   └─────────────────────┘          │
│           │                          │                        │
│           └──────────┬───────────────┘                        │
│                      ▼                                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Step 7: Audio Features (BPM/Key) - ALL INDEPENDENT    │  │
│  │  ┌──────────────────┐  ┌──────────────────┐            │  │
│  │  │ AcousticBrainz   │  │  GetSongBPM      │            │  │
│  │  │  (try-catch)     │  │   (try-catch)    │            │  │
│  │  │  ✓ Add BPM/Key   │  │   ✓ Add BPM/Key  │            │  │
│  │  │  ✗ Log + Continue│  │   ✗ Log + Continue│           │  │
│  │  └──────────────────┘  └──────────────────┘            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Final Status Determination:                            │  │
│  │  - sources_used >= 2: COMPLETED                         │  │
│  │  - sources_used == 1: PARTIAL                           │  │
│  │  - sources_used == 0: FAILED                            │  │
│  │                                                          │  │
│  │  Track enrichment_sources in database JSONB:            │  │
│  │  {'enrichment_sources': ['spotify', 'musicbrainz', ...]}│  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

### Error Handling Pattern

Each enrichment source follows this pattern:

```python
# STEP X: Source Name - INDEPENDENT
logger.info(f"Step X: Source enrichment")
if self.source_client:
    try:
        source_data = await self.source_client.method(
            task.artist_name,
            task.track_title
        )
        if source_data:
            sources_used.append(EnrichmentSource.SOURCE)
            metadata.update(source_data)
            logger.info("✓ Source enrichment successful")
    except Exception as e:
        logger.warning(
            "Source enrichment failed - continuing with other sources",
            error=str(e),
            artist=task.artist_name,
            title=task.track_title
        )
        errors.append(f"Source enrichment error: {str(e)}")
else:
    logger.debug("Skipping Source enrichment - no client available")
```

### Key Features

1. **Try-Catch Wrapping**: Every API call wrapped in individual try-catch
2. **Warning-Level Logging**: Failures log as warnings, not errors (fail-forward)
3. **Error Collection**: All errors collected in `errors` list for debugging
4. **Continued Execution**: `continue` implied by exception handling - next source always runs

### Status Determination Logic

```python
# Determine final status based on sources that succeeded
if len(sources_used) >= 2:
    status = EnrichmentStatus.COMPLETED
elif len(sources_used) == 1:
    status = EnrichmentStatus.PARTIAL
else:
    status = EnrichmentStatus.FAILED
    errors.append("No metadata sources returned data")
```

**Key Change**: A track is now considered "completed" if ANY 2+ sources succeed, regardless of which sources failed.

---

## Database Schema

### Enrichment Status Table

The `enrichment_status` table tracks enrichment attempts:

```sql
CREATE TABLE enrichment_status (
    track_id UUID PRIMARY KEY,
    status VARCHAR(20),  -- 'pending', 'in_progress', 'completed', 'partial', 'failed'
    sources_enriched INTEGER,  -- Count of successful sources
    last_attempt TIMESTAMP,
    retry_count INTEGER,
    error_message TEXT,  -- Consolidated error messages
    is_retriable BOOLEAN,  -- True for circuit breaker errors
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Tracks Table - enrichment_sources Field

The `tracks.metadata` JSONB contains granular source tracking:

```json
{
  "enrichment_sources": ["spotify", "musicbrainz", "lastfm"],
  "enriched_at": "2025-10-07T12:34:56",
  "musicbrainz_id": "abc-123",
  "camelot_key": "8A",
  "lastfm_tags": ["techno", "electronic"]
}
```

---

## Reprocessing Failed Enrichments

### Script: `reprocess_failed_enrichments.py`

**Location**: `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/scripts/reprocess_failed_enrichments.py`

### Features

1. **Flexible Filtering**:
   - Date range (`--days`, `--start-date`, `--end-date`)
   - Specific track IDs (`--track-id`)
   - Failure type (`--retriable-only`, `--non-retriable-only`)
   - Source filter (`--source spotify`)

2. **Safe Operation**:
   - Dry-run mode (`--dry-run`) to preview changes
   - Idempotent (safe to run multiple times)
   - Transaction-based updates

3. **Optional Immediate Enrichment**:
   - `--trigger-now` flag calls enrichment API immediately
   - Useful for urgent reprocessing

### Usage Examples

```bash
# Preview what would be reprocessed (dry-run)
python scripts/reprocess_failed_enrichments.py --dry-run

# Reset all failed tracks from last 7 days
python scripts/reprocess_failed_enrichments.py --days 7

# Reset specific track
python scripts/reprocess_failed_enrichments.py \
  --track-id abc123-def456-...

# Reset only retriable failures (circuit breaker errors)
python scripts/reprocess_failed_enrichments.py --retriable-only --limit 200

# Reset failures for specific source
python scripts/reprocess_failed_enrichments.py --source spotify --limit 100

# Reset and immediately trigger enrichment
python scripts/reprocess_failed_enrichments.py \
  --trigger-now --limit 50

# Reset tracks that failed between specific dates
python scripts/reprocess_failed_enrichments.py \
  --start-date 2025-10-01 \
  --end-date 2025-10-07 \
  --limit 500
```

### How It Works

1. **Query Failed Tracks**: Finds tracks matching filters from `enrichment_status` table
2. **Display Summary**: Shows track details, failure reasons, retry counts
3. **Reset to Pending**: Updates `enrichment_status.status = 'pending'`
4. **Clear Error State**: Resets `error_message` and `is_retriable` fields
5. **Trigger Enrichment** (optional): Calls `/enrich/trigger` endpoint

### Safety Features

- **Dry-run mode**: Preview without making changes
- **Transaction-based**: All updates are atomic
- **Idempotent**: Running twice has same effect as running once
- **Detailed logging**: Structured JSON logs for audit trail

---

## Circuit Breaker Integration

### How Circuit Breakers Work

Each API client has a circuit breaker that:

1. **Tracks Failures**: Counts consecutive failures
2. **Opens on Threshold**: After N failures, circuit "opens" (rejects calls)
3. **Auto-Recovery**: After timeout period, enters "half-open" state for testing
4. **Closes on Success**: If test succeeds, circuit "closes" (normal operation)

### Circuit Breaker Configuration

```python
# Example from api_clients.py
self.circuit_breaker = CircuitBreaker(
    failure_threshold=5,      # Open after 5 failures
    timeout_seconds=60,       # Wait 60s before retry
    success_threshold=2,      # Need 2 successes to close
    name="spotify"
)
```

### Retriable Failures

When a circuit breaker opens, the enrichment pipeline:

1. **Catches CircuitBreakerOpenException**
2. **Marks as Retriable**: Sets `is_retriable = true` in database
3. **Resets Retry Count**: Circuit breaker errors don't count towards retry limit
4. **Enables Auto-Recovery**: Next enrichment cycle will retry when circuit closes

```python
# From enrichment_pipeline.py _update_enrichment_status()
is_retriable = False
if error_message and 'Circuit breaker' in error_message and 'is OPEN' in error_message:
    is_retriable = True
    logger.info(
        "Marking circuit breaker failure as retriable",
        track_id=track_id,
        error=error_message
    )
```

---

## Monitoring & Observability

### Metrics

The enrichment service exposes Prometheus metrics:

```
# Success rate by source
enrichment_tasks_total{source="spotify", status="completed"}
enrichment_tasks_total{source="musicbrainz", status="failed"}

# API call metrics
api_calls_total{api="spotify", status="success"}
api_response_time_seconds{api="musicbrainz"}

# Circuit breaker state
enrichment_circuit_breaker_state{api="spotify", state="closed"}
enrichment_circuit_breaker_state{api="lastfm", state="open"}

# Cache performance
enrichment_cache_hits_total{cache_type="redis"}
enrichment_cache_misses_total{cache_type="redis"}
```

### Logging

All enrichment attempts are logged with structured JSON:

```json
{
  "event": "Track enrichment completed",
  "track_id": "abc-123",
  "correlation_id": "xyz-789",
  "status": "completed",
  "sources_used": 3,
  "duration": "2.45s",
  "errors": [
    "Discogs enrichment error: 429 Too Many Requests"
  ],
  "timestamp": "2025-10-07T12:34:56Z"
}
```

### Grafana Dashboards

Recommended dashboard panels:

1. **Enrichment Success Rate**: Gauge showing % completed enrichments
2. **Sources Per Track**: Histogram of sources_enriched count
3. **Circuit Breaker States**: State chart for each API
4. **Failed Tracks Over Time**: Time series of failed enrichments
5. **API Response Times**: Heatmap by API source

---

## Testing Strategy

### Unit Tests

Test each source independently:

```python
async def test_spotify_enrichment_failure_does_not_block():
    """Verify Spotify failure doesn't prevent MusicBrainz enrichment"""
    # Mock Spotify to raise exception
    spotify_client.get_track_by_id = Mock(side_effect=Exception("API Error"))

    # Mock MusicBrainz to return data
    musicbrainz_client.search_recording = Mock(return_value={'musicbrainz_id': 'abc-123'})

    result = await pipeline.enrich_track(task)

    # Assert MusicBrainz still enriched despite Spotify failure
    assert EnrichmentSource.MUSICBRAINZ in result.sources_used
    assert result.status == EnrichmentStatus.PARTIAL
    assert "Spotify" in result.errors[0]
```

### Integration Tests

Test full pipeline with simulated failures:

```python
async def test_circuit_breaker_marks_retriable():
    """Verify circuit breaker errors are marked retriable"""
    # Open circuit breaker
    for _ in range(5):
        await spotify_client.circuit_breaker.call(lambda: raise_exception())

    result = await pipeline.enrich_track(task)

    # Check database status
    status = await get_enrichment_status(task.track_id)
    assert status.is_retriable == True
    assert "Circuit breaker" in status.error_message
```

### Load Tests

Verify performance under partial failures:

```bash
# Simulate 50% API failure rate
locust -f enrichment_load_test.py \
  --users 100 \
  --spawn-rate 10 \
  --run-time 5m \
  --api-failure-rate 0.5
```

---

## Migration Guide

### For Existing Deployments

1. **Deploy Updated Code**: Deploy refactored `enrichment_pipeline.py`
2. **Add is_retriable Column** (if not present):
   ```sql
   ALTER TABLE enrichment_status
   ADD COLUMN IF NOT EXISTS is_retriable BOOLEAN DEFAULT false;
   ```

3. **Reset Failed Tracks**: Use reprocess script to retry failed enrichments
   ```bash
   python scripts/reprocess_failed_enrichments.py \
     --days 30 \
     --limit 1000
   ```

4. **Monitor Initial Run**: Watch Grafana dashboards for improved success rates

### Expected Improvements

- **Success Rate**: +15-25% (tracks that previously failed completely)
- **Partial Enrichments**: +30-40% (tracks with some data vs none)
- **Circuit Breaker Recovery**: Automatic retry when services recover

---

## Best Practices

### For Developers

1. **Always Wrap API Calls**: Use try-catch for every external API call
2. **Log Warnings, Not Errors**: Failed sources are warnings (fail-forward design)
3. **Collect All Errors**: Append to `errors` list for debugging
4. **Test with Mocks**: Verify failures don't cascade

### For Operations

1. **Monitor Circuit Breakers**: Set alerts for "open" state lasting >5 minutes
2. **Run Reprocess Weekly**: Automated cron job to retry failed enrichments
3. **Track Source Health**: Dashboard showing per-source success rates
4. **Analyze Error Patterns**: Group errors by source to identify systemic issues

### For API Key Management

1. **Rotate Keys Gracefully**: Update database keys without service restart
2. **Monitor Quota Usage**: Alert when approaching rate limits
3. **Fallback to Free APIs**: Prefer free sources (AcousticBrainz) when possible

---

## Troubleshooting

### Issue: All Enrichments Failing

**Symptoms**: `sources_enriched = 0` for all tracks

**Diagnosis**:
```bash
# Check circuit breaker states
curl http://localhost:8020/health | jq '.api_clients'

# Check database connectivity
psql -U musicdb_user -d musicdb -c "SELECT COUNT(*) FROM enrichment_status WHERE status='failed';"
```

**Resolution**:
1. Check all circuit breakers are "closed"
2. Verify API keys are valid
3. Check rate limit quotas

### Issue: Retriable Failures Not Retrying

**Symptoms**: Tracks stuck with `is_retriable=true` but never reprocessed

**Diagnosis**:
```bash
# Check scheduled enrichment task
docker logs metadata-enrichment | grep "process_pending_enrichments"

# Query retriable failures
psql -c "SELECT COUNT(*) FROM enrichment_status WHERE is_retriable=true AND status='failed';"
```

**Resolution**:
1. Manually trigger enrichment: `curl -X POST http://localhost:8020/enrich/trigger?limit=100`
2. Check scheduler is running: `docker logs metadata-enrichment | grep "Scheduler started"`
3. Verify circuit breakers have recovered

### Issue: Partial Enrichments Not Completing

**Symptoms**: Many tracks stuck at `status='partial'` with `sources_enriched=1`

**Diagnosis**:
```bash
# Analyze which sources are failing
python scripts/reprocess_failed_enrichments.py --dry-run | grep "Error"
```

**Resolution**:
1. Identify failing sources from error messages
2. Check API keys and rate limits for those sources
3. Reprocess with focus on missing sources

---

## Performance Considerations

### Concurrent Source Calls

**Future Enhancement**: Currently sources run sequentially. Consider parallel execution:

```python
# Potential optimization
tasks = [
    self._enrich_spotify(task),
    self._enrich_musicbrainz(task),
    self._enrich_discogs(task)
]
results = await asyncio.gather(*tasks, return_exceptions=True)
```

**Trade-offs**:
- **Pro**: Faster enrichment (3x speedup potential)
- **Con**: Higher rate limit pressure
- **Con**: More complex error handling

### Caching Strategy

Current cache TTLs:
- **Spotify**: 30 days (static metadata)
- **MusicBrainz**: 90 days (canonical IDs)
- **AcousticBrainz**: 90 days (audio features)
- **GetSongBPM**: 30 days

**Recommendation**: Monitor Redis memory usage and adjust TTLs if needed

---

## Future Enhancements

1. **Source Priority System**: Allow configuring preferred sources
2. **Intelligent Retry Delays**: Exponential backoff for failed sources
3. **Source Health Scoring**: Track historical reliability per source
4. **Automatic Quota Management**: Pause sources approaching rate limits
5. **ML-Based Source Selection**: Predict which sources likely to succeed

---

## Appendix: Source Independence Checklist

For each enrichment source, verify:

- [ ] Wrapped in try-catch block
- [ ] Failure logs as WARNING (not ERROR)
- [ ] Error appended to `errors` list
- [ ] Does not use `raise` or `sys.exit()`
- [ ] Success adds to `sources_used` list
- [ ] Has own circuit breaker
- [ ] Has own rate limiter
- [ ] Failures don't prevent subsequent sources

---

## Conclusion

The refactored enrichment pipeline provides:

✅ **Complete Source Independence**: No cascading failures
✅ **Partial Success Tracking**: Extract value from any working sources
✅ **Intelligent Retry Logic**: Circuit breaker awareness
✅ **Easy Reprocessing**: Dedicated script for retrying failures
✅ **Production-Ready**: Comprehensive monitoring and observability

This architecture ensures maximum enrichment success while maintaining resilience against inevitable API failures.
