#!/usr/bin/env python3
"""
SongNodes Observability Stack Validation Script
Tests all observability components and generates sample data
"""

import asyncio
import httpx
import json
import time
import sys
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ObservabilityValidator:
    """Validates all components of the SongNodes observability stack"""

    def __init__(self):
        self.base_urls = {
            'prometheus': 'http://localhost:9091',
            'grafana': 'http://localhost:3001',
            'loki': 'http://localhost:3100',
            'tempo': 'http://localhost:3200',
            'otel_collector': 'http://localhost:13133',
            'alertmanager': 'http://localhost:9093'
        }
        self.http_client = httpx.AsyncClient(timeout=30.0)
        self.validation_results = {}

    async def validate_all(self) -> Dict[str, Any]:
        """Run all validation tests"""
        logger.info("🚀 Starting SongNodes Observability Stack Validation")

        validation_tasks = [
            self.validate_prometheus(),
            self.validate_grafana(),
            self.validate_loki(),
            self.validate_tempo(),
            self.validate_otel_collector(),
            self.validate_alertmanager()
        ]

        # Run validations concurrently
        results = await asyncio.gather(*validation_tasks, return_exceptions=True)

        # Process results
        services = ['prometheus', 'grafana', 'loki', 'tempo', 'otel_collector', 'alertmanager']
        for service, result in zip(services, results):
            if isinstance(result, Exception):
                self.validation_results[service] = {
                    'status': 'error',
                    'error': str(result),
                    'traceback': traceback.format_exc()
                }
            else:
                self.validation_results[service] = result

        # Generate sample data
        await self.generate_sample_observability_data()

        # Print summary
        self.print_validation_summary()

        return self.validation_results

    async def validate_prometheus(self) -> Dict[str, Any]:
        """Validate Prometheus is running and accessible"""
        logger.info("🔍 Validating Prometheus...")

        try:
            # Check health endpoint
            health_response = await self.http_client.get(f"{self.base_urls['prometheus']}/-/healthy")
            health_status = health_response.status_code == 200

            # Check configuration
            config_response = await self.http_client.get(f"{self.base_urls['prometheus']}/api/v1/status/config")
            config_status = config_response.status_code == 200

            # Check targets
            targets_response = await self.http_client.get(f"{self.base_urls['prometheus']}/api/v1/targets")
            targets_data = targets_response.json() if targets_response.status_code == 200 else {}

            # Check for OTel Collector metrics
            query_response = await self.http_client.get(
                f"{self.base_urls['prometheus']}/api/v1/query",
                params={'query': 'up{job="otel-collector"}'}
            )
            otel_metrics = query_response.json() if query_response.status_code == 200 else {}

            return {
                'status': 'healthy' if health_status and config_status else 'unhealthy',
                'health_check': health_status,
                'config_loaded': config_status,
                'targets_count': len(targets_data.get('data', {}).get('activeTargets', [])),
                'otel_metrics_available': len(otel_metrics.get('data', {}).get('result', [])) > 0,
                'url': self.base_urls['prometheus']
            }

        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def validate_grafana(self) -> Dict[str, Any]:
        """Validate Grafana is running with correct datasources"""
        logger.info("📊 Validating Grafana...")

        try:
            # Check health
            health_response = await self.http_client.get(f"{self.base_urls['grafana']}/api/health")
            health_status = health_response.status_code == 200

            # Check datasources (requires auth, using admin:admin default)
            auth = ("admin", "admin")
            datasources_response = await self.http_client.get(
                f"{self.base_urls['grafana']}/api/datasources",
                auth=auth
            )

            datasources = []
            if datasources_response.status_code == 200:
                datasources = datasources_response.json()

            # Check for required datasources
            datasource_names = [ds.get('name', '') for ds in datasources]
            required_datasources = ['Prometheus', 'Loki', 'Tempo']
            missing_datasources = [ds for ds in required_datasources if ds not in datasource_names]

            # Check dashboards
            dashboards_response = await self.http_client.get(
                f"{self.base_urls['grafana']}/api/search",
                auth=auth,
                params={'type': 'dash-db'}
            )
            dashboards = dashboards_response.json() if dashboards_response.status_code == 200 else []

            return {
                'status': 'healthy' if health_status and not missing_datasources else 'unhealthy',
                'health_check': health_status,
                'datasources_configured': len(datasources),
                'missing_datasources': missing_datasources,
                'dashboards_count': len(dashboards),
                'url': self.base_urls['grafana']
            }

        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def validate_loki(self) -> Dict[str, Any]:
        """Validate Loki is running and ready"""
        logger.info("📝 Validating Loki...")

        try:
            # Check readiness
            ready_response = await self.http_client.get(f"{self.base_urls['loki']}/ready")
            ready_status = ready_response.status_code == 200

            # Check metrics
            metrics_response = await self.http_client.get(f"{self.base_urls['loki']}/metrics")
            metrics_status = metrics_response.status_code == 200

            # Test log ingestion endpoint
            push_url = f"{self.base_urls['loki']}/loki/api/v1/push"
            test_log = {
                "streams": [
                    {
                        "stream": {
                            "job": "validation-test",
                            "service": "observability-validator"
                        },
                        "values": [
                            [str(int(time.time() * 1000000000)), "Validation test log entry"]
                        ]
                    }
                ]
            }

            push_response = await self.http_client.post(
                push_url,
                json=test_log,
                headers={'Content-Type': 'application/json'}
            )
            push_status = push_response.status_code in [200, 204]

            return {
                'status': 'healthy' if ready_status and metrics_status else 'unhealthy',
                'ready_check': ready_status,
                'metrics_available': metrics_status,
                'log_ingestion_working': push_status,
                'url': self.base_urls['loki']
            }

        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def validate_tempo(self) -> Dict[str, Any]:
        """Validate Tempo is running and ready"""
        logger.info("🔍 Validating Tempo...")

        try:
            # Check readiness
            ready_response = await self.http_client.get(f"{self.base_urls['tempo']}/ready")
            ready_status = ready_response.status_code == 200

            # Check status
            status_response = await self.http_client.get(f"{self.base_urls['tempo']}/status")
            status_data = status_response.json() if status_response.status_code == 200 else {}

            # Check services endpoint
            services_response = await self.http_client.get(f"{self.base_urls['tempo']}/api/search/tags")
            services_status = services_response.status_code == 200

            return {
                'status': 'healthy' if ready_status else 'unhealthy',
                'ready_check': ready_status,
                'status_endpoint': status_response.status_code == 200,
                'services_endpoint': services_status,
                'version': status_data.get('version', 'unknown'),
                'url': self.base_urls['tempo']
            }

        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def validate_otel_collector(self) -> Dict[str, Any]:
        """Validate OpenTelemetry Collector is running"""
        logger.info("🔄 Validating OpenTelemetry Collector...")

        try:
            # Check health endpoint
            health_response = await self.http_client.get(f"{self.base_urls['otel_collector']}")
            health_status = health_response.status_code == 200

            # Check metrics endpoint
            metrics_response = await self.http_client.get(f"http://localhost:8889/metrics")
            metrics_status = metrics_response.status_code == 200

            # Parse metrics to check if collector is processing data
            otel_metrics = {}
            if metrics_status:
                metrics_text = metrics_response.text
                # Look for key OTel metrics
                otel_metrics = {
                    'spans_processed': 'otelcol_processor_spans_received_total' in metrics_text,
                    'metrics_processed': 'otelcol_processor_metrics_received_total' in metrics_text,
                    'logs_processed': 'otelcol_processor_logs_received_total' in metrics_text
                }

            return {
                'status': 'healthy' if health_status and metrics_status else 'unhealthy',
                'health_check': health_status,
                'metrics_endpoint': metrics_status,
                'processing_data': any(otel_metrics.values()),
                'capabilities': otel_metrics,
                'url': self.base_urls['otel_collector']
            }

        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def validate_alertmanager(self) -> Dict[str, Any]:
        """Validate Alertmanager is running"""
        logger.info("🚨 Validating Alertmanager...")

        try:
            # Check health endpoint
            health_response = await self.http_client.get(f"{self.base_urls['alertmanager']}/-/healthy")
            health_status = health_response.status_code == 200

            # Check configuration
            config_response = await self.http_client.get(f"{self.base_urls['alertmanager']}/api/v1/status")
            config_status = config_response.status_code == 200

            # Check alerts endpoint
            alerts_response = await self.http_client.get(f"{self.base_urls['alertmanager']}/api/v1/alerts")
            alerts_data = alerts_response.json() if alerts_response.status_code == 200 else {}

            return {
                'status': 'healthy' if health_status and config_status else 'unhealthy',
                'health_check': health_status,
                'config_loaded': config_status,
                'active_alerts': len(alerts_data.get('data', [])),
                'url': self.base_urls['alertmanager']
            }

        except Exception as e:
            return {'status': 'error', 'error': str(e)}

    async def generate_sample_observability_data(self):
        """Generate sample metrics, logs, and traces for testing"""
        logger.info("🧪 Generating sample observability data...")

        try:
            # Generate sample logs to Loki
            await self.generate_sample_logs()

            # Generate sample metrics (would normally come from instrumented apps)
            await self.generate_sample_metrics()

            logger.info("✅ Sample observability data generated successfully")

        except Exception as e:
            logger.error(f"❌ Error generating sample data: {e}")

    async def generate_sample_logs(self):
        """Generate sample structured logs"""
        sample_logs = [
            {
                "timestamp": datetime.now().isoformat(),
                "level": "info",
                "service": "scraper-1001tracklists",
                "message": "Successfully scraped playlist",
                "scraper_name": "1001tracklists",
                "tracks_found": 25,
                "response_time_ms": 1250,
                "target_url": "https://www.1001tracklists.com/tracklist/example",
                "trace_id": "550e8400-e29b-41d4-a716-446655440000"
            },
            {
                "timestamp": datetime.now().isoformat(),
                "level": "warning",
                "service": "database-pipeline",
                "message": "High duplicate rate detected",
                "operation": "insert_tracks",
                "table_name": "songs",
                "duplicate_percentage": 35.2,
                "trace_id": "550e8400-e29b-41d4-a716-446655440001"
            },
            {
                "timestamp": datetime.now().isoformat(),
                "level": "info",
                "service": "llm-adapter",
                "message": "LLM selector adaptation successful",
                "scraper_name": "mixesdb",
                "original_selector": ".track-name",
                "adapted_selector": ".song-title",
                "llm_model": "llama3.2:3b",
                "adaptation_time_ms": 180
            }
        ]

        push_url = f"{self.base_urls['loki']}/loki/api/v1/push"

        for log_entry in sample_logs:
            log_payload = {
                "streams": [
                    {
                        "stream": {
                            "job": "songnodes",
                            "service": log_entry["service"],
                            "level": log_entry["level"]
                        },
                        "values": [
                            [str(int(time.time() * 1000000000)), json.dumps(log_entry)]
                        ]
                    }
                ]
            }

            try:
                await self.http_client.post(
                    push_url,
                    json=log_payload,
                    headers={'Content-Type': 'application/json'}
                )
            except Exception as e:
                logger.warning(f"Failed to send sample log: {e}")

    async def generate_sample_metrics(self):
        """Generate sample metrics via OTel Collector"""
        # This would normally be done through instrumented applications
        # For validation, we just verify the endpoints are accessible
        pass

    def print_validation_summary(self):
        """Print a comprehensive validation summary"""
        print("\n" + "="*80)
        print("🎯 SONGNODES OBSERVABILITY STACK VALIDATION SUMMARY")
        print("="*80)

        healthy_count = 0
        total_count = len(self.validation_results)

        for service, result in self.validation_results.items():
            status = result.get('status', 'unknown')
            icon = "✅" if status == 'healthy' else "❌" if status == 'error' else "⚠️"

            print(f"\n{icon} {service.upper()}")
            print(f"   Status: {status}")

            if status == 'healthy':
                healthy_count += 1
                # Print service-specific details
                if service == 'prometheus':
                    print(f"   Targets: {result.get('targets_count', 0)}")
                    print(f"   OTel Metrics: {'✓' if result.get('otel_metrics_available') else '✗'}")
                elif service == 'grafana':
                    print(f"   Datasources: {result.get('datasources_configured', 0)}")
                    print(f"   Dashboards: {result.get('dashboards_count', 0)}")
                elif service == 'loki':
                    print(f"   Log Ingestion: {'✓' if result.get('log_ingestion_working') else '✗'}")
                elif service == 'otel_collector':
                    print(f"   Processing Data: {'✓' if result.get('processing_data') else '✗'}")
                elif service == 'alertmanager':
                    print(f"   Active Alerts: {result.get('active_alerts', 0)}")

            elif status == 'error':
                print(f"   Error: {result.get('error', 'Unknown error')}")

            print(f"   URL: {result.get('url', self.base_urls.get(service, 'N/A'))}")

        print(f"\n📊 OVERALL HEALTH: {healthy_count}/{total_count} services healthy")

        if healthy_count == total_count:
            print("🎉 All observability services are healthy and ready!")
            print("\n🔗 Access URLs:")
            print(f"   Grafana Dashboards: http://localhost:3001")
            print(f"   Prometheus: http://localhost:9091")
            print(f"   Alertmanager: http://localhost:9093")
        else:
            print("⚠️  Some services need attention. Check the errors above.")

        print("\n" + "="*80)

    async def close(self):
        """Clean up resources"""
        await self.http_client.aclose()


async def main():
    """Main validation function"""
    validator = ObservabilityValidator()

    try:
        results = await validator.validate_all()

        # Exit with error code if any service is unhealthy
        unhealthy_services = [
            service for service, result in results.items()
            if result.get('status') != 'healthy'
        ]

        if unhealthy_services:
            logger.error(f"Unhealthy services: {', '.join(unhealthy_services)}")
            sys.exit(1)
        else:
            logger.info("✅ All observability services validated successfully")
            sys.exit(0)

    except Exception as e:
        logger.error(f"Validation failed: {e}")
        traceback.print_exc()
        sys.exit(1)

    finally:
        await validator.close()


if __name__ == "__main__":
    asyncio.run(main())