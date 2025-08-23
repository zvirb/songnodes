# Enhanced Visualization Service - Comprehensive Monitoring Setup

This document describes the complete monitoring and observability setup for the Enhanced Visualization Service in the SongNodes platform.

## 🎯 Overview

The Enhanced Visualization Service monitoring provides comprehensive observability across multiple layers:
- **Real-time Metrics**: Prometheus collection with custom metrics
- **Visualization**: Grafana dashboards for real-time monitoring
- **Alerting**: Intelligent alerts for proactive issue detection
- **Log Aggregation**: Elasticsearch/Kibana for centralized logging
- **Performance Monitoring**: WebSocket, database, and rendering metrics

## 📊 Monitoring Components

### 1. Prometheus Metrics Collection

#### Service Port: `8085`
#### Metrics Endpoint: `/metrics`

**Key Metrics Categories:**

- **HTTP Requests**
  - `http_requests_total`: Total HTTP requests by method, route, and status
  - `http_request_duration_seconds`: Request duration histograms

- **WebSocket Connections**
  - `websocket_connections_active`: Current active connections
  - `websocket_connections_total`: Total connections established
  - `websocket_disconnections_total`: Disconnections by reason
  - `websocket_messages_sent_total/received_total`: Message throughput
  - `websocket_message_size_bytes`: Message size distribution

- **Visualization Performance**
  - `graph_render_duration_seconds`: Graph rendering time histograms
  - `graph_nodes_rendered_total/graph_edges_rendered_total`: Rendering throughput
  - `visualization_sessions_active`: Active visualization sessions
  - `visualization_session_duration_seconds`: Session duration

- **System Resources**
  - `memory_usage_bytes`: Memory usage by type (heap, RSS, etc.)
  - `event_loop_lag_seconds`: Node.js event loop lag
  - `cpu_usage_percent`: CPU utilization

- **Database & Cache**
  - `database_connections_active`: Active database connections
  - `database_query_duration_seconds`: Query performance
  - `redis_connections_active`: Redis connections
  - `redis_operation_duration_seconds`: Redis operation times
  - `cache_operations_total`: Cache hit/miss rates

### 2. Grafana Dashboard

#### Dashboard ID: `enhanced-viz-dashboard`
#### Access: `http://localhost:3001/d/enhanced-viz-dashboard`

**Dashboard Panels:**
- Real-time Connections & Sessions
- WebSocket Connection Gauge
- Service Status Indicator
- HTTP Request Rate & Response Times
- WebSocket Message Activity
- Graph Rendering Performance
- Memory Usage & Event Loop Lag
- Database & Cache Connections
- Error Rates

### 3. Alert Rules

#### Configuration: `/monitoring/prometheus/alerts/enhanced-visualization-alerts.yml`

**Critical Alerts:**
- Service Down (30s)
- Critical Memory Usage (>95%)
- WebSocket Connections at Capacity (>9500)
- WebSocket Error Spike (>50 errors/5min)
- Critical Graph Rendering Performance (>5s)
- Database/Redis Connection Issues

**Warning Alerts:**
- High Memory Usage (>85%)
- High WebSocket Connections (>8000)
- Slow Graph Rendering (>1s)
- High HTTP Error Rate (>5%)
- Low Cache Hit Rate (<70%)

### 4. Log Aggregation (Elasticsearch)

#### Components:
- **Elasticsearch**: Index and search logs
- **Filebeat**: Ship logs from containers
- **Kibana**: Log visualization and analysis
- **Logstash Pipeline**: Process and enrich logs

#### Index Pattern: `enhanced-visualization-service-*`
#### Retention: 30 days with ILM policy

**Log Processing Pipeline:**
1. Parse structured JSON logs
2. Extract HTTP, WebSocket, and database events
3. Add performance categorization
4. GeoIP enrichment for client IPs
5. User agent parsing
6. Security event classification

## 🚀 Quick Start

### 1. Start Monitoring Stack

```bash
# Start the complete monitoring stack
cd /home/marku/Documents/programming/songnodes/services/enhanced-visualization-service
docker-compose -f docker-compose.monitoring.yml up -d

# Set up Elasticsearch pipelines and policies
cd /home/marku/Documents/programming/songnodes/monitoring/elasticsearch
./setup-elasticsearch.sh
```

### 2. Validate Setup

```bash
# Run comprehensive monitoring validation
cd /home/marku/Documents/programming/songnodes/monitoring
./validate-enhanced-visualization-monitoring.sh
```

### 3. Access Dashboards

- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9091
- **Kibana**: http://localhost:5601
- **Service Health**: http://localhost:8085/health
- **Service Metrics**: http://localhost:8085/metrics

## ⚙️ Configuration

### Environment Variables

```bash
# Enhanced Visualization Service
NODE_ENV=production
PORT=8085
ENABLE_METRICS=true

# Elasticsearch Integration
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme

# Service Configuration
SERVICE_VERSION=1.0.0
LOG_LEVEL=info
```

### Prometheus Configuration

The service is configured as a scrape target in `/monitoring/prometheus/prometheus.yml`:

```yaml
- job_name: 'enhanced-visualization-service'
  static_configs:
    - targets: ['enhanced-visualization-service:8085']
  scrape_interval: 10s
  metrics_path: /metrics
```

### Filebeat Configuration

Located at `/services/enhanced-visualization-service/filebeat.yml`:
- Collects container logs
- Ships to Elasticsearch
- Applies structured parsing
- Includes service metadata

## 📈 Performance Targets

### SLA Targets:
- **Availability**: 99.9%
- **HTTP Response Time**: <200ms (95th percentile)
- **Graph Rendering**: <100ms for <1000 nodes
- **WebSocket Latency**: <50ms
- **Memory Usage**: <1GB under normal load

### Capacity Limits:
- **WebSocket Connections**: 10,000 max
- **Concurrent Visualizations**: 500 max
- **Database Connections**: 20 max
- **Memory Limit**: 2GB

## 🔧 Troubleshooting

### Common Issues

1. **Service Not Being Scraped by Prometheus**
   ```bash
   # Check service health
   curl http://localhost:8085/health
   
   # Check metrics endpoint
   curl http://localhost:8085/metrics
   
   # Check Prometheus targets
   curl http://localhost:9091/api/v1/targets
   ```

2. **High Memory Usage**
   ```bash
   # Check memory metrics
   curl -s "http://localhost:9091/api/v1/query?query=memory_usage_bytes{type=\"heapUsed\"}"
   
   # Review memory allocation patterns in logs
   # Consider garbage collection tuning
   ```

3. **WebSocket Connection Issues**
   ```bash
   # Check WebSocket metrics
   curl -s "http://localhost:9091/api/v1/query?query=websocket_connections_active"
   
   # Review WebSocket error logs in Kibana
   # Check connection limits and timeouts
   ```

4. **Slow Graph Rendering**
   ```bash
   # Check rendering performance
   curl -s "http://localhost:9091/api/v1/query?query=histogram_quantile(0.95, rate(graph_render_duration_seconds_bucket[5m]))"
   
   # Analyze rendering patterns by node count
   # Consider graph algorithm optimization
   ```

### Log Analysis Queries (Kibana)

```json
# High-level service overview
{
  "query": {
    "bool": {
      "filter": [
        {"term": {"service.name": "enhanced-visualization-service"}},
        {"range": {"@timestamp": {"gte": "now-1h"}}}
      ]
    }
  }
}

# WebSocket activity
{
  "query": {
    "bool": {
      "filter": [
        {"term": {"event_type": "websocket"}},
        {"range": {"@timestamp": {"gte": "now-15m"}}}
      ]
    }
  }
}

# Performance issues
{
  "query": {
    "bool": {
      "filter": [
        {"term": {"performance_category": "slow"}},
        {"range": {"@timestamp": {"gte": "now-30m"}}}
      ]
    }
  }
}

# Error analysis
{
  "query": {
    "bool": {
      "filter": [
        {"term": {"level": "error"}},
        {"range": {"@timestamp": {"gte": "now-1h"}}}
      ]
    }
  },
  "aggs": {
    "error_types": {
      "terms": {"field": "message.keyword"}
    }
  }
}
```

## 🔄 Maintenance

### Daily Tasks
- Review alert notifications
- Check dashboard for anomalies
- Verify log ingestion rates

### Weekly Tasks
- Analyze performance trends
- Review capacity metrics
- Update alert thresholds if needed

### Monthly Tasks
- Elasticsearch index cleanup
- Performance baseline updates
- Monitoring infrastructure updates

## 📋 Metrics Reference

### HTTP Metrics
```
http_requests_total{method,route,status_code}
http_request_duration_seconds{method,route,status_code}
```

### WebSocket Metrics
```
websocket_connections_active
websocket_connections_total
websocket_disconnections_total{reason}
websocket_messages_sent_total{type}
websocket_messages_received_total{type}
websocket_message_size_bytes{direction,type}
```

### Visualization Metrics
```
graph_render_duration_seconds{type,node_count_range}
graph_nodes_rendered_total{type}
graph_edges_rendered_total{type}
visualization_sessions_active
visualization_session_duration_seconds
```

### System Metrics
```
memory_usage_bytes{type}
cpu_usage_percent
event_loop_lag_seconds
service_uptime_seconds
```

### Database Metrics
```
database_connections_active
database_query_duration_seconds{operation,table}
database_queries_total{operation,table,status}
```

### Cache Metrics
```
redis_connections_active
redis_operation_duration_seconds{operation}
redis_operations_total{operation,status}
cache_operations_total{type,result}
```

## 🔗 Related Documentation

- [Prometheus Configuration](./prometheus/prometheus.yml)
- [Grafana Dashboard](./grafana/dashboards/enhanced-visualization-dashboard.json)
- [Alert Rules](./prometheus/alerts/enhanced-visualization-alerts.yml)
- [Elasticsearch Setup](./elasticsearch/setup-elasticsearch.sh)
- [Validation Script](./validate-enhanced-visualization-monitoring.sh)

## 🆘 Support

For monitoring issues:
1. Run the validation script
2. Check service logs in Kibana
3. Review Grafana dashboards
4. Verify Prometheus targets
5. Check alert manager for notifications

The monitoring setup provides comprehensive observability for the Enhanced Visualization Service, enabling proactive performance management and rapid issue resolution.