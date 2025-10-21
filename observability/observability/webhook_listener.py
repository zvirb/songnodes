#!/usr/bin/env python3
"""
Webhook Listener for Real-time Alert Processing
Implements Pattern 1: Event-Driven Architecture for immediate alert notification
"""

import os
import json
from flask import Flask, request, jsonify
from datetime import datetime
from pathlib import Path
import logging
from typing import Dict, List, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
CLAUDE_CONTEXT_FILE = os.getenv('CLAUDE_CONTEXT_FILE', 'CLAUDE.md')
GEMINI_CONTEXT_FILE = os.getenv('GEMINI_CONTEXT_FILE', 'prometheus_alerts.md')
ALERT_STATE_FILE = 'alert_state.json'

# For AI context integration
AI_CONTEXT_MARKER_START = "<!-- PROMETHEUS_ALERTS_START -->"
AI_CONTEXT_MARKER_END = "<!-- PROMETHEUS_ALERTS_END -->"


class AlertManager:
    """Manages alert state and context file updates"""

    def __init__(self):
        self.state_file = ALERT_STATE_FILE
        self.current_alerts = self.load_state()

    def load_state(self) -> Dict[str, Any]:
        """Load current alert state from file"""
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading state: {e}")
        return {}

    def save_state(self):
        """Save current alert state to file"""
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.current_alerts, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving state: {e}")

    def process_webhook_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process incoming Alertmanager webhook payload"""
        alerts = payload.get('alerts', [])
        updated_count = 0
        resolved_count = 0

        for alert in alerts:
            fingerprint = alert.get('fingerprint')
            if not fingerprint:
                continue

            if alert.get('status') == 'firing':
                self.current_alerts[fingerprint] = {
                    'alert': alert,
                    'received_at': datetime.utcnow().isoformat(),
                    'status': 'firing'
                }
                updated_count += 1
            elif alert.get('status') == 'resolved':
                if fingerprint in self.current_alerts:
                    del self.current_alerts[fingerprint]
                    resolved_count += 1

        self.save_state()
        return {
            'updated': updated_count,
            'resolved': resolved_count,
            'total_active': len([a for a in self.current_alerts.values() if a['status'] == 'firing'])
        }

    def format_alert_markdown(self, alert_data: Dict[str, Any]) -> str:
        """Format a single alert as Markdown"""
        alert = alert_data.get('alert', {})
        labels = alert.get('labels', {})
        annotations = alert.get('annotations', {})

        # Determine severity emoji
        severity = labels.get('severity', 'unknown').lower()
        emoji = {
            'critical': '🔴',
            'warning': '🟡',
            'info': '🔵'
        }.get(severity, '⚪')

        # Format timestamp
        starts_at = alert.get('startsAt', '')
        if starts_at:
            try:
                dt = datetime.fromisoformat(starts_at.replace('Z', '+00:00'))
                starts_at = dt.strftime('%Y-%m-%d %H:%M UTC')
            except:
                pass

        md = f"### {emoji} {labels.get('alertname', 'Unknown Alert')}\n\n"
        md += f"**Severity**: {severity.capitalize()}\n"
        md += f"**Service**: {labels.get('job', 'Unknown')}\n"
        md += f"**Instance**: {labels.get('instance', 'N/A')}\n"
        md += f"**Started**: {starts_at}\n\n"

        if annotations.get('summary'):
            md += f"**Summary**: {annotations['summary']}\n\n"

        if annotations.get('description'):
            md += f"**Description**: {annotations['description']}\n\n"

        # Add runbook link if available
        if annotations.get('runbook_url'):
            md += f"📚 [Runbook]({annotations['runbook_url']})\n\n"

        # Add all labels for context
        if labels:
            md += "**Labels**:\n"
            for key, value in labels.items():
                if key not in ['alertname', 'severity', 'job', 'instance']:
                    md += f"- `{key}`: `{value}`\n"
            md += "\n"

        md += "---\n\n"
        return md

    def generate_context_content(self) -> str:
        """Generate the full context content for AI consumption"""
        firing_alerts = [a for a in self.current_alerts.values() if a['status'] == 'firing']

        if not firing_alerts:
            content = "## 🚨 Real-time Prometheus Alerts\n\n"
            content += "✅ **All systems operational.** No active critical alerts.\n\n"
            content += f"*Last checked: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}*\n"
        else:
            content = "## 🚨 Real-time Prometheus Alerts\n\n"
            content += f"**{len(firing_alerts)} active alert(s)** require attention.\n\n"

            # Group alerts by severity
            by_severity = {}
            for alert_data in firing_alerts:
                alert = alert_data.get('alert', {})
                severity = alert.get('labels', {}).get('severity', 'unknown')
                if severity not in by_severity:
                    by_severity[severity] = []
                by_severity[severity].append(alert_data)

            # Sort by severity priority
            severity_order = ['critical', 'warning', 'info', 'unknown']
            for severity in severity_order:
                if severity in by_severity:
                    content += f"## {severity.capitalize()} Alerts\n\n"
                    for alert_data in by_severity[severity]:
                        content += self.format_alert_markdown(alert_data)

            content += f"\n*Updated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}*\n"

        return content

    def update_context_files(self):
        """Update both Claude and Gemini context files"""
        content = self.generate_context_content()

        # Update Gemini context file (standalone file)
        try:
            with open(GEMINI_CONTEXT_FILE, 'w') as f:
                f.write(content)
            logger.info(f"Updated {GEMINI_CONTEXT_FILE}")
        except Exception as e:
            logger.error(f"Error updating Gemini context: {e}")

        # Update Claude context file (section within CLAUDE.md)
        self._update_claude_context(content)

    def _update_claude_context(self, content: str):
        """Update a section within CLAUDE.md"""
        try:
            claude_path = Path(CLAUDE_CONTEXT_FILE)

            if claude_path.exists():
                claude_content = claude_path.read_text()
            else:
                claude_content = ""

            # Find and replace the alerts section
            start_idx = claude_content.find(AI_CONTEXT_MARKER_START)
            end_idx = claude_content.find(AI_CONTEXT_MARKER_END)

            full_section = f"{AI_CONTEXT_MARKER_START}\n{content}\n{AI_CONTEXT_MARKER_END}"

            if start_idx != -1 and end_idx != -1:
                # Replace existing section
                before = claude_content[:start_idx]
                after = claude_content[end_idx + len(AI_CONTEXT_MARKER_END):]
                new_content = before + full_section + after
            else:
                # Append new section
                new_content = claude_content + "\n\n" + full_section

            claude_path.write_text(new_content)
            logger.info(f"Updated {CLAUDE_CONTEXT_FILE}")

        except Exception as e:
            logger.error(f"Error updating Claude context: {e}")


# Initialize the alert manager
alert_manager = AlertManager()


@app.route('/webhook', methods=['POST'])
def alertmanager_webhook():
    """Endpoint to receive Alertmanager webhooks"""
    try:
        # Get the webhook payload
        payload = request.json

        # Log the incoming webhook
        logger.info(f"Received webhook from {request.remote_addr}")
        logger.debug(f"Payload: {json.dumps(payload, indent=2)}")

        # Process the alerts
        result = alert_manager.process_webhook_payload(payload)

        # Update context files for AI consumption
        alert_manager.update_context_files()

        # Return success response
        response = {
            'status': 'success',
            'message': f"Processed {result['updated']} new/updated alerts, {result['resolved']} resolved",
            'active_alerts': result['total_active'],
            'timestamp': datetime.utcnow().isoformat()
        }

        logger.info(f"Webhook processed: {response['message']}")
        return jsonify(response), 200

    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.utcnow().isoformat()
        }), 500


@app.route('/status', methods=['GET'])
def status():
    """Health check endpoint"""
    firing_alerts = [a for a in alert_manager.current_alerts.values() if a['status'] == 'firing']

    return jsonify({
        'status': 'healthy',
        'active_alerts': len(firing_alerts),
        'last_update': alert_manager.current_alerts.get('last_update'),
        'timestamp': datetime.utcnow().isoformat()
    })


@app.route('/alerts', methods=['GET'])
def get_alerts():
    """Get current alert status"""
    firing_alerts = [a for a in alert_manager.current_alerts.values() if a['status'] == 'firing']

    # Format for easy consumption
    formatted = []
    for alert_data in firing_alerts:
        alert = alert_data.get('alert', {})
        formatted.append({
            'alertname': alert.get('labels', {}).get('alertname'),
            'severity': alert.get('labels', {}).get('severity'),
            'service': alert.get('labels', {}).get('job'),
            'summary': alert.get('annotations', {}).get('summary'),
            'started': alert.get('startsAt'),
            'fingerprint': alert.get('fingerprint')
        })

    return jsonify({
        'alerts': formatted,
        'count': len(formatted),
        'timestamp': datetime.utcnow().isoformat()
    })


@app.route('/test', methods=['POST'])
def test_alert():
    """Test endpoint to simulate an alert"""
    test_payload = {
        "receiver": "ai-context-webhook",
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "TestAlert",
                    "severity": "warning",
                    "job": "test-service",
                    "instance": "localhost:8088"
                },
                "annotations": {
                    "summary": "This is a test alert",
                    "description": "This alert was generated for testing purposes"
                },
                "startsAt": datetime.utcnow().isoformat() + "Z",
                "fingerprint": "test-" + str(datetime.utcnow().timestamp())
            }
        ]
    }

    # Process the test alert
    result = alert_manager.process_webhook_payload(test_payload)
    alert_manager.update_context_files()

    return jsonify({
        'status': 'success',
        'message': 'Test alert created',
        'result': result
    }), 200


if __name__ == '__main__':
    # Create necessary files if they don't exist
    Path(GEMINI_CONTEXT_FILE).touch(exist_ok=True)

    # Start the webhook listener
    port = int(os.getenv('WEBHOOK_PORT', 5001))
    debug = os.getenv('DEBUG', 'false').lower() == 'true'

    logger.info(f"Starting webhook listener on port {port}")
    logger.info(f"Webhook endpoint: http://localhost:{port}/webhook")
    logger.info(f"Status endpoint: http://localhost:{port}/status")

    app.run(host='0.0.0.0', port=port, debug=debug)
