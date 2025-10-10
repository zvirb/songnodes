# Dead-Letter Queue (DLQ) System

## Overview

The SongNodes Dead-Letter Queue (DLQ) system provides a robust mechanism for capturing, analyzing, and replaying failed enrichment operations. When API enrichment attempts fail after multiple retries, the system publishes detailed failure information to a dedicated RabbitMQ queue for later investigation and replay.

## Architecture

### Components

1. **DLQ Manager Service** (`dlq-manager:8024`)
   - FastAPI service for monitoring and managing failed messages
   - Provides REST API for listing, replaying, and analyzing failures
   - Exposes Prometheus metrics for observability
   - Automatic RabbitMQ infrastructure setup on startup

2. **DLQ Client Library** (`services/common/dlq_client.py`)
   - Reusable library for publishing failures to DLQ
   - Automatic error type detection
   - Full error context capture (stack traces, correlation IDs)
   - Connection pooling and retry logic

3. **RabbitMQ Infrastructure**
   - **Exchange**: `enrichment.dlq.exchange` (topic type)
   - **Queues**:
     - `enrichment.dlq.queue`: Main DLQ (30-day TTL, quorum queue)
     - `enrichment.dlq.retry`: Retry queue (24-hour TTL)
     - `enrichment.dlq.analysis`: Analysis queue (7-day TTL)
   - **Routing Keys**:
     - `spotify.enrichment.failed`
     - `musicbrainz.enrichment.failed`
     - `lastfm.enrichment.failed`
     - `audio_analysis.enrichment.failed`
     - `general.enrichment.failed`

4. **Grafana Dashboard** (`monitoring/grafana/dashboards/dlq-monitoring.json`)
   - Real-time DLQ depth monitoring
   - Error type distribution (pie chart)
   - Message age tracking
   - Replay success/failure rates

## Message Format

### DLQ Message Structure

```json
{
  "message_id": "550e8400-e29b-41d4-a716-446655440000",
  "correlation_id": "req-123456",
  "routing_key": "spotify.enrichment.failed",
  "timestamp": "2025-10-10T12:30:45Z",
  "retry_count": 3,
  "error_type": "spotify",
  "error_message": "Rate limit exceeded: 429 Too Many Requests",
  "stack_trace": "Traceback (most recent call last):\n  ...",
  "source_service": "api-enrichment-pipeline",
  "payload": {
    "track_id": "abc123",
    "artist_name": "Deadmau5",
    "track_name": "Strobe",
    "source_context": "1001tracklists"
  },
  "metadata": {
    "spider": "mixesdb",
    "failed_services": ["spotify", "musicbrainz", "lastfm"],
    "original_source_url": "https://example.com/mix/123"
  }
}
```

### Message Headers

- `x-retry-count`: Number of retry attempts before DLQ
- `x-error-type`: Classified error type (spotify, musicbrainz, etc.)
- `x-error-message`: Truncated error message (500 chars)
- `x-stack-trace`: Truncated stack trace (2000 chars)
- `x-source-service`: Service that published to DLQ
- `x-metadata`: Additional context (JSON)
- `x-failed-at`: ISO timestamp of failure

## Usage

### 1. Publishing to DLQ (Automatic)

The API enrichment pipeline automatically publishes to DLQ after 3 failed attempts:

```python
from common.dlq_client import DLQClient

dlq = DLQClient()

# Automatic publishing on failure
try:
    # ... enrichment logic ...
except Exception as e:
    dlq.publish_to_dlq(
        item={'artist': 'Artist Name', 'title': 'Track Title'},
        error=e,
        retry_count=3,
        source_service='api-enrichment-pipeline',
        metadata={'spider': 'mixesdb'}
    )
```

### 2. Monitoring DLQ (Via API)

#### List Failed Messages

```bash
# Get first 100 messages
curl http://localhost:8024/dlq/messages?limit=100&offset=0

# Pagination
curl http://localhost:8024/dlq/messages?limit=50&offset=50
```

#### Get Statistics

```bash
curl http://localhost:8024/dlq/stats
```

**Example Response**:

```json
{
  "total_messages": 157,
  "by_error_type": {
    "spotify": 89,
    "musicbrainz": 42,
    "lastfm": 18,
    "general": 8
  },
  "by_service": {
    "api-enrichment-pipeline": 157
  },
  "oldest_message_age_seconds": 86400,
  "newest_message_age_seconds": 120,
  "queue_stats": {
    "enrichment.dlq.queue": 157,
    "enrichment.dlq.retry": 0,
    "enrichment.dlq.analysis": 42
  }
}
```

#### Group by Error Type

```bash
curl http://localhost:8024/dlq/errors/grouped
```

**Example Response**:

```json
[
  {
    "error_type": "spotify",
    "count": 89,
    "sample_messages": [
      "msg-id-1",
      "msg-id-2",
      "msg-id-3"
    ],
    "first_seen": "2025-10-09T10:00:00Z",
    "last_seen": "2025-10-10T14:30:00Z"
  }
]
```

### 3. Replaying Messages

#### Replay Single Message

```bash
curl -X POST http://localhost:8024/dlq/replay/550e8400-e29b-41d4-a716-446655440000
```

**Response**:

```json
{
  "success": true,
  "message": "Message 550e8400-e29b-41d4-a716-446655440000 replayed successfully"
}
```

#### Replay Multiple Messages

```bash
curl -X POST http://localhost:8024/dlq/replay/batch \
  -H "Content-Type: application/json" \
  -d '{
    "message_ids": [
      "msg-id-1",
      "msg-id-2",
      "msg-id-3"
    ],
    "max_retries": 3
  }'
```

**Response**:

```json
{
  "success": true,
  "replayed_count": 3,
  "failed_count": 0,
  "errors": []
}
```

### 4. Deleting Messages (Admin Only)

**WARNING**: This operation is irreversible.

```bash
curl -X DELETE http://localhost:8024/dlq/message/550e8400-e29b-41d4-a716-446655440000
```

### 5. Monitoring in Grafana

Access the DLQ dashboard:

```
http://localhost:3001/d/dlq-monitoring/dead-letter-queue-dlq-monitoring
```

**Dashboard Panels**:

1. **Total DLQ Messages** (Gauge)
   - Current queue depth
   - Thresholds: Green (0-10), Yellow (10-100), Red (>100)

2. **DLQ Queue Depth Over Time** (Time Series)
   - Historical queue depth
   - All queues (main, retry, analysis)

3. **Messages by Error Type** (Pie Chart)
   - Distribution of errors
   - Click to filter by error type

4. **Error Type Statistics** (Table)
   - Sortable table of error counts
   - Error type breakdown

5. **DLQ Replay Rate** (Time Series)
   - Replay operations per minute
   - Success vs. failure rates

6. **Oldest Message Age (P99)** (Gauge)
   - Age of oldest messages in DLQ
   - Thresholds: Green (<1h), Yellow (1h-1d), Red (>1d)

7. **Successful/Failed Replays (24h)** (Gauges)
   - Replay statistics for last 24 hours

## Prometheus Metrics

### Available Metrics

```promql
# Queue depth
dlq_messages_total{queue="enrichment.dlq.queue"}

# Messages by error type
dlq_messages_by_error_type{error_type="spotify"}

# Replay operations
dlq_replay_total{status="success"}
dlq_replay_total{status="error"}
dlq_replay_total{status="not_found"}

# Message age distribution
dlq_message_age_seconds
```

### Example Queries

#### Current DLQ Depth

```promql
dlq_messages_total{queue="enrichment.dlq.queue"}
```

#### Replay Success Rate (Last Hour)

```promql
rate(dlq_replay_total{status="success"}[1h])
  /
rate(dlq_replay_total[1h])
```

#### Top Error Types

```promql
topk(5, dlq_messages_by_error_type)
```

## Alerting Thresholds

### Recommended Alerts

1. **High DLQ Depth**
   - **Threshold**: > 100 messages
   - **Severity**: Warning
   - **Action**: Review and replay failed enrichments

2. **Very High DLQ Depth**
   - **Threshold**: > 500 messages
   - **Severity**: Critical
   - **Action**: Investigate API credentials, rate limits, or service outages

3. **Old Messages**
   - **Threshold**: P99 age > 7 days
   - **Severity**: Warning
   - **Action**: Review and clean up stale failures

4. **Replay Failures**
   - **Threshold**: Replay failure rate > 50%
   - **Severity**: Warning
   - **Action**: Check API status and credentials

### Example Alertmanager Configuration

```yaml
- alert: DLQHighDepth
  expr: dlq_messages_total{queue="enrichment.dlq.queue"} > 100
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "High DLQ depth detected"
    description: "DLQ has {{ $value }} messages pending"

- alert: DLQCriticalDepth
  expr: dlq_messages_total{queue="enrichment.dlq.queue"} > 500
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Critical DLQ depth"
    description: "DLQ has {{ $value }} messages - investigate immediately"

- alert: DLQOldMessages
  expr: dlq_message_age_seconds{quantile="0.99"} > 604800  # 7 days
  for: 1h
  labels:
    severity: warning
  annotations:
    summary: "Old DLQ messages detected"
    description: "Oldest DLQ message is {{ $value | humanizeDuration }} old"
```

## Common Error Patterns and Resolutions

### 1. Spotify Rate Limits (429 Errors)

**Symptoms**:
- Large number of `spotify.enrichment.failed` messages
- Error message: "Rate limit exceeded: 429 Too Many Requests"

**Resolution**:
1. Wait for rate limit window to reset (typically 30 seconds)
2. Replay messages in batches:
   ```bash
   # Get all Spotify failures
   curl http://localhost:8024/dlq/errors/grouped | jq '.[] | select(.error_type=="spotify")'

   # Replay in batches of 10
   curl -X POST http://localhost:8024/dlq/replay/batch \
     -H "Content-Type: application/json" \
     -d '{"message_ids": ["id1", "id2", ...], "max_retries": 3}'
   ```
3. Consider increasing delay between Spotify API calls in pipeline settings

### 2. MusicBrainz Rate Limits

**Symptoms**:
- `musicbrainz.enrichment.failed` errors
- Error message: "Rate limit: 1 request per second"

**Resolution**:
1. MusicBrainz enforces strict 1 req/sec rate limit
2. Pipeline already implements this - check for clock skew or concurrent processes
3. Replay messages slowly:
   ```bash
   # Replay one at a time with delay
   for msg_id in $(cat message_ids.txt); do
     curl -X POST http://localhost:8024/dlq/replay/$msg_id
     sleep 1
   done
   ```

### 3. Invalid/Missing Credentials

**Symptoms**:
- 401 Unauthorized errors
- Error message: "Invalid client credentials"

**Resolution**:
1. Verify credentials in `.env` file:
   ```bash
   grep -E "(SPOTIFY_CLIENT_ID|SPOTIFY_CLIENT_SECRET|LASTFM_API_KEY)" .env
   ```
2. Check database for encrypted API keys:
   ```sql
   SELECT provider, key_name, is_active
   FROM api_keys
   WHERE provider IN ('spotify', 'musicbrainz', 'lastfm');
   ```
3. Update credentials and replay failed messages

### 4. Network/Timeout Errors

**Symptoms**:
- `general.enrichment.failed` errors
- Error message: "Connection timeout" or "DNS resolution failed"

**Resolution**:
1. Check network connectivity from scraper container:
   ```bash
   docker compose exec scraper-orchestrator curl -I https://api.spotify.com
   ```
2. Verify DNS resolution:
   ```bash
   docker compose exec scraper-orchestrator nslookup api.spotify.com
   ```
3. Check firewall rules if running in restricted network
4. Replay messages after network issues resolved

## Maintenance Operations

### Purge All DLQ Messages (DANGEROUS)

**WARNING**: This operation is irreversible and will permanently delete all DLQ messages.

```bash
# Option 1: Via DLQ Manager API (recommended)
# Delete messages individually via /dlq/message/{id} endpoint

# Option 2: Direct RabbitMQ management (admin only)
docker compose exec rabbitmq rabbitmqctl purge_queue enrichment.dlq.queue -p musicdb
```

### Export DLQ Messages for Analysis

```bash
# Export all messages to JSON
curl http://localhost:8024/dlq/messages?limit=1000 > dlq_export_$(date +%Y%m%d).json

# Analyze with jq
cat dlq_export_20251010.json | jq '.[] | select(.error_type=="spotify") | .error_message' | sort | uniq -c
```

### RabbitMQ Management UI

Access RabbitMQ management interface:

```
http://localhost:15673
Username: musicdb (default)
Password: rabbitmq_secure_pass_2024 (default)
```

Navigate to **Queues** tab to view:
- Queue depth
- Message rates
- Consumer connections

## Performance Considerations

### Message Retention

- **Main DLQ**: 30 days (configurable via `x-message-ttl`)
- **Retry Queue**: 24 hours
- **Analysis Queue**: 7 days
- **Max Queue Length**: 100,000 messages (drops oldest)

### Replay Performance

- **Sequential Replay**: ~10 messages/second (limited by API rate limits)
- **Batch Replay**: Processes messages in parallel (up to 5 concurrent)
- **Recommended Batch Size**: 10-50 messages per batch

### Storage Requirements

Approximate storage per message:
- **Minimal** (no stack trace): ~500 bytes
- **Typical** (with stack trace): ~2 KB
- **Large** (complex items): ~5 KB

Expected storage for 10,000 messages: ~20-50 MB

## Troubleshooting

### DLQ Manager Won't Start

**Check logs**:
```bash
docker compose logs dlq-manager
```

**Common issues**:
1. RabbitMQ not ready
   - Solution: Wait for RabbitMQ health check to pass
   ```bash
   docker compose ps rabbitmq
   ```

2. Invalid RabbitMQ credentials
   - Solution: Verify `RABBITMQ_USER` and `RABBITMQ_PASS` in `.env`

3. Port 8024 already in use
   - Solution: Change port in `docker-compose.yml`

### Messages Not Appearing in DLQ

**Check pipeline logs**:
```bash
docker compose logs scraper-mixesdb | grep -i "dlq"
```

**Verify DLQ client initialization**:
```bash
docker compose logs scraper-mixesdb | grep "DLQ client initialized"
```

**Check RabbitMQ bindings**:
```bash
docker compose exec rabbitmq rabbitmqctl list_bindings -p musicdb | grep dlq
```

### Replay Not Working

**Check retry queue**:
```bash
curl http://localhost:8024/dlq/stats | jq '.queue_stats."enrichment.dlq.retry"'
```

**Verify enrichment pipeline is consuming**:
```bash
# Check for active consumers on retry queue
docker compose exec rabbitmq rabbitmqctl list_consumers -p musicdb | grep dlq.retry
```

## API Reference

### Endpoints

#### `GET /health`
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "service": "dlq-manager",
  "timestamp": "2025-10-10T14:30:00Z",
  "rabbitmq_connected": true
}
```

#### `GET /metrics`
Prometheus metrics endpoint (text/plain format).

#### `GET /dlq/messages`
List DLQ messages with pagination.

**Query Parameters**:
- `limit` (int, 1-1000): Max messages to return (default: 100)
- `offset` (int, >= 0): Number of messages to skip (default: 0)

**Response**: Array of `DLQMessage` objects

#### `GET /dlq/stats`
Get DLQ statistics.

**Response**: `DLQStats` object

#### `POST /dlq/replay/{message_id}`
Replay a specific message.

**Path Parameters**:
- `message_id` (string): UUID of message to replay

**Response**:
```json
{
  "success": true,
  "message": "Message {id} replayed successfully"
}
```

#### `POST /dlq/replay/batch`
Replay multiple messages.

**Request Body**:
```json
{
  "message_ids": ["id1", "id2", "id3"],
  "max_retries": 3
}
```

**Response**: `ReplayResponse` object

#### `DELETE /dlq/message/{message_id}`
Permanently delete a message.

**Path Parameters**:
- `message_id` (string): UUID of message to delete

**Response**:
```json
{
  "success": true,
  "message": "Message {id} permanently deleted"
}
```

#### `GET /dlq/errors/grouped`
Group messages by error type.

**Response**: Array of `ErrorGroup` objects

## Integration with Other Services

### Enrichment Pipeline Integration

The API enrichment pipeline automatically integrates with DLQ:

```python
# In scrapers/pipelines/api_enrichment_pipeline.py

# DLQ client is initialized on startup
self.dlq_client = DLQClient()

# Failures are automatically published after 3 retries
if retry_count >= 3 and last_error and self.dlq_client:
    self.dlq_client.publish_to_dlq(
        item=dict(adapter),
        error=last_error,
        retry_count=retry_count,
        source_service='api-enrichment-pipeline',
        metadata={'spider': spider.name}
    )
```

### Future Integrations

**Planned**:
1. Automatic retry scheduling (exponential backoff)
2. Slack/Discord notifications for critical DLQ depth
3. Machine learning-based error classification
4. Automatic credential rotation on auth failures

## Best Practices

1. **Monitor Regularly**: Check Grafana dashboard daily for DLQ depth trends
2. **Set Alerts**: Configure Prometheus alerts for high DLQ depth (>100 messages)
3. **Replay During Off-Peak**: Schedule bulk replays during low-traffic periods
4. **Analyze Patterns**: Use error grouping to identify systemic issues
5. **Clean Up**: Regularly delete messages that cannot be recovered
6. **Export for Audits**: Periodically export DLQ data for compliance/auditing
7. **Test Replay**: Test replay logic in staging before production use
8. **Document Fixes**: When resolving error patterns, document root cause and solution

## References

- RabbitMQ Quorum Queues: https://www.rabbitmq.com/quorum-queues.html
- FastAPI Documentation: https://fastapi.tiangolo.com
- Prometheus Best Practices: https://prometheus.io/docs/practices/naming/
- Dead Letter Queue Pattern: https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html
