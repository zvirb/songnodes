#!/usr/bin/env python3
"""
Observability Scraper for AI-Driven Diagnostics
Integrates Prometheus and Grafana metrics with Claude/Gemini CLIs
"""

import os
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from enum import Enum
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of metrics we can collect"""
    HEALTH = "health"
    PERFORMANCE = "performance"
    ERROR = "error"
    DEPLOYMENT = "deployment"
    ALERT = "alert"


class ObservabilityScraper:
    """
    Main scraper class for collecting metrics from Prometheus and Grafana
    Implements Pattern 2 from the reference architecture (Pull-based)
    """

    def __init__(self):
        # Configuration from environment or defaults
        self.prometheus_url = os.getenv('PROMETHEUS_URL', 'http://localhost:9091')
        self.grafana_url = os.getenv('GRAFANA_URL', 'http://localhost:3001')
        self.grafana_user = os.getenv('GRAFANA_USER', 'admin')
        self.grafana_pass = os.getenv('GRAFANA_PASS', 'admin')

        # Cache for storing recent metrics
        self.metrics_cache = {}
        self.last_update = None

        # Key Performance Indicators to track
        self.kpi_queries = {
            "service_health": {
                "query": "up",
                "description": "Service availability status"
            },
            "api_error_rate": {
                "query": 'sum(rate(http_requests_total{status=~"5.."}[5m])) by (job)',
                "description": "5xx error rate by service"
            },
            "p95_latency": {
                "query": 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, job))',
                "description": "95th percentile request latency"
            },
            "cpu_usage": {
                "query": 'rate(process_cpu_seconds_total[5m]) * 100',
                "description": "CPU usage percentage"
            },
            "memory_usage": {
                "query": 'process_resident_memory_bytes / 1024 / 1024',
                "description": "Memory usage in MB"
            },
            "active_alerts": {
                "query": 'ALERTS{alertstate="firing"}',
                "description": "Currently firing alerts"
            },
            "database_connections": {
                "query": 'pg_stat_database_numbackends{datname="musicdb"}',
                "description": "Active database connections"
            },
            "websocket_connections": {
                "query": 'websocket_active_connections',
                "description": "Active WebSocket connections"
            },
            "graph_render_time": {
                "query": 'visualization_render_duration_seconds',
                "description": "Graph rendering performance"
            }
        }

        # Service-specific queries for SongNodes
        self.service_queries = {
            "enhanced-visualization-service": [
                'enhanced_viz_health',
                'enhanced_viz_uptime',
                'enhanced_viz_memory_usage{type="heapUsed"}',
                'rate(websocket_messages_total[5m])',
                'visualization_nodes_total',
                'visualization_edges_total'
            ],
            "graph-visualization-api": [
                'graph_api_request_duration_seconds',
                'graph_api_cache_hit_ratio',
                'graph_processing_time_seconds'
            ],
            "scraper-orchestrator": [
                'scraper_tasks_completed_total',
                'scraper_tasks_failed_total',
                'rate(tracks_processed_total[5m])'
            ]
        }

    def query_prometheus(self, query: str, time: Optional[str] = None) -> Dict[str, Any]:
        """Execute a PromQL query against Prometheus"""
        try:
            params = {'query': query}
            if time:
                params['time'] = time

            response = requests.get(
                f'{self.prometheus_url}/api/v1/query',
                params=params,
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            if data['status'] == 'success':
                return {'success': True, 'data': data['data']}
            else:
                return {'success': False, 'error': data.get('error', 'Unknown error')}

        except requests.exceptions.RequestException as e:
            logger.error(f"Prometheus query failed: {e}")
            return {'success': False, 'error': str(e)}
        except Exception as e:
            logger.error(f"Unexpected error querying Prometheus: {e}")
            return {'success': False, 'error': str(e)}

    def query_prometheus_range(self, query: str, start: str, end: str, step: str = '1m') -> Dict[str, Any]:
        """Execute a range query against Prometheus for historical data"""
        try:
            params = {
                'query': query,
                'start': start,
                'end': end,
                'step': step
            }

            response = requests.get(
                f'{self.prometheus_url}/api/v1/query_range',
                params=params,
                timeout=15
            )
            response.raise_for_status()

            data = response.json()
            if data['status'] == 'success':
                return {'success': True, 'data': data['data']}
            else:
                return {'success': False, 'error': data.get('error', 'Unknown error')}

        except Exception as e:
            logger.error(f"Prometheus range query failed: {e}")
            return {'success': False, 'error': str(e)}

    def get_active_alerts(self) -> List[Dict[str, Any]]:
        """Fetch all active alerts from Prometheus"""
        try:
            response = requests.get(
                f'{self.prometheus_url}/api/v1/alerts',
                timeout=10
            )
            response.raise_for_status()

            data = response.json()
            if data['status'] == 'success':
                alerts = data['data'].get('alerts', [])
                # Filter for active alerts only
                active = [a for a in alerts if a.get('state') == 'active']
                return active
            return []

        except Exception as e:
            logger.error(f"Failed to fetch alerts: {e}")
            return []

    def get_grafana_dashboards(self) -> List[Dict[str, Any]]:
        """Fetch available Grafana dashboards"""
        try:
            response = requests.get(
                f'{self.grafana_url}/api/search',
                auth=(self.grafana_user, self.grafana_pass),
                params={'type': 'dash-db'},
                timeout=10
            )
            response.raise_for_status()
            return response.json()

        except Exception as e:
            logger.error(f"Failed to fetch Grafana dashboards: {e}")
            return []

    def get_grafana_annotations(self, hours_back: int = 24) -> List[Dict[str, Any]]:
        """Fetch recent annotations from Grafana (e.g., deployments)"""
        try:
            now = datetime.utcnow()
            start_time = now - timedelta(hours=hours_back)

            params = {
                'from': int(start_time.timestamp() * 1000),
                'to': int(now.timestamp() * 1000)
            }

            response = requests.get(
                f'{self.grafana_url}/api/annotations',
                auth=(self.grafana_user, self.grafana_pass),
                params=params,
                timeout=10
            )
            response.raise_for_status()
            return response.json()

        except Exception as e:
            logger.error(f"Failed to fetch Grafana annotations: {e}")
            return []

    def collect_kpis(self) -> Dict[str, Any]:
        """Collect all Key Performance Indicators"""
        kpis = {}

        for name, config in self.kpi_queries.items():
            result = self.query_prometheus(config['query'])
            if result['success'] and result['data'].get('result'):
                kpis[name] = {
                    'description': config['description'],
                    'values': self._format_prometheus_result(result['data']['result'])
                }
            else:
                kpis[name] = {
                    'description': config['description'],
                    'error': result.get('error', 'No data')
                }

        return kpis

    def collect_service_metrics(self, service_name: str) -> Dict[str, Any]:
        """Collect metrics for a specific service"""
        if service_name not in self.service_queries:
            return {'error': f'No queries defined for service: {service_name}'}

        metrics = {}
        for query in self.service_queries[service_name]:
            result = self.query_prometheus(query)
            if result['success']:
                metrics[query] = self._format_prometheus_result(result['data'].get('result', []))

        return metrics

    def _format_prometheus_result(self, result: List[Dict]) -> Any:
        """Format Prometheus query result for readability"""
        if not result:
            return None

        if len(result) == 1:
            # Single value result
            metric = result[0]
            value = metric.get('value', [None, None])[1]
            try:
                return float(value) if value else None
            except (ValueError, TypeError):
                return value
        else:
            # Multiple series result
            formatted = []
            for metric in result:
                labels = metric.get('metric', {})
                value = metric.get('value', [None, None])[1]
                formatted.append({
                    'labels': labels,
                    'value': float(value) if value else None
                })
            return formatted

    def generate_health_report(self) -> Dict[str, Any]:
        """Generate a comprehensive health report"""
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'kpis': self.collect_kpis(),
            'alerts': self.get_active_alerts(),
            'services': {},
            'deployments': []
        }

        # Collect service-specific metrics
        for service in self.service_queries.keys():
            report['services'][service] = self.collect_service_metrics(service)

        # Get recent deployment annotations
        annotations = self.get_grafana_annotations(hours_back=24)
        for ann in annotations:
            if 'deploy' in ann.get('tags', []):
                report['deployments'].append({
                    'time': datetime.fromtimestamp(ann['time'] / 1000).isoformat(),
                    'text': ann.get('text', 'No description'),
                    'tags': ann.get('tags', [])
                })

        self.metrics_cache = report
        self.last_update = datetime.utcnow()

        return report

    def format_for_ai_context(self, report: Dict[str, Any]) -> str:
        """Format the health report as Markdown for AI consumption"""
        md = f"# System Health Report\n"
        md += f"**Generated**: {report['timestamp']}\n\n"

        # Active Alerts Section
        alerts = report.get('alerts', [])
        if alerts:
            md += f"## 🚨 Active Alerts ({len(alerts)})\n\n"
            for alert in alerts:
                labels = alert.get('labels', {})
                md += f"- **{labels.get('alertname', 'Unknown')}** "
                md += f"[{labels.get('severity', 'unknown')}]: "
                md += f"{alert.get('annotations', {}).get('summary', 'No summary')}\n"
        else:
            md += "## ✅ No Active Alerts\n\n"

        # KPI Section
        md += "## 📊 Key Performance Indicators\n\n"
        md += "| Metric | Value | Status |\n"
        md += "|--------|-------|--------|\n"

        for name, data in report.get('kpis', {}).items():
            if 'error' in data:
                md += f"| {data['description']} | Error | ❌ |\n"
            else:
                value = data.get('values')
                status = self._get_metric_status(name, value)
                if isinstance(value, list):
                    md += f"| {data['description']} | Multiple series | {status} |\n"
                else:
                    formatted_value = f"{value:.2f}" if value else "N/A"
                    md += f"| {data['description']} | {formatted_value} | {status} |\n"

        # Service Health Section
        md += "\n## 🔧 Service Status\n\n"
        for service, metrics in report.get('services', {}).items():
            if 'error' not in metrics:
                md += f"### {service}\n"
                for query, value in metrics.items():
                    if value is not None:
                        if isinstance(value, (int, float)):
                            md += f"- {query}: {value:.2f}\n"
                        else:
                            md += f"- {query}: {len(value)} series\n"
                md += "\n"

        # Recent Deployments
        deployments = report.get('deployments', [])
        if deployments:
            md += "## 🚀 Recent Deployments (24h)\n\n"
            for dep in deployments[:5]:  # Show last 5 deployments
                md += f"- **{dep['time']}**: {dep['text']}\n"

        return md

    def _get_metric_status(self, metric_name: str, value: Any) -> str:
        """Determine status emoji based on metric value"""
        if value is None:
            return "⚠️"

        # Simple threshold-based status
        if 'error' in metric_name.lower():
            if isinstance(value, (int, float)):
                return "✅" if value < 0.01 else "🔥" if value > 0.05 else "⚠️"
        elif 'health' in metric_name.lower():
            if isinstance(value, list):
                # Check if any service is down
                down_services = [v for v in value if v.get('value') == 0]
                return "🔥" if down_services else "✅"

        return "ℹ️"

    def diagnose_issue(self, service_name: Optional[str] = None) -> Dict[str, Any]:
        """Perform automated diagnosis of potential issues"""
        diagnosis = {
            'timestamp': datetime.utcnow().isoformat(),
            'findings': [],
            'recommendations': []
        }

        # Get current health report
        report = self.generate_health_report()

        # Check for active alerts
        if report['alerts']:
            diagnosis['findings'].append({
                'severity': 'high',
                'issue': f"{len(report['alerts'])} active alerts detected",
                'details': [a.get('labels', {}).get('alertname') for a in report['alerts']]
            })
            diagnosis['recommendations'].append("Investigate active alerts immediately")

        # Check service health
        kpis = report.get('kpis', {})

        # Check error rates
        if 'api_error_rate' in kpis:
            error_data = kpis['api_error_rate'].get('values')
            if error_data and isinstance(error_data, list):
                high_error_services = [s for s in error_data if s.get('value', 0) > 0.05]
                if high_error_services:
                    diagnosis['findings'].append({
                        'severity': 'medium',
                        'issue': "High error rates detected",
                        'details': high_error_services
                    })
                    diagnosis['recommendations'].append("Check application logs for error details")

        # Check specific service if requested
        if service_name and service_name in report.get('services', {}):
            service_metrics = report['services'][service_name]
            diagnosis['service_analysis'] = {
                'service': service_name,
                'metrics': service_metrics
            }

        return diagnosis


# CLI Interface for testing
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Observability Scraper for AI Diagnostics')
    parser.add_argument('--command', choices=['health', 'alerts', 'diagnose', 'kpis'],
                       default='health', help='Command to execute')
    parser.add_argument('--service', help='Service name for targeted analysis')
    parser.add_argument('--output', choices=['json', 'markdown'], default='markdown',
                       help='Output format')

    args = parser.parse_args()

    scraper = ObservabilityScraper()

    if args.command == 'health':
        report = scraper.generate_health_report()
        if args.output == 'json':
            print(json.dumps(report, indent=2, default=str))
        else:
            print(scraper.format_for_ai_context(report))

    elif args.command == 'alerts':
        alerts = scraper.get_active_alerts()
        print(json.dumps(alerts, indent=2, default=str))

    elif args.command == 'diagnose':
        diagnosis = scraper.diagnose_issue(args.service)
        print(json.dumps(diagnosis, indent=2, default=str))

    elif args.command == 'kpis':
        kpis = scraper.collect_kpis()
        print(json.dumps(kpis, indent=2, default=str))