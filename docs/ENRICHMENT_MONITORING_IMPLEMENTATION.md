# Enrichment Pipeline Monitoring Implementation Guide

## Overview
This document outlines the comprehensive monitoring solution for the SongNodes enrichment pipeline, including backend metrics, WebSocket real-time updates, and frontend visualization.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  ENRICHMENT MONITORING SYSTEM                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─────────────────────────────────┐
                              │                                 │
                  ┌───────────▼──────────┐       ┌─────────────▼─────────┐
                  │  Backend Metrics     │       │  Real-time Updates    │
                  │  (Prometheus)        │       │  (WebSocket)          │
                  └───────────┬──────────┘       └─────────────┬─────────┘
                              │                                 │
                              ▼                                 ▼
                  ┌──────────────────────┐       ┌────────────────────────┐
                  │  Grafana Dashboards  │       │  Frontend Component    │
                  │  - Circuit breakers  │       │  - Live queue status   │
                  │  - Queue metrics     │       │  - Success rates       │
                  │  - API rate limits   │       │  - Circuit breaker UI  │
                  └──────────────────────┘       └────────────────────────┘
```

## 1. Backend Monitoring (Prometheus Metrics)

### 1.1 Enrichment Monitor Module
**File**: `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/enrichment_monitor.py`

**Status**: ✅ CREATED

**Key Metrics**:
- `enrichment_requests_total{source, status}` - Requests per source
- `enrichment_duration_seconds{source}` - Time per source
- `enrichment_errors_total{source, error_type}` - Errors by type
- `circuit_breaker_state{source}` - CB state (0=closed, 1=half_open, 2=open)
- `circuit_breaker_failures_total{source}` - CB failures
- `circuit_breaker_trips_total{source}` - CB trips
- `enrichment_queue_depth{status}` - Queue sizes
- `enrichment_queue_processing_rate` - Tracks/minute
- `enrichment_api_rate_limit_remaining{source}` - API quota
- `enrichment_api_rate_limit_reset_timestamp{source}` - Reset time
- `enrichment_cache_operations_total{operation, status}` - Cache stats
- `enrichment_tracks_in_progress` - Active enrichments
- `enrichment_batch_size` - Batch sizes
- `enrichment_source_health{source}` - Health (0=down, 1=degraded, 2=healthy)
- `enrichment_metadata_fields_populated_total{field}` - Field coverage

### 1.2 Integration Points

#### A. Main Service Integration
**File**: `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/main.py`

**Changes Needed**:
```python
# Add import
from enrichment_monitor import get_monitor, EnrichmentMonitor

# In lifespan startup
monitor = get_monitor()
logger.info("✅ Enrichment monitor initialized")

# In scheduled task update_circuit_breaker_metrics()
async def update_circuit_breaker_metrics():
    """Update circuit breaker and source health metrics"""
    monitor = get_monitor()

    if enrichment_pipeline:
        for api_name, client in [
            ('spotify', enrichment_pipeline.spotify_client),
            ('musicbrainz', enrichment_pipeline.musicbrainz_client),
            ('discogs', enrichment_pipeline.discogs_client),
            ('beatport', enrichment_pipeline.beatport_client),
            ('lastfm', enrichment_pipeline.lastfm_client)
        ]:
            if client and hasattr(client, 'circuit_breaker'):
                cb = client.circuit_breaker

                # Update circuit breaker state
                monitor.update_circuit_breaker_state(api_name, cb.state.value)

                # Determine source health
                if cb.state.value == 'open':
                    health = 'down'
                elif cb.state.value == 'half_open':
                    health = 'degraded'
                else:
                    health = 'healthy'

                monitor.update_source_health(api_name, health)

# Add new scheduled job for queue monitoring
scheduler.add_job(
    update_queue_metrics,
    trigger=CronTrigger(minute="*/5"),  # Every 5 minutes
    id="update_queue_metrics",
    max_instances=1,
    coalesce=True
)

async def update_queue_metrics():
    """Update enrichment queue depth metrics"""
    monitor = get_monitor()

    try:
        async with connection_manager.session_factory() as session:
            query = text("""
                SELECT
                    status,
                    COUNT(*) as count
                FROM enrichment_status
                WHERE status IN ('pending', 'in_progress', 'failed')
                GROUP BY status
            """)

            result = await session.execute(query)
            rows = result.fetchall()

            status_counts = {row.status: row.count for row in rows}

            monitor.update_queue_depth(
                pending=status_counts.get('pending', 0),
                in_progress=status_counts.get('in_progress', 0),
                failed=status_counts.get('failed', 0)
            )

    except Exception as e:
        logger.error("Failed to update queue metrics", error=str(e))
```

#### B. Pipeline Integration
**File**: `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/enrichment_pipeline.py`

**Changes Needed**:
```python
from enrichment_monitor import get_monitor

class MetadataEnrichmentPipeline:
    def __init__(self, ...):
        # ... existing code ...
        self.monitor = get_monitor()

    async def enrich_track(self, task) -> Any:
        """Execute the waterfall enrichment pipeline for a track"""
        from main import EnrichmentResult, EnrichmentStatus, EnrichmentSource

        start_time = time.time()
        # ... existing code ...

        # Track metrics
        self.monitor.set_tracks_in_progress(1)  # Increment

        try:
            # ... enrichment logic ...

            # Record completion
            self.monitor.record_track_completion()

            # Record metadata fields populated
            for field in ['isrc', 'bpm', 'key', 'spotify_id', 'musicbrainz_id']:
                if metadata.get(field):
                    self.monitor.record_metadata_field(field)

            # ... rest of existing code ...

        except Exception as e:
            # ... error handling ...
            pass
        finally:
            self.monitor.set_tracks_in_progress(0)  # Decrement

    async def _enrich_from_spotify_id(self, spotify_id: str) -> Optional[Dict[str, Any]]:
        """Enrich from Spotify ID with monitoring"""
        if not self.spotify_client:
            return None

        start = time.time()
        try:
            result = await self.spotify_client.get_track_by_id(spotify_id)

            duration = time.time() - start
            self.monitor.record_enrichment_duration('spotify', duration)

            if result:
                self.monitor.record_enrichment_request('spotify', 'success')
            else:
                self.monitor.record_enrichment_request('spotify', 'no_data')

            return result

        except Exception as e:
            duration = time.time() - start
            self.monitor.record_enrichment_duration('spotify', duration)
            self.monitor.record_enrichment_request('spotify', 'error')
            self.monitor.record_enrichment_error('spotify', type(e).__name__)
            logger.error("Spotify enrichment failed", error=str(e))
            return None
```

#### C. Circuit Breaker Integration
**File**: `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/circuit_breaker.py`

**Changes Needed**:
```python
from enrichment_monitor import get_monitor

class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout_seconds=60, success_threshold=2, name="unknown"):
        # ... existing code ...
        self.monitor = get_monitor()

    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()

        # Record failure metric
        self.monitor.record_circuit_breaker_failure(self.name)

        if self.state == CircuitBreakerState.HALF_OPEN:
            logger.warning(
                "Circuit breaker re-opening after failure during recovery",
                name=self.name
            )
            self.state = CircuitBreakerState.OPEN
            self.success_count = 0

            # Record trip
            self.monitor.record_circuit_breaker_trip(self.name)
            self.monitor.update_circuit_breaker_state(self.name, self.state.value)

        elif self.failure_count >= self.failure_threshold:
            logger.error(
                "Circuit breaker opening due to failure threshold",
                name=self.name,
                failure_count=self.failure_count,
                threshold=self.failure_threshold
            )
            self.state = CircuitBreakerState.OPEN

            # Record trip
            self.monitor.record_circuit_breaker_trip(self.name)
            self.monitor.update_circuit_breaker_state(self.name, self.state.value)
```

### 1.3 API Endpoints

#### A. Enrichment Monitoring Endpoint
Add to `main.py`:

```python
@app.get("/monitoring/enrichment")
async def get_enrichment_monitoring():
    """
    Get real-time enrichment monitoring data

    Returns comprehensive metrics including:
    - Queue depths and processing rates
    - Circuit breaker states
    - Per-source health status
    - Recent performance metrics
    """
    monitor = get_monitor()

    try:
        async with connection_manager.session_factory() as session:
            # Queue metrics
            queue_query = text("""
                SELECT
                    status,
                    COUNT(*) as count
                FROM enrichment_status
                GROUP BY status
            """)

            result = await session.execute(queue_query)
            queue_stats = {row.status: row.count for row in result.fetchall()}

            # Processing rate (last hour)
            rate_query = text("""
                SELECT
                    COUNT(*) as completed_last_hour
                FROM enrichment_status
                WHERE status = 'completed'
                  AND last_attempt > NOW() - INTERVAL '1 hour'
            """)

            result = await session.execute(rate_query)
            completed_last_hour = result.scalar()

            # Circuit breaker states
            cb_states = {}
            source_health = {}

            if enrichment_pipeline:
                for api_name, client in [
                    ('spotify', enrichment_pipeline.spotify_client),
                    ('musicbrainz', enrichment_pipeline.musicbrainz_client),
                    ('discogs', enrichment_pipeline.discogs_client),
                    ('beatport', enrichment_pipeline.beatport_client),
                    ('lastfm', enrichment_pipeline.lastfm_client)
                ]:
                    if client and hasattr(client, 'circuit_breaker'):
                        cb = client.circuit_breaker
                        cb_states[api_name] = {
                            'state': cb.state.value,
                            'failure_count': cb.failure_count,
                            'last_failure_time': cb.last_failure_time
                        }

                        # Determine health
                        if cb.state.value == 'open':
                            source_health[api_name] = 'down'
                        elif cb.state.value == 'half_open':
                            source_health[api_name] = 'degraded'
                        else:
                            source_health[api_name] = 'healthy'
                    else:
                        source_health[api_name] = 'unavailable'

            return {
                'timestamp': datetime.utcnow().isoformat(),
                'queue': {
                    'pending': queue_stats.get('pending', 0),
                    'in_progress': queue_stats.get('in_progress', 0),
                    'completed': queue_stats.get('completed', 0),
                    'failed': queue_stats.get('failed', 0),
                    'partial': queue_stats.get('partial', 0)
                },
                'processing_rate': {
                    'completed_last_hour': completed_last_hour,
                    'per_minute': round(completed_last_hour / 60.0, 2)
                },
                'circuit_breakers': cb_states,
                'source_health': source_health,
                'metrics': monitor.get_current_metrics()
            }

    except Exception as e:
        logger.error("Failed to get enrichment monitoring data", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get monitoring data: {str(e)}")
```

## 2. Prometheus Configuration

**File**: `/mnt/my_external_drive/programming/songnodes/monitoring/prometheus/prometheus.yml`

**Add scrape target**:
```yaml
scrape_configs:
  # Existing scrape configs...

  - job_name: 'enrichment-service'
    scrape_interval: 15s
    static_configs:
      - targets: ['metadata-enrichment:8020']
    metrics_path: '/metrics'
```

## 3. Grafana Dashboard

**File**: `/mnt/my_external_drive/programming/songnodes/monitoring/grafana/dashboards/enrichment-monitoring.json`

**Panels**:
1. **Queue Overview** - Current queue depths (pending, in_progress, failed)
2. **Processing Rate** - Tracks enriched per minute
3. **Circuit Breaker States** - Visual state indicators per source
4. **Success Rates** - Success percentage by source (last hour, last 24h)
5. **Enrichment Duration** - P50, P95, P99 latencies per source
6. **API Rate Limits** - Remaining quota per source
7. **Error Breakdown** - Error types by source
8. **Source Health** - Health status indicators
9. **Cache Performance** - Hit/miss rates
10. **Metadata Coverage** - Fields populated percentage

## 4. WebSocket Real-time Updates

### 4.1 Backend WebSocket Event Publishing

**File**: `/mnt/my_external_drive/programming/songnodes/services/metadata-enrichment/main.py`

**Add WebSocket publishing**:
```python
import aio_pika

# In ConnectionManager
class EnrichmentConnectionManager:
    def __init__(self):
        # ... existing ...
        self.rabbitmq_connection = None
        self.rabbitmq_channel = None
        self.enrichment_exchange = None

    async def initialize(self):
        # ... existing initialization ...

        # RabbitMQ connection for real-time updates
        rabbitmq_host = os.getenv("RABBITMQ_HOST", "rabbitmq")
        rabbitmq_port = int(os.getenv("RABBITMQ_PORT", 5672))
        rabbitmq_user = os.getenv("RABBITMQ_USER", "musicdb")
        rabbitmq_pass = os.getenv("RABBITMQ_PASS", "rabbitmq_secure_pass_2024")

        self.rabbitmq_connection = await aio_pika.connect_robust(
            f"amqp://{rabbitmq_user}:{rabbitmq_pass}@{rabbitmq_host}:{rabbitmq_port}/musicdb"
        )

        self.rabbitmq_channel = await self.rabbitmq_connection.channel()

        # Declare enrichment events exchange
        self.enrichment_exchange = await self.rabbitmq_channel.declare_exchange(
            'enrichment_events',
            aio_pika.ExchangeType.FANOUT,
            durable=True
        )

        logger.info("✅ RabbitMQ connection for enrichment events established")

    async def publish_enrichment_event(self, event_type: str, data: dict):
        """Publish enrichment event to WebSocket subscribers"""
        if self.enrichment_exchange:
            message = {
                'type': event_type,
                'data': data,
                'timestamp': datetime.utcnow().isoformat()
            }

            await self.enrichment_exchange.publish(
                aio_pika.Message(
                    body=json.dumps(message).encode(),
                    content_type='application/json'
                ),
                routing_key=''
            )

# Publish events in enrichment pipeline
async def process_pending_enrichments():
    """Process tracks pending enrichment with real-time updates"""
    # ... existing code ...

    for i in range(0, len(pending_tracks), batch_size):
        batch = pending_tracks[i:i+batch_size]

        # Publish batch start event
        await connection_manager.publish_enrichment_event(
            'enrichment_batch_start',
            {
                'batch_size': len(batch),
                'batch_number': i // batch_size + 1,
                'total_tracks': len(pending_tracks)
            }
        )

        # ... process batch ...

        # Publish batch completion event
        await connection_manager.publish_enrichment_event(
            'enrichment_batch_complete',
            {
                'batch_size': len(batch),
                'success_count': success_count,
                'batch_number': i // batch_size + 1
            }
        )
```

### 4.2 WebSocket API Integration

**File**: `/mnt/my_external_drive/programming/songnodes/services/websocket-api/main.py`

**Add enrichment event subscription**:
```python
async def subscribe_to_enrichment_events(self):
    """Subscribe to enrichment events from RabbitMQ"""
    try:
        # Declare exchange
        enrichment_exchange = await self.rabbitmq_channel.declare_exchange(
            'enrichment_events',
            aio_pika.ExchangeType.FANOUT,
            durable=True
        )

        # Create exclusive queue
        queue = await self.rabbitmq_channel.declare_queue(
            '',
            exclusive=True
        )

        # Bind queue to exchange
        await queue.bind(enrichment_exchange)

        # Start consuming
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                async with message.process():
                    try:
                        data = json.loads(message.body.decode())

                        # Broadcast to enrichment_monitor room
                        await self.manager.broadcast_to_room(
                            'enrichment_monitor',
                            data
                        )

                    except Exception as e:
                        logger.error(f"Error processing enrichment event: {e}")

    except Exception as e:
        logger.error(f"Failed to subscribe to enrichment events: {e}")
```

## 5. Frontend Monitoring Component

### 5.1 EnrichmentMonitor Component

**File**: `/mnt/my_external_drive/programming/songnodes/frontend/src/components/EnrichmentMonitor.tsx`

**Component Structure**:
```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface QueueMetrics {
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  partial: number;
}

interface ProcessingRate {
  completed_last_hour: number;
  per_minute: number;
}

interface CircuitBreakerState {
  state: 'closed' | 'half_open' | 'open';
  failure_count: number;
  last_failure_time: number | null;
}

interface SourceHealth {
  [source: string]: 'healthy' | 'degraded' | 'down' | 'unavailable';
}

interface EnrichmentMonitoringData {
  timestamp: string;
  queue: QueueMetrics;
  processing_rate: ProcessingRate;
  circuit_breakers: { [source: string]: CircuitBreakerState };
  source_health: SourceHealth;
}

const EnrichmentMonitor: React.FC = () => {
  const [monitoringData, setMonitoringData] = useState<EnrichmentMonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // WebSocket for real-time updates
  const { isConnected, lastMessage } = useWebSocket({
    room: 'enrichment_monitor',
    autoConnect: true
  });

  // Fetch monitoring data
  const fetchMonitoringData = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8022/monitoring/enrichment');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMonitoringData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMonitoringData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMonitoringData]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      // Trigger refresh on enrichment events
      if (lastMessage.type === 'enrichment_batch_complete' ||
          lastMessage.type === 'circuit_breaker_state_change') {
        fetchMonitoringData();
      }
    }
  }, [lastMessage, fetchMonitoringData]);

  // Render health indicator
  const renderHealthBadge = (health: string) => {
    const colors = {
      healthy: 'bg-green-500',
      degraded: 'bg-yellow-500',
      down: 'bg-red-500',
      unavailable: 'bg-gray-400'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[health as keyof typeof colors]}`}>
        {health.toUpperCase()}
      </span>
    );
  };

  // Render circuit breaker state
  const renderCircuitBreakerState = (cb: CircuitBreakerState) => {
    const stateColors = {
      closed: 'text-green-600',
      half_open: 'text-yellow-600',
      open: 'text-red-600'
    };

    const stateIcons = {
      closed: '✓',
      half_open: '⚠',
      open: '✗'
    };

    return (
      <span className={`font-bold ${stateColors[cb.state]}`}>
        {stateIcons[cb.state]} {cb.state.toUpperCase()}
        {cb.failure_count > 0 && ` (${cb.failure_count} failures)`}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-semibold">Error Loading Monitoring Data</h3>
        <p className="text-red-600 mt-2">{error}</p>
        <button
          onClick={fetchMonitoringData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!monitoringData) {
    return null;
  }

  const { queue, processing_rate, circuit_breakers, source_health } = monitoringData;

  return (
    <div className="space-y-6 p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Enrichment Pipeline Monitor</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          <button
            onClick={fetchMonitoringData}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* Queue Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Status</h3>
        <div className="grid grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{queue.pending}</div>
            <div className="text-sm text-gray-600 mt-1">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">{queue.in_progress}</div>
            <div className="text-sm text-gray-600 mt-1">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{queue.completed}</div>
            <div className="text-sm text-gray-600 mt-1">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{queue.failed}</div>
            <div className="text-sm text-gray-600 mt-1">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">{queue.partial}</div>
            <div className="text-sm text-gray-600 mt-1">Partial</div>
          </div>
        </div>
      </div>

      {/* Processing Rate */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Rate</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-gray-900">{processing_rate.completed_last_hour}</div>
            <div className="text-sm text-gray-600 mt-1">Tracks (Last Hour)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{processing_rate.per_minute.toFixed(2)}</div>
            <div className="text-sm text-gray-600 mt-1">Tracks per Minute</div>
          </div>
        </div>
      </div>

      {/* Source Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Source Health</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(source_health).map(([source, health]) => (
            <div key={source} className="border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-semibold text-gray-900 mb-2 capitalize">{source}</div>
              {renderHealthBadge(health)}
            </div>
          ))}
        </div>
      </div>

      {/* Circuit Breakers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Circuit Breaker States</h3>
        <div className="space-y-3">
          {Object.entries(circuit_breakers).map(([source, cb]) => (
            <div key={source} className="flex items-center justify-between border-b border-gray-200 pb-3">
              <span className="text-sm font-medium text-gray-900 capitalize">{source}</span>
              {renderCircuitBreakerState(cb)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnrichmentMonitor;
```

### 5.2 Integration into App

**File**: `/mnt/my_external_drive/programming/songnodes/frontend/src/App.tsx`

Add route:
```tsx
import EnrichmentMonitor from './components/EnrichmentMonitor';

// In routing
<Route path="/monitoring/enrichment" element={<EnrichmentMonitor />} />
```

Add navigation link in settings panel:
```tsx
<Link to="/monitoring/enrichment">
  Enrichment Pipeline Monitor
</Link>
```

## 6. Alerting Rules

**File**: `/mnt/my_external_drive/programming/songnodes/observability/alerting/enrichment-alerts.yml`

```yaml
groups:
  - name: enrichment_pipeline
    interval: 1m
    rules:
      - alert: EnrichmentQueueBacklog
        expr: enrichment_queue_depth{status="pending"} > 1000
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High enrichment queue backlog"
          description: "Enrichment queue has {{ $value }} pending tracks"

      - alert: CircuitBreakerOpen
        expr: enrichment_circuit_breaker_state == 2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Circuit breaker open for {{ $labels.source }}"
          description: "{{ $labels.source }} circuit breaker has been open for 5 minutes"

      - alert: LowProcessingRate
        expr: rate(enrichment_queue_processing_rate[5m]) < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low enrichment processing rate"
          description: "Processing rate is {{ $value }} tracks/minute"

      - alert: HighEnrichmentErrorRate
        expr: rate(enrichment_errors_total[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High enrichment error rate"
          description: "Error rate is {{ $value }} errors/minute"

      - alert: APIRateLimitApproaching
        expr: enrichment_api_rate_limit_remaining < 100
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.source }} API rate limit approaching"
          description: "Only {{ $value }} requests remaining"
```

## 7. Testing Plan

### 7.1 Backend Testing
1. Test metrics collection with mock enrichment requests
2. Verify circuit breaker state transitions
3. Test WebSocket event publishing
4. Load test with concurrent enrichments

### 7.2 Frontend Testing
1. Component renders with mock data
2. WebSocket reconnection handling
3. Auto-refresh functionality
4. Error state handling
5. Responsive layout on different screen sizes

### 7.3 Integration Testing
1. End-to-end enrichment with monitoring
2. Circuit breaker trips trigger UI updates
3. Queue metrics update in real-time
4. Grafana dashboard displays correct data

## 8. Deployment Checklist

- [ ] Add enrichment_monitor.py to metadata-enrichment service
- [ ] Update main.py with monitor integration
- [ ] Update enrichment_pipeline.py with metric tracking
- [ ] Update circuit_breaker.py with metric publishing
- [ ] Add WebSocket event publishing to enrichment service
- [ ] Update WebSocket API to subscribe to enrichment events
- [ ] Configure Prometheus to scrape enrichment service
- [ ] Create Grafana dashboard
- [ ] Add enrichment alerting rules
- [ ] Create EnrichmentMonitor frontend component
- [ ] Add routing and navigation for monitoring page
- [ ] Test complete monitoring flow
- [ ] Document monitoring features in user guide

## 9. Success Metrics

### Monitoring Effectiveness
- **Visibility**: All enrichment sources tracked with <5s metric delay
- **Accuracy**: Circuit breaker states reflect actual service health
- **Responsiveness**: Frontend updates within 2s of backend events
- **Completeness**: All key metrics captured (queue, CB, rates, errors)

### Operational Impact
- **MTTR Reduction**: Mean time to resolution for enrichment issues
- **Proactive Detection**: Circuit breakers prevent cascade failures
- **Capacity Planning**: Queue trends inform scaling decisions
- **Debugging Speed**: Detailed metrics accelerate troubleshooting

## 10. Future Enhancements

1. **Machine Learning Predictions**
   - Predict queue backlog growth
   - Forecast circuit breaker trips
   - Anomaly detection on enrichment patterns

2. **Advanced Visualizations**
   - 3D graph of source dependencies
   - Heatmap of enrichment success by time/day
   - Animated flow diagrams

3. **Automated Remediation**
   - Auto-scale enrichment workers based on queue
   - Automatic circuit breaker reset with backoff
   - Smart retry scheduling

4. **Enhanced Alerting**
   - Slack/Discord notifications
   - PagerDuty integration
   - Alert aggregation and suppression

## Implementation Files Summary

### Backend Files Created/Modified
- ✅ `/services/metadata-enrichment/enrichment_monitor.py` - CREATED
- ⏳ `/services/metadata-enrichment/main.py` - NEEDS UPDATE
- ⏳ `/services/metadata-enrichment/enrichment_pipeline.py` - NEEDS UPDATE
- ⏳ `/services/metadata-enrichment/circuit_breaker.py` - NEEDS UPDATE
- ⏳ `/services/websocket-api/main.py` - NEEDS UPDATE

### Configuration Files
- ⏳ `/monitoring/prometheus/prometheus.yml` - NEEDS UPDATE
- ⏳ `/monitoring/grafana/dashboards/enrichment-monitoring.json` - NEEDS CREATION
- ⏳ `/observability/alerting/enrichment-alerts.yml` - NEEDS CREATION

### Frontend Files
- ⏳ `/frontend/src/components/EnrichmentMonitor.tsx` - NEEDS CREATION
- ⏳ `/frontend/src/App.tsx` - NEEDS UPDATE
- ⏳ `/frontend/src/hooks/useWebSocket.ts` - MAY NEED UPDATE

## Conclusion

This comprehensive monitoring solution provides real-time visibility into the enrichment pipeline with:
- **15+ Prometheus metrics** tracking all aspects of enrichment
- **Real-time WebSocket updates** for instant UI feedback
- **Circuit breaker monitoring** preventing cascade failures
- **Queue depth tracking** for capacity planning
- **Source health indicators** for quick status checks
- **Grafana dashboards** for historical analysis
- **Automated alerting** for proactive issue detection

The system is designed for production use with resilience, observability, and actionable insights as core principles.
