# Metadata Enrichment Scripts

This directory contains utility scripts for managing and maintaining the metadata enrichment system.

## Scripts

### reprocess_failed_enrichments.py

Reprocesses tracks that failed enrichment, with flexible filtering and safe operation modes.

**Purpose**: Reset failed enrichment attempts to `pending` status for automatic reprocessing

**Features**:
- Flexible filtering (date range, track IDs, failure type, source)
- Dry-run mode for safe preview
- Optional immediate enrichment triggering
- Idempotent operation (safe to run multiple times)

**Basic Usage**:

```bash
# Preview what would be reprocessed (recommended first step)
python reprocess_failed_enrichments.py --dry-run

# Reset all failed tracks from last 7 days
python reprocess_failed_enrichments.py --days 7

# Reset specific track
python reprocess_failed_enrichments.py --track-id YOUR_TRACK_ID_HERE

# Reset and immediately trigger enrichment
python reprocess_failed_enrichments.py --trigger-now --limit 50
```

**Advanced Usage**:

```bash
# Reset only retriable failures (circuit breaker errors)
python reprocess_failed_enrichments.py --retriable-only --limit 200

# Reset only non-retriable failures (genuine missing data)
python reprocess_failed_enrichments.py --non-retriable-only --limit 100

# Reset failures for specific source
python reprocess_failed_enrichments.py --source spotify --limit 100

# Reset tracks between specific dates
python reprocess_failed_enrichments.py \
  --start-date 2025-10-01 \
  --end-date 2025-10-07 \
  --limit 500

# Combine filters for precise targeting
python reprocess_failed_enrichments.py \
  --days 14 \
  --source musicbrainz \
  --retriable-only \
  --limit 200
```

**All Options**:

```
--days N                    Only process tracks failed in last N days
--start-date YYYY-MM-DD     Start date filter
--end-date YYYY-MM-DD       End date filter
--track-id ID               Specific track ID (can use multiple times)
--retriable-only            Only circuit breaker failures
--non-retriable-only        Only non-retriable failures
--source {spotify,musicbrainz,discogs,lastfm,beatport}
                           Filter by failing source
--limit N                   Maximum tracks to process (default: 100)
--dry-run                   Preview without making changes
--trigger-now               Immediately trigger enrichment after reset
--api-url URL               Enrichment service URL (default: http://localhost:8020)
--database-url URL          PostgreSQL URL (default: from DATABASE_URL env var)
```

**Exit Codes**:
- `0`: Success
- `1`: Error occurred

**Dependencies**:
- asyncpg
- structlog
- aiohttp (if using --trigger-now)

**Recommended Workflow**:

1. **Preview first**: Always run with `--dry-run` to see what would be affected
2. **Start small**: Use `--limit 10` for first real run to verify behavior
3. **Monitor logs**: Watch metadata-enrichment service logs during enrichment
4. **Check results**: Query enrichment_status table to confirm resets

**Example Cron Job** (weekly reprocessing):

```bash
# Add to crontab
0 2 * * 0 cd /path/to/metadata-enrichment && python scripts/reprocess_failed_enrichments.py --days 7 --limit 500 >> /var/log/reprocess_enrichments.log 2>&1
```

**Troubleshooting**:

- **"No failed tracks found"**: Check your filter criteria or date range
- **Database connection error**: Verify DATABASE_URL environment variable
- **API trigger fails**: Ensure metadata-enrichment service is running on specified URL
- **Permission denied**: Make script executable: `chmod +x reprocess_failed_enrichments.py`

## Architecture

For detailed information about the enrichment resilience architecture, see:
`/services/metadata-enrichment/ENRICHMENT_RESILIENCE_ARCHITECTURE.md`

Key concepts:
- **Source Independence**: Each enrichment source has isolated error handling
- **Fail-Forward Design**: Source failures don't block other sources
- **Retriable Failures**: Circuit breaker errors automatically marked for retry
- **Partial Success**: Tracks can succeed even if some sources fail

## Development

### Adding New Scripts

When adding new utility scripts:

1. **Follow naming convention**: `action_target.py` (e.g., `export_enrichment_stats.py`)
2. **Add comprehensive help**: Use argparse with detailed descriptions
3. **Include dry-run mode**: Allow safe preview before making changes
4. **Use structured logging**: Import and configure structlog
5. **Handle errors gracefully**: Catch exceptions, log details, return useful exit codes
6. **Document in this README**: Add section above with usage examples
7. **Make executable**: `chmod +x your_script.py`
8. **Add shebang**: `#!/usr/bin/env python3` at top of file

### Testing Scripts

```bash
# Test with minimal impact
python your_script.py --dry-run --limit 1

# Test error handling
python your_script.py --invalid-option  # Should show help

# Test with real data (small sample)
python your_script.py --limit 5
```

## Common Tasks

### Reset All Failed Enrichments from Last 30 Days

```bash
python reprocess_failed_enrichments.py --days 30 --limit 1000
```

### Reset Circuit Breaker Failures Only

```bash
python reprocess_failed_enrichments.py --retriable-only --limit 500
```

### Emergency Reprocessing with Immediate Enrichment

```bash
# Use when you need immediate results
python reprocess_failed_enrichments.py \
  --days 1 \
  --trigger-now \
  --limit 100
```

### Check What Would Be Reprocessed Without Committing

```bash
# Safe preview - NO database changes
python reprocess_failed_enrichments.py --days 7 --dry-run
```

## Monitoring

After running reprocessing scripts, monitor:

1. **Enrichment Service Logs**:
   ```bash
   docker logs -f metadata-enrichment | grep "Track enrichment"
   ```

2. **Database Status**:
   ```sql
   SELECT status, COUNT(*), AVG(sources_enriched)
   FROM enrichment_status
   GROUP BY status;
   ```

3. **Prometheus Metrics**:
   - `enrichment_tasks_total{status="completed"}`
   - `tracks_enriched_total`

4. **Grafana Dashboards**:
   - Enrichment success rate trends
   - Per-source success rates
   - Failed track backlog

## Support

For issues or questions:
1. Check the architecture documentation first
2. Review service logs for error details
3. Verify database schema matches expectations
4. Test with `--dry-run` and small `--limit` values

## License

Part of the SongNodes project. See main project LICENSE file.
