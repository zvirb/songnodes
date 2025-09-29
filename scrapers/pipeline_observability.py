"""
Enhanced Pipeline Observability Module for SongNodes
Implements 2025 data pipeline observability best practices including:
- The 5 pillars of data observability (freshness, volume, schema, distribution, lineage)
- Real-time pipeline metrics tracking
- Graph structure validation with adjacency rules
- Anomaly detection and alerting
- Comprehensive source tracking and impact analysis
"""

import asyncio
import asyncpg
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from urllib.parse import urlparse
from collections import defaultdict
import uuid
import hashlib

logger = logging.getLogger(__name__)

@dataclass
class PipelineMetric:
    """Pipeline execution metric"""
    stage: str
    metric_name: str
    metric_value: float
    metric_unit: str
    tags: Dict[str, Any] = None

@dataclass
class SourceExtractionLog:
    """Source extraction attempt log"""
    source_url: str
    website_domain: str
    scraper_used: str
    http_status_code: Optional[int] = None
    response_time_ms: Optional[int] = None
    content_length: Optional[int] = None
    extraction_method: Optional[str] = None
    success: bool = False
    error_message: Optional[str] = None
    extracted_elements: Dict[str, Any] = None
    retry_count: int = 0

@dataclass
class GraphValidationResult:
    """Graph structure validation result"""
    playlist_id: str
    expected_nodes: int
    actual_nodes: int
    expected_edges: int
    actual_edges: int
    same_artist_exceptions: int = 0
    validation_passed: bool = False
    validation_message: Optional[str] = None

@dataclass
class QualityMetric:
    """Data quality metric following the 5 pillars"""
    pillar: str  # freshness, volume, schema, distribution, lineage
    metric_name: str
    actual_value: float
    expected_value: Optional[float] = None
    quality_score: float = 1.0  # 0-1 scale
    threshold_min: Optional[float] = None
    threshold_max: Optional[float] = None
    status: str = 'pass'  # pass, warn, fail

@dataclass
class AnomalyDetection:
    """Anomaly detection result"""
    anomaly_type: str
    severity: str  # info, warning, critical
    metric_name: str
    actual_value: float
    expected_range_min: Optional[float] = None
    expected_range_max: Optional[float] = None
    confidence_score: float = 0.0
    description: str = ""
    suggested_actions: List[str] = None

class PipelineObservabilityTracker:
    """Comprehensive pipeline observability tracker"""

    def __init__(self, database_config: Dict[str, Any]):
        self.database_config = database_config
        self.pool = None
        self.current_run_id = None

        # Metrics collection
        self.metrics_buffer = []
        self.quality_metrics_buffer = []
        self.source_logs_buffer = []

        # Anomaly detection thresholds
        self.anomaly_thresholds = {
            'response_time_ms': {'max': 5000, 'critical': 10000},
            'error_rate': {'max': 0.05, 'critical': 0.20},
            'records_extracted': {'min_change': -0.50, 'max_change': 3.0},
            'quality_score': {'min': 0.80, 'critical': 0.60}
        }

    async def initialize(self):
        """Initialize database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                host=self.database_config['host'],
                port=self.database_config['port'],
                user=self.database_config['user'],
                password=self.database_config['password'],
                database=self.database_config['database'],
                min_size=2,
                max_size=10
            )
            logger.info("Pipeline observability tracker initialized")
        except Exception as e:
            logger.error(f"Failed to initialize observability tracker: {e}")
            raise

    async def start_run_tracking(self, scraper_name: str, tracks_searched: int = 0) -> str:
        """Start tracking a new scraping run"""
        run_id = str(uuid.uuid4())
        self.current_run_id = run_id

        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO scraping_runs (run_id, scraper_name, tracks_searched, status)
                VALUES ($1, $2, $3, 'running')
            """, run_id, scraper_name, tracks_searched)

        logger.info(f"Started tracking run {run_id} for scraper {scraper_name}")
        return run_id

    async def end_run_tracking(self, run_id: str, status: str,
                             playlists_found: int = 0, songs_added: int = 0,
                             artists_added: int = 0, errors_count: int = 0,
                             error_details: Dict = None):
        """End tracking for a scraping run"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                UPDATE scraping_runs
                SET status = $2, playlists_found = $3, songs_added = $4,
                    artists_added = $5, errors_count = $6, error_details = $7,
                    end_time = CURRENT_TIMESTAMP
                WHERE run_id = $1
            """, run_id, status, playlists_found, songs_added, artists_added,
                 errors_count, json.dumps(error_details) if error_details else None)

        # Flush any remaining buffered data
        await self.flush_buffers(run_id)
        logger.info(f"Ended tracking for run {run_id} with status {status}")

    async def track_pipeline_metric(self, run_id: str, metric: PipelineMetric):
        """Track a pipeline execution metric"""
        self.metrics_buffer.append((run_id, metric))

        # Flush buffer periodically
        if len(self.metrics_buffer) >= 10:
            await self.flush_metrics_buffer()

    async def track_source_extraction(self, run_id: str, extraction_log: SourceExtractionLog):
        """Track source extraction attempt"""
        self.source_logs_buffer.append((run_id, extraction_log))

        # Check for response time anomalies
        if extraction_log.response_time_ms:
            await self.check_response_time_anomaly(run_id, extraction_log)

        # Flush buffer periodically
        if len(self.source_logs_buffer) >= 5:
            await self.flush_source_logs_buffer()

    async def validate_graph_structure(self, run_id: str, playlist_id: str,
                                     track_list: List[Dict]) -> GraphValidationResult:
        """Validate graph structure following the n nodes, n-1 edges rule"""

        # Count nodes (unique tracks)
        actual_nodes = len(track_list)

        # Count same-artist exceptions (consecutive tracks by same artist)
        same_artist_exceptions = 0
        for i in range(len(track_list) - 1):
            current_artist = track_list[i].get('artist', '').lower().strip()
            next_artist = track_list[i + 1].get('artist', '').lower().strip()
            if current_artist and next_artist and current_artist == next_artist:
                same_artist_exceptions += 1

        # Calculate expected edges (n-1 minus same-artist exceptions)
        expected_edges = max(0, actual_nodes - 1 - same_artist_exceptions)

        # Get actual edges from database for this playlist
        async with self.pool.acquire() as conn:
            actual_edges = await conn.fetchval("""
                SELECT COUNT(DISTINCT (sa.song_id_1, sa.song_id_2))
                FROM song_adjacency sa
                JOIN playlist_songs ps1 ON sa.song_id_1 = ps1.song_id
                JOIN playlist_songs ps2 ON sa.song_id_2 = ps2.song_id
                WHERE ps1.playlist_id = $1 AND ps2.playlist_id = $1
            """, playlist_id)

            actual_edges = actual_edges or 0

        # Validation logic
        validation_passed = (actual_edges == expected_edges)
        validation_message = None

        if not validation_passed:
            if actual_edges < expected_edges:
                validation_message = f"Missing edges: expected {expected_edges}, got {actual_edges}"
            else:
                validation_message = f"Unexpected edges: expected {expected_edges}, got {actual_edges}"

        result = GraphValidationResult(
            playlist_id=playlist_id,
            expected_nodes=actual_nodes,
            actual_nodes=actual_nodes,
            expected_edges=expected_edges,
            actual_edges=actual_edges,
            same_artist_exceptions=same_artist_exceptions,
            validation_passed=validation_passed,
            validation_message=validation_message
        )

        # Store validation result
        await self.store_graph_validation(run_id, result)

        return result

    async def calculate_data_quality_metrics(self, run_id: str,
                                           extraction_data: Dict[str, Any]) -> List[QualityMetric]:
        """Calculate the 5 pillars of data quality metrics"""
        metrics = []

        # 1. FRESHNESS - How recent is the data
        if 'extraction_timestamp' in extraction_data:
            freshness_hours = (datetime.now() - extraction_data['extraction_timestamp']).total_seconds() / 3600
            freshness_score = max(0, 1 - (freshness_hours / 24))  # Decay over 24 hours
            metrics.append(QualityMetric(
                pillar='freshness',
                metric_name='data_age_hours',
                actual_value=freshness_hours,
                quality_score=freshness_score,
                threshold_max=24.0,
                status='pass' if freshness_hours <= 24 else 'warn'
            ))

        # 2. VOLUME - Amount of data extracted
        records_extracted = extraction_data.get('records_extracted', 0)
        expected_volume = extraction_data.get('expected_records', 10)  # Default expectation

        volume_ratio = records_extracted / max(1, expected_volume)
        volume_score = min(1.0, volume_ratio) if volume_ratio <= 1.5 else max(0.5, 1 / volume_ratio)

        metrics.append(QualityMetric(
            pillar='volume',
            metric_name='records_extracted',
            actual_value=records_extracted,
            expected_value=expected_volume,
            quality_score=volume_score,
            threshold_min=expected_volume * 0.5,
            threshold_max=expected_volume * 2.0,
            status='pass' if 0.8 <= volume_ratio <= 1.2 else 'warn'
        ))

        # 3. SCHEMA - Data structure consistency
        schema_violations = extraction_data.get('schema_violations', 0)
        total_records = max(1, records_extracted)
        schema_score = max(0, 1 - (schema_violations / total_records))

        metrics.append(QualityMetric(
            pillar='schema',
            metric_name='schema_conformity_rate',
            actual_value=schema_score,
            quality_score=schema_score,
            threshold_min=0.95,
            status='pass' if schema_score >= 0.95 else ('warn' if schema_score >= 0.8 else 'fail')
        ))

        # 4. DISTRIBUTION - Data distribution patterns
        if 'unique_artists' in extraction_data and 'total_tracks' in extraction_data:
            unique_artists = extraction_data['unique_artists']
            total_tracks = extraction_data['total_tracks']
            artist_diversity = unique_artists / max(1, total_tracks)

            # Expect reasonable artist diversity (not all same artist, not all different)
            distribution_score = 1.0 - abs(artist_diversity - 0.7)  # Optimal around 70% diversity

            metrics.append(QualityMetric(
                pillar='distribution',
                metric_name='artist_diversity_ratio',
                actual_value=artist_diversity,
                expected_value=0.7,
                quality_score=max(0, distribution_score),
                threshold_min=0.3,
                threshold_max=0.95,
                status='pass' if 0.5 <= artist_diversity <= 0.9 else 'warn'
            ))

        # 5. LINEAGE - Data provenance tracking
        source_count = len(extraction_data.get('sources', []))
        lineage_completeness = 1.0 if source_count > 0 else 0.0

        metrics.append(QualityMetric(
            pillar='lineage',
            metric_name='source_tracking_completeness',
            actual_value=lineage_completeness,
            quality_score=lineage_completeness,
            threshold_min=1.0,
            status='pass' if lineage_completeness == 1.0 else 'fail'
        ))

        # Store quality metrics
        for metric in metrics:
            self.quality_metrics_buffer.append((run_id, metric))

        # Flush if buffer is getting full
        if len(self.quality_metrics_buffer) >= 10:
            await self.flush_quality_metrics_buffer()

        return metrics

    async def detect_anomalies(self, run_id: str, current_metrics: Dict[str, float],
                             historical_window_hours: int = 24) -> List[AnomalyDetection]:
        """Detect anomalies based on historical patterns and thresholds"""
        anomalies = []

        # Get historical metrics for comparison
        async with self.pool.acquire() as conn:
            historical_data = await conn.fetch("""
                SELECT metric_name, AVG(metric_value) as avg_value,
                       STDDEV(metric_value) as stddev_value
                FROM pipeline_execution_metrics pem
                JOIN scraping_runs sr ON pem.run_id = sr.run_id
                WHERE sr.start_time >= NOW() - INTERVAL '%d hours'
                  AND sr.status = 'completed'
                GROUP BY metric_name
            """ % historical_window_hours)

        historical_stats = {row['metric_name']: {
            'avg': float(row['avg_value']) if row['avg_value'] else 0,
            'stddev': float(row['stddev_value']) if row['stddev_value'] else 0
        } for row in historical_data}

        # Check each current metric against patterns
        for metric_name, current_value in current_metrics.items():

            # Threshold-based anomaly detection
            if metric_name in self.anomaly_thresholds:
                threshold = self.anomaly_thresholds[metric_name]

                if 'max' in threshold and current_value > threshold['max']:
                    severity = 'critical' if current_value > threshold.get('critical', float('inf')) else 'warning'
                    anomalies.append(AnomalyDetection(
                        anomaly_type='threshold_violation',
                        severity=severity,
                        metric_name=metric_name,
                        actual_value=current_value,
                        expected_range_max=threshold['max'],
                        confidence_score=0.9,
                        description=f"{metric_name} exceeded threshold: {current_value} > {threshold['max']}",
                        suggested_actions=[f"Investigate {metric_name} performance", "Check system resources"]
                    ))

                if 'min' in threshold and current_value < threshold['min']:
                    severity = 'critical' if current_value < threshold.get('critical', 0) else 'warning'
                    anomalies.append(AnomalyDetection(
                        anomaly_type='threshold_violation',
                        severity=severity,
                        metric_name=metric_name,
                        actual_value=current_value,
                        expected_range_min=threshold['min'],
                        confidence_score=0.9,
                        description=f"{metric_name} below threshold: {current_value} < {threshold['min']}",
                        suggested_actions=[f"Check {metric_name} data source", "Verify pipeline integrity"]
                    ))

            # Statistical anomaly detection (Z-score)
            if metric_name in historical_stats:
                stats = historical_stats[metric_name]
                if stats['stddev'] > 0:
                    z_score = abs(current_value - stats['avg']) / stats['stddev']

                    if z_score > 3:  # 3-sigma rule
                        anomalies.append(AnomalyDetection(
                            anomaly_type='statistical_outlier',
                            severity='warning' if z_score < 4 else 'critical',
                            metric_name=metric_name,
                            actual_value=current_value,
                            expected_range_min=stats['avg'] - 2 * stats['stddev'],
                            expected_range_max=stats['avg'] + 2 * stats['stddev'],
                            confidence_score=min(0.99, z_score / 5),
                            description=f"{metric_name} is {z_score:.2f} standard deviations from historical average",
                            suggested_actions=["Review recent changes", "Compare with similar time periods"]
                        ))

        # Store anomalies
        for anomaly in anomalies:
            await self.store_anomaly(run_id, anomaly)

        return anomalies

    async def track_graph_impact(self, run_id: str, before_stats: Dict[str, float],
                               after_stats: Dict[str, float]):
        """Track how new data impacts existing graph relationships"""

        impact_analyses = []

        for metric_name, after_value in after_stats.items():
            before_value = before_stats.get(metric_name, 0)

            if before_value > 0:
                change_magnitude = after_value - before_value
                change_percentage = (change_magnitude / before_value) * 100

                # Determine significance
                significance = 'low'
                if abs(change_percentage) > 50:
                    significance = 'critical'
                elif abs(change_percentage) > 20:
                    significance = 'high'
                elif abs(change_percentage) > 5:
                    significance = 'medium'

                async with self.pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO graph_impact_analysis
                        (run_id, analysis_type, entity_type, entity_id, metric_name,
                         value_before, value_after, change_magnitude, change_percentage, significance_level)
                        VALUES ($1, 'graph_metrics', 'adjacency', $2, $3, $4, $5, $6, $7, $8)
                    """, run_id, str(uuid.uuid4()), metric_name, before_value,
                         after_value, change_magnitude, change_percentage, significance)

    # Buffer management methods
    async def flush_buffers(self, run_id: str):
        """Flush all data buffers"""
        await self.flush_metrics_buffer()
        await self.flush_quality_metrics_buffer()
        await self.flush_source_logs_buffer()

    async def flush_metrics_buffer(self):
        """Flush pipeline metrics buffer to database"""
        if not self.metrics_buffer:
            return

        async with self.pool.acquire() as conn:
            for run_id, metric in self.metrics_buffer:
                await conn.execute("""
                    INSERT INTO pipeline_execution_metrics
                    (run_id, stage, metric_name, metric_value, metric_unit, tags)
                    VALUES ($1, $2, $3, $4, $5, $6)
                """, run_id, metric.stage, metric.metric_name, metric.metric_value,
                     metric.metric_unit, json.dumps(metric.tags or {}))

        self.metrics_buffer.clear()

    async def flush_quality_metrics_buffer(self):
        """Flush quality metrics buffer to database"""
        if not self.quality_metrics_buffer:
            return

        async with self.pool.acquire() as conn:
            for run_id, metric in self.quality_metrics_buffer:
                await conn.execute("""
                    INSERT INTO data_quality_metrics
                    (run_id, pillar, metric_name, expected_value, actual_value,
                     quality_score, threshold_min, threshold_max, status)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """, run_id, metric.pillar, metric.metric_name, metric.expected_value,
                     metric.actual_value, metric.quality_score, metric.threshold_min,
                     metric.threshold_max, metric.status)

        self.quality_metrics_buffer.clear()

    async def flush_source_logs_buffer(self):
        """Flush source extraction logs buffer to database"""
        if not self.source_logs_buffer:
            return

        async with self.pool.acquire() as conn:
            for run_id, log in self.source_logs_buffer:
                await conn.execute("""
                    INSERT INTO source_extraction_log
                    (run_id, source_url, website_domain, scraper_used, http_status_code,
                     response_time_ms, content_length, extraction_method, success,
                     error_message, extracted_elements, retry_count)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                """, run_id, log.source_url, log.website_domain, log.scraper_used,
                     log.http_status_code, log.response_time_ms, log.content_length,
                     log.extraction_method, log.success, log.error_message,
                     json.dumps(log.extracted_elements or {}), log.retry_count)

        self.source_logs_buffer.clear()

    # Helper methods
    async def store_graph_validation(self, run_id: str, result: GraphValidationResult):
        """Store graph validation result"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO graph_validation_results
                (run_id, playlist_id, expected_nodes, actual_nodes, expected_edges,
                 actual_edges, same_artist_exceptions, validation_passed, validation_message)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """, run_id, result.playlist_id, result.expected_nodes, result.actual_nodes,
                 result.expected_edges, result.actual_edges, result.same_artist_exceptions,
                 result.validation_passed, result.validation_message)

    async def store_anomaly(self, run_id: str, anomaly: AnomalyDetection):
        """Store anomaly detection result"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO anomaly_detection
                (run_id, anomaly_type, severity, metric_name, expected_range_min,
                 expected_range_max, actual_value, confidence_score, description, suggested_actions)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """, run_id, anomaly.anomaly_type, anomaly.severity, anomaly.metric_name,
                 anomaly.expected_range_min, anomaly.expected_range_max, anomaly.actual_value,
                 anomaly.confidence_score, anomaly.description,
                 json.dumps(anomaly.suggested_actions or []))

    async def check_response_time_anomaly(self, run_id: str, extraction_log: SourceExtractionLog):
        """Check for response time anomalies"""
        if not extraction_log.response_time_ms:
            return

        threshold = self.anomaly_thresholds.get('response_time_ms', {})
        if extraction_log.response_time_ms > threshold.get('max', 5000):
            severity = 'critical' if extraction_log.response_time_ms > threshold.get('critical', 10000) else 'warning'

            anomaly = AnomalyDetection(
                anomaly_type='slow_response',
                severity=severity,
                metric_name='response_time_ms',
                actual_value=extraction_log.response_time_ms,
                expected_range_max=threshold['max'],
                confidence_score=0.95,
                description=f"Slow response from {extraction_log.website_domain}: {extraction_log.response_time_ms}ms",
                suggested_actions=["Check network connectivity", "Monitor target website performance"]
            )

            await self.store_anomaly(run_id, anomaly)

    async def get_recent_runs_summary(self, limit: int = 20) -> List[Dict]:
        """Get summary of recent scraping runs for dashboard"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM scraping_run_summary
                ORDER BY start_time DESC
                LIMIT $1
            """, limit)

            return [dict(row) for row in rows]

    async def close(self):
        """Close database connections"""
        if self.pool:
            await self.pool.close()
            logger.info("Pipeline observability tracker closed")