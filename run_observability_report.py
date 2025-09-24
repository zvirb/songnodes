
import os
import requests
import json
from datetime import datetime, timedelta

# --- Configuration ---
# From docker-compose.yml, services are exposed on non-standard ports
PROMETHEUS_URL = os.getenv('PROMETHEUS_URL', 'http://localhost:9091')
GRAFANA_URL = os.getenv('GRAFANA_URL', 'http://localhost:3001')
GRAFANA_API_TOKEN = os.getenv('GRAFANA_API_TOKEN') # This needs to be set as an environment variable
PROMETHEUS_AUTH_TOKEN = os.getenv('PROMETHEUS_AUTH_TOKEN')

# Output file
OUTPUT_FILE = 'system_health_report.md'

# --- PromQL Queries to gather Key Performance Indicators ---
# These queries are adapted from the document and common Prometheus usage.
# Note: The original queries were generic. These are slightly more specific where possible.
KPI_QUERIES = {
    "API_Gateway_5xx_Error_Rate_5m": {
        "query": '''sum(rate(http_requests_total{job="api-gateway", code=~"5.."}[5m])) / sum(rate(http_requests_total{job="api-gateway"}[5m])) * 100''',
        "unit": "%"
    },
    "P95_API_Gateway_Latency_ms": {
        "query": '''histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="api-gateway"}[5m])) by (le)) * 1000''',
        "unit": "ms"
    },
    "Container_CPU_Usage_Percentage": {
        "query": '''(1 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m]))) * 100''',
        "unit": "%"
    },
    "Active_Alerts_Count": {
        "query": '''count(ALERTS{alertstate="firing"})''',
        "unit": ""
    }
}

def query_prometheus(query):
    """Executes a single PromQL query."""
    headers = {}
    if PROMETHEUS_AUTH_TOKEN:
        headers['Authorization'] = f'Bearer {PROMETHEUS_AUTH_TOKEN}'
    
    try:
        response = requests.get(
            f'{PROMETHEUS_URL}/api/v1/query',
            params={'query': query},
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        result = response.json()['data']['result']
        if result:
            # Handle different result types
            if result[0]['value']:
                value = float(result[0]['value'][1])
                return f"{value:.2f}"
        return "N/A"
    except requests.RequestException as e:
        # print(f"Error querying Prometheus: {e}")
        return "Error"
    except (KeyError, IndexError) as e:
        # print(f"Error parsing Prometheus response for query '{query}': {e}")
        return "No Data"


def get_grafana_deployment_annotations():
    """Fetches annotations tagged with 'deploy' from Grafana for the last 24 hours."""
    if not GRAFANA_API_TOKEN:
        return None # Return None to indicate skip

    headers = {'Authorization': f'Bearer {GRAFANA_API_TOKEN}', 'Accept': 'application/json'}
    now = datetime.utcnow()
    twenty_four_hours_ago = now - timedelta(hours=24)
    
    params = {
        'from': int(twenty_four_hours_ago.timestamp() * 1000),
        'to': int(now.timestamp() * 1000),
        'tags': 'deploy', # Assuming deployments are tagged with 'deploy'
        'limit': 20
    }
    
    try:
        response = requests.get(f'{GRAFANA_URL}/api/annotations', params=params, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        # print(f"Error querying Grafana annotations: {e}")
        return [] # Return empty list on error

def get_active_alerts():
    """Queries Prometheus for a list of active alerts."""
    headers = {}
    if PROMETHEUS_AUTH_TOKEN:
        headers['Authorization'] = f'Bearer {PROMETHEUS_AUTH_TOKEN}'
    
    try:
        response = requests.get(
            f'{PROMETHEUS_URL}/api/v1/alerts',
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        alerts = response.json()['data']['alerts']
        # Filter for only firing alerts
        return [a for a in alerts if a['state'] == 'firing']
    except requests.RequestException as e:
        # print(f"Error querying Prometheus alerts: {e}")
        return None
    except KeyError:
        return []

def generate_health_report():
    """Generates the full Markdown health report."""
    report = f"# System Health Report ({datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')})\n\n"
    
    # --- KPIs from Prometheus ---
    report += "## Key Performance Indicators (Current State)\n\n"
    report += "| Metric | Value |\n"
    report += "| ------------------------------- |:-------------:|\n"
    for name, config in KPI_QUERIES.items():
        value = query_prometheus(config['query'])
        unit = config['unit']
        report += f"| {name.replace('_', ' ')} | **{value} {unit}** |\n"
    report += "\n"

    # --- Active Alerts ---
    report += "## Active Alerts\n\n"
    active_alerts = get_active_alerts()
    if active_alerts is None:
        report += "- *Error retrieving alerts from Prometheus.*\n"
    elif not active_alerts:
        report += "- ✅ No active alerts.\n"
    else:
        for alert in active_alerts:
            report += f"- **{alert['labels'].get('alertname', 'N/A')}** ({alert['labels'].get('severity', 'N/A')})\n"
            report += f"  - **Summary:** {alert['annotations'].get('summary', 'No summary.')}\n"
            report += f"  - **Labels:** `{alert['labels']}`\n"
    report += "\n"
    
    # --- Deployments from Grafana ---
    report += "## Recent Deployments (Last 24 Hours)\n\n"
    annotations = get_grafana_deployment_annotations()
    if annotations is None:
        report += """- *Skipped: GRAFANA_API_TOKEN environment variable not set.*\n"""
    elif not annotations:
        report += """- No deployments tagged 'deploy' found in the last 24 hours.\n"""
    else:
        for ann in sorted(annotations, key=lambda x: x['time'], reverse=True):
            ts = datetime.fromtimestamp(ann['time'] / 1000).strftime('%Y-%m-%d %H:%M')
            report += f"- **{ts}**: {ann.get('text', 'No description')}\n"
    report += "\n"
    
    return report

def write_report_to_file(report_content):
    """Writes the report to the output file."""
    with open(OUTPUT_FILE, 'w') as f:
        f.write(report_content)
    print(f"Successfully generated system health report to '{OUTPUT_FILE}'")


if __name__ == "__main__":
    print("Generating system health report...")
    report = generate_health_report()
    write_report_to_file(report)
