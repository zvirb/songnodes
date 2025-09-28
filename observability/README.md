# SongNodes Observability Stack

Modern observability implementation for SongNodes using OpenTelemetry, Prometheus, Grafana, Loki, and Tempo.

## Overview

This observability stack replaces the previous Elasticsearch-based logging with a modern, cloud-native approach following 2025 best practices:

- **OpenTelemetry Collector**: Unified telemetry collection and processing
- **Prometheus**: Metrics collection and storage
- **Grafana**: Unified dashboards for metrics, logs, and traces
- **Loki**: Log aggregation and search
- **Tempo**: Distributed tracing
- **Alertmanager**: Intelligent alert routing and notification

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SongNodes     │    │ OpenTelemetry    │    │   Prometheus    │
│   Services      │───▶│   Collector      │───▶│   (Metrics)     │
│ (Scrapers, APIs)│    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │      Loki        │    │     Tempo       │
                       │     (Logs)       │    │   (Traces)      │
                       └──────────────────┘    └─────────────────┘
                                │                        │
                                └────────┬───────────────┘
                                         ▼
                                ┌──────────────────┐
                                │     Grafana      │
                                │   (Dashboards)   │
                                └──────────────────┘
```

## Features

### 🔍 **Comprehensive Monitoring**
- **Metrics**: Scraper performance, database operations, API latency
- **Logs**: Structured JSON logging with correlation IDs
- **Traces**: Distributed tracing across services
- **Alerts**: Intelligent alerting with context-aware routing

### 🚀 **Performance Optimizations**
- **OTLP Protocol**: Efficient telemetry transport
- **Batch Processing**: Optimized data collection
- **Correlation IDs**: Request tracking across services
- **Sampling**: Configurable trace sampling rates

### 🧠 **Intelligent Insights**
- **LLM Adaptation Tracking**: Monitor Ollama selector adaptations
- **Data Quality Metrics**: Track duplicate rates and data freshness
- **Target Track Matching**: Monitor matching efficiency
- **Error Pattern Analysis**: Automated error categorization

## Quick Start

### 1. Start the Observability Stack

```bash
# Start all services including observability
docker compose up -d

# Verify all services are healthy
python3 observability/validate-stack.py
```

### 2. Access Dashboards

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9091
- **Alertmanager**: http://localhost:9093

### 3. View SongNodes Pipeline Dashboard

Navigate to Grafana → Dashboards → SongNodes → "SongNodes Data Pipeline Monitoring"

## Integration

### Adding Observability to Your Service

```python
from observability.logger import get_logger, trace_operation

# Initialize logger
logger = get_logger("my-service")

# Automatic tracing with decorator
@trace_operation("my_operation", "my-service")
def my_function():
    # Function automatically traced
    logger.info("Function executed", key="value")

# Manual span management
with logger.operation_span("complex_operation") as span:
    # Your code here
    span.set_attribute("custom_attribute", "value")
```

### Structured Logging

All logs are automatically structured in JSON format:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "info",
  "service": "scraper-1001tracklists",
  "message": "Successfully scraped playlist",
  "scraper_name": "1001tracklists",
  "tracks_found": 25,
  "response_time_ms": 1250,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "span_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

## Configuration

### OpenTelemetry Collector

Configuration: `observability/otel-collector-config.yaml`

Key features:
- OTLP receivers for gRPC and HTTP
- Prometheus scraping from services
- Docker stats collection
- Log file parsing with JSON support
- Batch processing and memory limiting

### Grafana Datasources

- **Prometheus**: Metrics with exemplar support
- **Loki**: Logs with trace correlation
- **Tempo**: Traces with service maps

### Alert Rules

Comprehensive alerting covers:
- **Scraper Performance**: Error rates, low activity, LLM adaptations
- **Database Operations**: Query latency, connection pool usage
- **System Health**: CPU, memory, service availability
- **Data Quality**: Duplicate rates, data volume anomalies

## Dashboards

### SongNodes Pipeline Monitoring

- **System Overview**: Activity distribution, total tracks discovered
- **Scraper Performance**: Request rates, success rates, error tracking
- **Database Operations**: Query rates, latency percentiles
- **LLM Integration**: Adaptation rates, model usage
- **Error Tracking**: Error distribution, recent error logs

## Alerting

### Alert Severity Levels

- **Critical**: Service outages, database failures (immediate notification)
- **Warning**: Performance degradation, high error rates (2-5 min delay)
- **Info**: Informational events, batched summaries (15+ min delay)

### Notification Channels

- **Email**: Team-specific routing based on component
- **Webhooks**: Slack/Discord integration for critical alerts
- **Runbooks**: Automated links to troubleshooting guides

### Intelligent Routing

- **Team-based**: Alerts routed to appropriate teams
- **Inhibition Rules**: Reduce alert noise with smart filtering
- **Escalation**: Critical alerts escalate if not acknowledged

## Monitoring Best Practices

### 1. Correlation IDs
Every request gets a unique correlation ID for tracking across services:

```python
# Automatic correlation ID generation
logger = get_logger("my-service")
correlation_id = logger.set_correlation_id()

# Manual correlation ID
with request_context(correlation_id="custom-id", service_name="my-service") as logger:
    logger.info("Request processed")
```

### 2. Structured Metadata
Include relevant context in all log entries:

```python
logger.log_scraper_success(
    scraper_name="1001tracklists",
    url="https://example.com/playlist",
    tracks_found=25,
    response_time_ms=1250,
    user_agent="SongNodes/1.0",
    playlist_type="festival_set"
)
```

### 3. Error Context
Provide actionable error information:

```python
logger.log_scraper_error(
    scraper_name="mixesdb",
    url="https://example.com/mix",
    error="Selector not found: .track-list",
    status_code=200,
    html_length=15420,
    llm_adaptation_attempted=True
)
```

## Troubleshooting

### Common Issues

#### 1. OTel Collector Not Receiving Data
```bash
# Check collector health
curl http://localhost:13133

# Check collector metrics
curl http://localhost:8889/metrics | grep otelcol_receiver
```

#### 2. Grafana Datasources Not Working
```bash
# Verify datasource connectivity
docker compose logs grafana

# Check Prometheus targets
curl http://localhost:9091/api/v1/targets
```

#### 3. Loki Not Ingesting Logs
```bash
# Check Loki readiness
curl http://localhost:3100/ready

# Test log ingestion
curl -X POST http://localhost:3100/loki/api/v1/push \
  -H "Content-Type: application/json" \
  -d '{"streams":[{"stream":{"job":"test"},"values":[["'$(date +%s%N)'","test log"]]}]}'
```

### Validation Script

Run comprehensive validation:

```bash
cd observability/
python3 validate-stack.py
```

This script:
- Tests all service endpoints
- Verifies data flow between components
- Generates sample observability data
- Provides detailed health report

## Performance Tuning

### Resource Allocation

Default resource limits (adjust based on load):

```yaml
# High-throughput configuration
otel-collector:
  memory: 2G
  cpu: 2.0

prometheus:
  memory: 4G
  retention: 60d

loki:
  memory: 2G
  retention: 30d
```

### Sampling Configuration

Adjust trace sampling based on volume:

```yaml
# otel-collector-config.yaml
probabilistic_sampler:
  sampling_percentage: 10  # Sample 10% in production
```

## Migration from Elasticsearch

This implementation replaces the previous Elasticsearch + Kibana setup:

### Removed Services
- Elasticsearch (port 9201)
- Kibana (port 5602)

### New Services
- OpenTelemetry Collector (ports 4317, 4318, 8889, 13133)
- Loki (port 3100)
- Tempo (port 3200)
- Promtail (log shipping)
- Alertmanager (port 9093)

### Data Migration
Log data is not migrated from Elasticsearch. Historical logs remain accessible in the old system until the retention period expires.

## Contributing

### Adding New Metrics

1. Add metric definition in `observability/logger.py`:
```python
self.my_new_metric = self.meter.create_counter(
    "my_new_metric_total",
    description="Description of my metric"
)
```

2. Use in your service:
```python
logger.my_new_metric.add(1, {"label": "value"})
```

3. Add to Prometheus configuration for scraping
4. Create Grafana dashboard panel
5. Add relevant alerts if needed

### Adding New Dashboards

1. Create dashboard JSON in `observability/grafana-dashboards/`
2. Add to dashboard configuration in `dashboard-config.yaml`
3. Test with validation script

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Run the validation script for diagnostic information
3. Review service logs: `docker compose logs [service-name]`
4. Consult the Grafana dashboards for system health