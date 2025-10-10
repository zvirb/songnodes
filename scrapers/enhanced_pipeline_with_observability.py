# DEPRECATED: This file uses the removed database_pipeline. Use modern pipelines instead.
"""
Enhanced Database Pipeline with Comprehensive Observability
Extends the existing database pipeline with 2025 best practices for data observability

⚠️  WARNING: This file imports from the deprecated database_pipeline module
    which has been replaced by pipelines.persistence_pipeline.PersistencePipeline.
    This file is deprecated and should not be used in production.
"""

import asyncio
import time
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from urllib.parse import urlparse
import uuid

from pipelines.persistence_pipeline import PersistencePipeline
from pipeline_observability import (
    PipelineObservabilityTracker,
    PipelineMetric,
    SourceExtractionLog,
    QualityMetric,
    GraphValidationResult
)

logger = logging.getLogger(__name__)

class ObservableMusicPipeline(PersistencePipeline):
    """Enhanced database pipeline with comprehensive observability tracking"""

    def __init__(self, database_config: Dict[str, Any], **kwargs):
        super().__init__(database_config, **kwargs)

        # Initialize observability tracker
        self.observability = PipelineObservabilityTracker(database_config)
        self.current_run_id = None
        self.run_start_time = None
        self.source_extractions = {}
        self.validation_results = []

        # Metrics tracking
        self.pipeline_metrics = {
            'items_processed': 0,
            'items_validated': 0,
            'items_failed': 0,
            'extraction_time_ms': 0,
            'validation_time_ms': 0,
            'database_time_ms': 0
        }

        # Graph structure tracking
        self.graph_stats_before = {}
        self.graph_stats_after = {}

    async def initialize_observability(self):
        """Initialize the observability tracking system"""
        try:
            await self.observability.initialize()
            logger.info("Observability tracking initialized")
        except Exception as e:
            logger.error(f"Failed to initialize observability: {e}")
            raise

    async def start_scraping_run(self, scraper_name: str, source_urls: List[str] = None,
                               target_tracks: List[str] = None) -> str:
        """Start a new scraping run with full observability tracking"""
        self.run_start_time = time.time()

        # Initialize pipeline metrics
        self.pipeline_metrics = {
            'items_processed': 0,
            'items_validated': 0,
            'items_failed': 0,
            'extraction_time_ms': 0,
            'validation_time_ms': 0,
            'database_time_ms': 0,
            'sources_attempted': len(source_urls) if source_urls else 0,
            'target_tracks_count': len(target_tracks) if target_tracks else 0
        }

        # Capture graph statistics before scraping
        await self.capture_graph_statistics('before')

        # Start observability tracking
        tracks_searched = len(target_tracks) if target_tracks else 0
        self.current_run_id = await self.observability.start_run_tracking(
            scraper_name, tracks_searched
        )

        # Track initial metrics
        await self.track_metric('ingestion', 'sources_queued', len(source_urls) if source_urls else 0, 'count')
        await self.track_metric('ingestion', 'run_started', 1, 'count')

        logger.info(f"Started scraping run {self.current_run_id} for {scraper_name}")
        return self.current_run_id

    async def track_source_extraction(self, source_url: str, scraper_name: str,
                                    success: bool, response_time_ms: int = None,
                                    http_status: int = None, error_message: str = None,
                                    extracted_count: int = 0, extraction_method: str = None):
        """Track source extraction attempt with detailed metrics"""

        domain = urlparse(source_url).netloc if source_url else 'unknown'

        extraction_log = SourceExtractionLog(
            source_url=source_url,
            website_domain=domain,
            scraper_used=scraper_name,
            http_status_code=http_status,
            response_time_ms=response_time_ms,
            extraction_method=extraction_method or 'css_selector',
            success=success,
            error_message=error_message,
            extracted_elements={'count': extracted_count} if extracted_count else {},
            retry_count=0
        )

        await self.observability.track_source_extraction(self.current_run_id, extraction_log)

        # Track metrics
        await self.track_metric('extraction', 'source_attempts', 1, 'count')
        if success:
            await self.track_metric('extraction', 'source_successes', 1, 'count')
            await self.track_metric('extraction', 'records_extracted', extracted_count, 'count')
        else:
            await self.track_metric('extraction', 'source_failures', 1, 'count')

        if response_time_ms:
            await self.track_metric('extraction', 'response_time', response_time_ms, 'ms')

        # Store for quality metrics calculation
        self.source_extractions[source_url] = {
            'success': success,
            'records_extracted': extracted_count,
            'response_time_ms': response_time_ms,
            'domain': domain
        }

    async def process_item_with_observability(self, item, spider):
        """Process item with comprehensive observability tracking"""
        start_time = time.time()

        try:
            # Track processing start
            await self.track_metric('transformation', 'items_started', 1, 'count')

            # Validate item structure and quality
            validation_start = time.time()
            item_type = type(item).__name__

            # Validate data quality
            quality_metrics = await self.calculate_item_quality_metrics(item, item_type)

            validation_time = (time.time() - validation_start) * 1000
            self.pipeline_metrics['validation_time_ms'] += validation_time

            # Process the item using the parent pipeline
            db_start = time.time()
            result = await super()._async_process_item(item, spider)

            db_time = (time.time() - db_start) * 1000
            self.pipeline_metrics['database_time_ms'] += db_time

            # Track successful processing
            processing_time = (time.time() - start_time) * 1000
            await self.track_metric('transformation', 'item_processing_time', processing_time, 'ms')
            await self.track_metric('transformation', 'items_processed', 1, 'count')

            self.pipeline_metrics['items_processed'] += 1
            self.pipeline_metrics['items_validated'] += 1

            return result

        except Exception as e:
            # Track processing failure
            error_time = (time.time() - start_time) * 1000
            await self.track_metric('transformation', 'item_error_time', error_time, 'ms')
            await self.track_metric('transformation', 'items_failed', 1, 'count')

            self.pipeline_metrics['items_failed'] += 1

            logger.error(f"Item processing failed: {e}")
            raise

    async def validate_playlist_graph_structure(self, playlist_id: str, track_list: List[Dict]) -> GraphValidationResult:
        """Validate graph structure for a playlist with comprehensive tracking"""

        validation_start = time.time()

        # Use the observability tracker's validation logic
        result = await self.observability.validate_graph_structure(
            self.current_run_id, playlist_id, track_list
        )

        validation_time = (time.time() - validation_start) * 1000
        await self.track_metric('validation', 'graph_validation_time', validation_time, 'ms')

        # Track validation results
        if result.validation_passed:
            await self.track_metric('validation', 'graph_validations_passed', 1, 'count')
        else:
            await self.track_metric('validation', 'graph_validations_failed', 1, 'count')
            logger.warning(f"Graph validation failed for playlist {playlist_id}: {result.validation_message}")

        self.validation_results.append(result)
        return result

    async def calculate_item_quality_metrics(self, item, item_type: str) -> List[QualityMetric]:
        """Calculate quality metrics for individual items"""
        metrics = []
        item_data = dict(item)

        # Schema validation - check for required fields
        required_fields = self.get_required_fields(item_type)
        missing_fields = [field for field in required_fields if not item_data.get(field)]

        schema_score = max(0, 1 - (len(missing_fields) / len(required_fields)))
        metrics.append(QualityMetric(
            pillar='schema',
            metric_name='field_completeness',
            actual_value=schema_score,
            quality_score=schema_score,
            threshold_min=0.8,
            status='pass' if schema_score >= 0.8 else 'fail'
        ))

        # Data freshness for timestamps
        if 'scrape_timestamp' in item_data:
            freshness_hours = (datetime.now() - item_data['scrape_timestamp']).total_seconds() / 3600
            freshness_score = max(0, 1 - (freshness_hours / 24))
            metrics.append(QualityMetric(
                pillar='freshness',
                metric_name='data_age_hours',
                actual_value=freshness_hours,
                quality_score=freshness_score,
                status='pass' if freshness_hours <= 1 else 'warn'
            ))

        # Store quality metrics
        for metric in metrics:
            self.observability.quality_metrics_buffer.append((self.current_run_id, metric))

        return metrics

    async def calculate_run_quality_metrics(self) -> List[QualityMetric]:
        """Calculate comprehensive quality metrics for the entire run"""

        total_sources = len(self.source_extractions)
        successful_sources = sum(1 for s in self.source_extractions.values() if s['success'])
        total_records = sum(s.get('records_extracted', 0) for s in self.source_extractions.values())

        extraction_data = {
            'extraction_timestamp': datetime.now(),
            'records_extracted': total_records,
            'expected_records': total_sources * 10,  # Estimate 10 records per source
            'schema_violations': self.pipeline_metrics['items_failed'],
            'unique_artists': len(self.processed_items.get('artists', {})),
            'total_tracks': self.pipeline_metrics['items_processed'],
            'sources': list(self.source_extractions.keys())
        }

        return await self.observability.calculate_data_quality_metrics(
            self.current_run_id, extraction_data
        )

    async def end_scraping_run(self, status: str = 'completed', error_details: Dict = None):
        """End the scraping run with comprehensive summary and analysis"""

        if not self.current_run_id:
            logger.warning("No active run to end")
            return

        try:
            # Capture final graph statistics
            await self.capture_graph_statistics('after')

            # Calculate final quality metrics
            quality_metrics = await self.calculate_run_quality_metrics()

            # Track final pipeline metrics
            total_time = (time.time() - self.run_start_time) * 1000
            await self.track_metric('loading', 'total_pipeline_time', total_time, 'ms')
            await self.track_metric('loading', 'run_completed', 1, 'count')

            # Detect anomalies
            current_metrics = {
                'total_pipeline_time_ms': total_time,
                'items_processed_count': self.pipeline_metrics['items_processed'],
                'items_failed_count': self.pipeline_metrics['items_failed'],
                'error_rate': self.pipeline_metrics['items_failed'] / max(1, self.pipeline_metrics['items_processed']),
                'avg_response_time_ms': self.calculate_avg_response_time(),
                'quality_score': self.calculate_overall_quality_score(quality_metrics)
            }

            anomalies = await self.observability.detect_anomalies(self.current_run_id, current_metrics)

            # Track graph impact
            if self.graph_stats_before and self.graph_stats_after:
                await self.observability.track_graph_impact(
                    self.current_run_id, self.graph_stats_before, self.graph_stats_after
                )

            # Calculate summary statistics
            validation_failures = sum(1 for v in self.validation_results if not v.validation_passed)

            # End the run tracking
            await self.observability.end_run_tracking(
                self.current_run_id,
                status,
                playlists_found=len(self.processed_items.get('playlists', {})),
                songs_added=len(self.processed_items.get('songs', {})),
                artists_added=len(self.processed_items.get('artists', {})),
                errors_count=self.pipeline_metrics['items_failed'],
                error_details=error_details
            )

            # Log comprehensive summary
            await self.log_run_summary(status, anomalies, quality_metrics, validation_failures)

        except Exception as e:
            logger.error(f"Error ending scraping run: {e}")
            # Still try to end the run tracking
            await self.observability.end_run_tracking(
                self.current_run_id, 'failed', error_details={'end_run_error': str(e)}
            )

        finally:
            self.current_run_id = None
            self.run_start_time = None

    async def capture_graph_statistics(self, phase: str):
        """Capture current graph statistics for impact analysis"""
        try:
            async with self.pool.acquire() as conn:
                # Get total counts
                total_songs = await conn.fetchval("SELECT COUNT(*) FROM songs")
                total_artists = await conn.fetchval("SELECT COUNT(*) FROM artists")
                total_adjacencies = await conn.fetchval("SELECT COUNT(*) FROM song_adjacency")

                # Get average occurrence count
                avg_occurrence = await conn.fetchval("""
                    SELECT AVG(occurrence_count) FROM song_adjacency
                """) or 0

                # Get most connected nodes
                max_connections = await conn.fetchval("""
                    SELECT MAX(connections) FROM (
                        SELECT song_id_1 as song_id, COUNT(*) as connections FROM song_adjacency GROUP BY song_id_1
                        UNION ALL
                        SELECT song_id_2 as song_id, COUNT(*) as connections FROM song_adjacency GROUP BY song_id_2
                    ) connection_counts
                """) or 0

                stats = {
                    'total_songs': total_songs,
                    'total_artists': total_artists,
                    'total_adjacencies': total_adjacencies,
                    'avg_occurrence_count': float(avg_occurrence),
                    'max_node_connections': max_connections
                }

                if phase == 'before':
                    self.graph_stats_before = stats
                else:
                    self.graph_stats_after = stats

        except Exception as e:
            logger.error(f"Error capturing graph statistics: {e}")

    async def track_metric(self, stage: str, metric_name: str, value: float, unit: str, tags: Dict = None):
        """Track a pipeline metric"""
        metric = PipelineMetric(
            stage=stage,
            metric_name=metric_name,
            metric_value=value,
            metric_unit=unit,
            tags=tags or {}
        )

        if self.current_run_id:
            await self.observability.track_pipeline_metric(self.current_run_id, metric)

    def get_required_fields(self, item_type: str) -> List[str]:
        """Get required fields for item type validation"""
        field_map = {
            'EnhancedTrackItem': ['title', 'primary_artist'],
            'EnhancedArtistItem': ['name'],
            'EnhancedSetlistItem': ['name', 'venue'],
            'EnhancedVenueItem': ['venue_name'],
            'EnhancedTrackAdjacencyItem': ['track_1_name', 'track_2_name']
        }
        return field_map.get(item_type, [])

    def calculate_avg_response_time(self) -> float:
        """Calculate average response time from source extractions"""
        response_times = [
            s.get('response_time_ms', 0) for s in self.source_extractions.values()
            if s.get('response_time_ms') is not None
        ]
        return sum(response_times) / len(response_times) if response_times else 0

    def calculate_overall_quality_score(self, quality_metrics: List[QualityMetric]) -> float:
        """Calculate overall quality score from individual metrics"""
        if not quality_metrics:
            return 1.0

        scores = [m.quality_score for m in quality_metrics]
        return sum(scores) / len(scores)

    async def log_run_summary(self, status: str, anomalies: List, quality_metrics: List, validation_failures: int):
        """Log comprehensive run summary"""
        logger.info(f"\n{'='*80}")
        logger.info(f"SCRAPING RUN SUMMARY - {self.current_run_id}")
        logger.info(f"{'='*80}")
        logger.info(f"Status: {status}")
        logger.info(f"Duration: {(time.time() - self.run_start_time):.2f} seconds")
        logger.info(f"Items Processed: {self.pipeline_metrics['items_processed']}")
        logger.info(f"Items Failed: {self.pipeline_metrics['items_failed']}")
        logger.info(f"Sources Attempted: {len(self.source_extractions)}")
        logger.info(f"Sources Successful: {sum(1 for s in self.source_extractions.values() if s['success'])}")
        logger.info(f"Graph Validations Failed: {validation_failures}")
        logger.info(f"Critical Anomalies: {sum(1 for a in anomalies if a.severity == 'critical')}")
        logger.info(f"Warning Anomalies: {sum(1 for a in anomalies if a.severity == 'warning')}")

        if quality_metrics:
            avg_quality = self.calculate_overall_quality_score(quality_metrics)
            logger.info(f"Overall Quality Score: {avg_quality:.3f}")

        logger.info(f"{'='*80}")

    async def get_dashboard_data(self, limit: int = 20) -> Dict[str, Any]:
        """Get comprehensive dashboard data for frontend"""
        recent_runs = await self.observability.get_recent_runs_summary(limit)

        return {
            'recent_runs': recent_runs,
            'current_run_id': self.current_run_id,
            'pipeline_health': await self.get_pipeline_health_summary()
        }

    async def get_pipeline_health_summary(self) -> Dict[str, Any]:
        """Get pipeline health summary for dashboard"""
        try:
            async with self.observability.pool.acquire() as conn:
                # Get recent health metrics
                health_data = await conn.fetch("""
                    SELECT * FROM pipeline_health_dashboard
                    WHERE time_bucket >= NOW() - INTERVAL '24 hours'
                    ORDER BY time_bucket DESC
                    LIMIT 24
                """)

                return {
                    'hourly_stats': [dict(row) for row in health_data],
                    'status': 'healthy'  # Could be calculated based on thresholds
                }
        except Exception as e:
            logger.error(f"Error getting pipeline health: {e}")
            return {'status': 'error', 'error': str(e)}

    async def close_with_observability(self):
        """Close pipeline with observability cleanup"""
        try:
            # End any active run
            if self.current_run_id:
                await self.end_scraping_run('interrupted')

            # Close parent pipeline
            await super().close()

            # Close observability tracker
            await self.observability.close()

        except Exception as e:
            logger.error(f"Error closing observable pipeline: {e}")