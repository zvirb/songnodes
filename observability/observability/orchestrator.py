#!/usr/bin/env python3
"""
Observability Orchestrator
Manages all three integration patterns for AI-driven observability
"""

import os
import sys
import time
import signal
import threading
import subprocess
from pathlib import Path
from datetime import datetime
import logging
import schedule

from scraper import ObservabilityScraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ObservabilityOrchestrator:
    """
    Orchestrates all three patterns:
    1. Event-driven webhook listener
    2. Scheduled polling
    3. MCP server
    """

    def __init__(self):
        self.processes = {}
        self.scraper = ObservabilityScraper()
        self.running = False
        self.scheduler_thread = None

    def start_webhook_listener(self):
        """Start the webhook listener service (Pattern 1)"""
        try:
            logger.info("Starting webhook listener on port 5001...")
            process = subprocess.Popen(
                [sys.executable, "webhook_listener.py"],
                cwd=Path(__file__).parent,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            self.processes['webhook'] = process
            logger.info(f"Webhook listener started with PID {process.pid}")

            # Configure Alertmanager if needed
            self._configure_alertmanager()

        except Exception as e:
            logger.error(f"Failed to start webhook listener: {e}")

    def start_mcp_server(self):
        """Start the MCP server (Pattern 3)"""
        try:
            logger.info("Starting MCP server on port 8000...")
            process = subprocess.Popen(
                [sys.executable, "mcp_server.py"],
                cwd=Path(__file__).parent,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            self.processes['mcp'] = process
            logger.info(f"MCP server started with PID {process.pid}")

            # Update AI CLI configurations
            self._configure_ai_clients()

        except Exception as e:
            logger.error(f"Failed to start MCP server: {e}")

    def start_scheduled_polling(self, interval_minutes=15):
        """Start scheduled polling (Pattern 2)"""
        logger.info(f"Starting scheduled polling every {interval_minutes} minutes...")

        def polling_job():
            try:
                logger.info("Running scheduled health report generation...")
                report = self.scraper.generate_health_report()

                # Write to context files
                self._update_context_files(report)

                logger.info("Health report updated successfully")
            except Exception as e:
                logger.error(f"Polling job failed: {e}")

        # Schedule the job
        schedule.every(interval_minutes).minutes.do(polling_job)

        # Run immediately on start
        polling_job()

        # Start scheduler thread
        self.scheduler_thread = threading.Thread(target=self._run_scheduler)
        self.scheduler_thread.daemon = True
        self.scheduler_thread.start()

    def _run_scheduler(self):
        """Run the schedule loop in a separate thread"""
        while self.running:
            schedule.run_pending()
            time.sleep(1)

    def _update_context_files(self, report):
        """Update Claude.md and system_health.md with the report"""
        try:
            # Format as markdown
            markdown_content = self.scraper.format_for_ai_context(report)

            # Update Gemini context file
            gemini_file = Path("system_health.md")
            gemini_file.write_text(markdown_content)
            logger.debug("Updated system_health.md")

            # Update Claude context file (section)
            claude_file = Path("CLAUDE.md")
            marker_start = "<!-- SYSTEM_HEALTH_START -->"
            marker_end = "<!-- SYSTEM_HEALTH_END -->"

            if claude_file.exists():
                content = claude_file.read_text()
            else:
                content = ""

            # Find and replace section
            start_idx = content.find(marker_start)
            end_idx = content.find(marker_end)

            full_section = f"{marker_start}\n{markdown_content}\n{marker_end}"

            if start_idx != -1 and end_idx != -1:
                before = content[:start_idx]
                after = content[end_idx + len(marker_end):]
                new_content = before + full_section + after
            else:
                new_content = content + "\n\n" + full_section

            claude_file.write_text(new_content)
            logger.debug("Updated CLAUDE.md")

        except Exception as e:
            logger.error(f"Failed to update context files: {e}")

    def _configure_alertmanager(self):
        """Configure Alertmanager to send webhooks"""
        alertmanager_config = """
# Add this to your alertmanager.yml configuration:

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
"""
        logger.info("Alertmanager configuration needed:")
        print(alertmanager_config)

    def _configure_ai_clients(self):
        """Generate configuration for AI clients"""
        claude_config = {
            "mcp": {
                "servers": [
                    {
                        "name": "observability",
                        "url": "http://localhost:8000/.well-known/mcp-tools"
                    }
                ]
            }
        }

        gemini_config = {
            "mcpServers": {
                "observability": {
                    "url": "http://localhost:8000/.well-known/mcp-tools",
                    "trust": False,
                    "timeout": 30000
                }
            }
        }

        # Write configurations
        claude_settings = Path(".claude/settings.json")
        claude_settings.parent.mkdir(exist_ok=True)
        claude_settings.write_text(json.dumps(claude_config, indent=2))

        gemini_settings = Path(".gemini/settings.json")
        gemini_settings.parent.mkdir(exist_ok=True)
        gemini_settings.write_text(json.dumps(gemini_config, indent=2))

        logger.info("AI client configurations updated")

    def start_all(self):
        """Start all integration patterns"""
        self.running = True

        logger.info("Starting Observability Orchestrator...")

        # Start Pattern 1: Webhook listener
        self.start_webhook_listener()
        time.sleep(2)  # Give it time to start

        # Start Pattern 2: Scheduled polling
        self.start_scheduled_polling(interval_minutes=15)

        # Start Pattern 3: MCP server
        self.start_mcp_server()

        logger.info("All services started successfully!")
        logger.info("")
        logger.info("Available endpoints:")
        logger.info("  - Webhook: http://localhost:5001/webhook")
        logger.info("  - MCP Server: http://localhost:8000/.well-known/mcp-tools")
        logger.info("  - Health Report: http://localhost:8000/api/health-report")
        logger.info("")
        logger.info("Context files will be updated at:")
        logger.info("  - CLAUDE.md (for Claude CLI)")
        logger.info("  - system_health.md (for Gemini CLI)")
        logger.info("  - prometheus_alerts.md (for real-time alerts)")

    def stop_all(self):
        """Stop all services gracefully"""
        logger.info("Stopping all services...")
        self.running = False

        # Terminate subprocesses
        for name, process in self.processes.items():
            if process and process.poll() is None:
                logger.info(f"Terminating {name} (PID {process.pid})")
                process.terminate()
                process.wait(timeout=5)

        logger.info("All services stopped")

    def handle_signal(self, signum, frame):
        """Handle shutdown signals"""
        logger.info(f"Received signal {signum}")
        self.stop_all()
        sys.exit(0)


def main():
    """Main entry point"""
    import argparse
    import json

    parser = argparse.ArgumentParser(description='Observability Orchestrator')
    parser.add_argument('--pattern', choices=['all', 'webhook', 'polling', 'mcp'],
                       default='all', help='Which pattern(s) to run')
    parser.add_argument('--interval', type=int, default=15,
                       help='Polling interval in minutes (Pattern 2)')
    parser.add_argument('--test', action='store_true',
                       help='Run a test query to verify connectivity')

    args = parser.parse_args()

    if args.test:
        # Test mode - just verify connectivity
        logger.info("Running connectivity test...")
        scraper = ObservabilityScraper()

        # Test Prometheus
        result = scraper.query_prometheus("up")
        if result['success']:
            logger.info("✅ Prometheus connection successful")
        else:
            logger.error(f"❌ Prometheus connection failed: {result.get('error')}")

        # Test Grafana
        dashboards = scraper.get_grafana_dashboards()
        if dashboards is not None:
            logger.info(f"✅ Grafana connection successful ({len(dashboards)} dashboards)")
        else:
            logger.error("❌ Grafana connection failed")

        # Generate a sample report
        report = scraper.generate_health_report()
        logger.info(f"✅ Generated health report with {len(report.get('kpis', {}))} KPIs")

        return

    # Normal operation mode
    orchestrator = ObservabilityOrchestrator()

    # Register signal handlers
    signal.signal(signal.SIGINT, orchestrator.handle_signal)
    signal.signal(signal.SIGTERM, orchestrator.handle_signal)

    try:
        if args.pattern == 'all':
            orchestrator.start_all()
        elif args.pattern == 'webhook':
            orchestrator.start_webhook_listener()
        elif args.pattern == 'polling':
            orchestrator.start_scheduled_polling(args.interval)
        elif args.pattern == 'mcp':
            orchestrator.start_mcp_server()

        # Keep the main thread alive
        while True:
            time.sleep(1)

    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        orchestrator.stop_all()


if __name__ == "__main__":
    main()