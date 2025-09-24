# Observability Integration for AI-Driven Diagnostics

This module implements three architectural patterns for integrating Prometheus and Grafana metrics with AI command-line interfaces (Claude and Gemini), enabling AI-powered diagnostics and root cause analysis.

## Architecture Overview

### Pattern 1: Event-Driven Webhook (Real-time Alerts)
- **File**: `webhook_listener.py`
- **Port**: 5001
- **Purpose**: Receives real-time alerts from Prometheus Alertmanager
- **Latency**: Seconds
- **Use Case**: Immediate fault notification

### Pattern 2: Scheduled Polling (Comprehensive Health)
- **File**: `scraper.py`
- **Schedule**: Every 15 minutes (configurable)
- **Purpose**: Generates comprehensive health reports with KPIs
- **Use Case**: Trend analysis and overall health monitoring

### Pattern 3: Interactive MCP Server (On-demand Queries)
- **File**: `mcp_server.py`
- **Port**: 8000
- **Purpose**: Provides interactive tool-based API for AI agents
- **Use Case**: Interactive debugging and root cause analysis

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Test Connectivity
```bash
python orchestrator.py --test
```

### 3. Run Individual Patterns

#### Pattern 1: Webhook Listener
```bash
python webhook_listener.py
```

Configure Alertmanager to send webhooks to `http://localhost:5001/webhook`

#### Pattern 2: Scheduled Polling
```bash
python scraper.py --command health
```

For automated scheduling:
```bash
python orchestrator.py --pattern polling --interval 15
```

#### Pattern 3: MCP Server
```bash
python mcp_server.py
```

### 4. Run All Patterns Together
```bash
python orchestrator.py --pattern all
```

## Integration with AI CLIs

### Claude Code CLI

The system automatically updates `CLAUDE.md` with:
- Real-time alerts (from webhook listener)
- System health reports (from scheduled polling)

Configure MCP server in `.claude/settings.json`:
```json
{
  "mcp": {
    "servers": [
      {
        "name": "observability",
        "url": "http://localhost:8000/.well-known/mcp-tools"
      }
    ]
  }
}
```

### Gemini CLI

The system creates separate context files:
- `prometheus_alerts.md` - Real-time alerts
- `system_health.md` - Health reports

Configure MCP server in `.gemini/settings.json`:
```json
{
  "mcpServers": {
    "observability": {
      "url": "http://localhost:8000/.well-known/mcp-tools",
      "trust": false,
      "timeout": 30000
    }
  }
}
```

## Available MCP Tools

When using the MCP server, the following tools are available:

1. **get_active_alerts** - Fetch currently active alerts
2. **query_prometheus** - Execute PromQL queries
3. **get_service_health** - Get health status for a specific service
4. **check_deployments** - Check recent deployments
5. **diagnose_issue** - Run automated diagnostics
6. **get_system_kpis** - Get current Key Performance Indicators

## Example Usage in AI CLI

### Claude Code
```
Based on @prometheus_alerts.md, what services are currently having issues?
```

### Gemini CLI with MCP
```
gemini> Use the observability tools to diagnose why the API gateway is slow
```

### Direct API Access
```bash
# Get health report
curl http://localhost:8000/api/health-report

# Get markdown-formatted report
curl http://localhost:8000/api/health-report/markdown

# Check active alerts via webhook listener
curl http://localhost:5001/alerts
```

## Configuration

### Environment Variables

```bash
# Prometheus configuration
export PROMETHEUS_URL=http://localhost:9091

# Grafana configuration
export GRAFANA_URL=http://localhost:3001
export GRAFANA_USER=admin
export GRAFANA_PASS=admin

# File paths
export CLAUDE_CONTEXT_FILE=CLAUDE.md
export GEMINI_CONTEXT_FILE=system_health.md

# Server ports
export WEBHOOK_PORT=5001
export MCP_SERVER_PORT=8000
```

### Alertmanager Configuration

Add to your `alertmanager.yml`:

```yaml
route:
  receiver: 'default'
  routes:
    - receiver: 'ai-context-webhook'
      match:
        severity: 'critical'
      continue: true

receivers:
  - name: 'ai-context-webhook'
    webhook_configs:
      - url: 'http://host.docker.internal:5001/webhook'
        send_resolved: true
```

## Testing

### Test Webhook
```bash
curl -X POST http://localhost:5001/test
```

### Test MCP Server
```bash
curl http://localhost:8000/health
curl http://localhost:8000/.well-known/mcp-tools
```

### Test Prometheus Scraping
```bash
python scraper.py --command kpis --output json
```

## Monitoring the Monitors

The observability tools themselves expose metrics:

- Webhook listener: `http://localhost:5001/status`
- MCP server: `http://localhost:8000/health`

## Troubleshooting

1. **No metrics showing**: Check Prometheus is accessible on port 9091
2. **No Grafana data**: Verify authentication with `admin:admin`
3. **Webhook not receiving**: Check Alertmanager configuration and network connectivity
4. **MCP tools not available**: Ensure MCP server is running and CLI settings are correct

## Architecture Benefits

### Hybrid Approach
By combining all three patterns, you get:
- **Real-time awareness** (webhooks)
- **Comprehensive context** (polling)
- **Interactive investigation** (MCP)

### AI-Optimized Output
All outputs are formatted for LLM consumption:
- Structured Markdown for context files
- JSON responses for programmatic access
- Human-readable summaries for debugging

### Security Considerations
- PromQL query validation in MCP server
- Read-only access to metrics
- No execution of arbitrary commands
- Rate limiting considerations for production