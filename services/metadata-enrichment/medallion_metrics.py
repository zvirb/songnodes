"""
Custom Prometheus exporter for Medallion architecture metrics

This module exports metrics about the Bronze/Silver/Gold data layers
to provide observability into the Medallion architecture data flow.
"""

import asyncio
import logging
from typing import Optional
from prometheus_client import Gauge, Counter, Histogram
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

logger = logging.getLogger(__name__)

# Medallion Layer Record Counts
bronze_layer_records = Gauge(
    'medallion_bronze_records_total',
    'Total records in bronze layer (raw scraped data)',
    ['source']
)

silver_layer_records = Gauge(
    'medallion_silver_records_total',
    'Total records in silver layer (enriched data)'
)

gold_layer_records = Gauge(
    'medallion_gold_records_total',
    'Total records in gold layer (analytics-ready data)'
)

# Data Quality Metrics
data_quality_score = Gauge(
    'medallion_data_quality_score',
    'Average data quality score (0.0-1.0)',
    ['layer']
)

enrichment_completeness = Gauge(
    'medallion_enrichment_completeness',
    'Percentage of fields successfully enriched',
    ['field_category']
)

# Data Flow Metrics
bronze_to_silver_lag_seconds = Histogram(
    'medallion_bronze_to_silver_lag_seconds',
    'Time lag between bronze ingestion and silver enrichment',
    buckets=[60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400]
)

silver_to_gold_lag_seconds = Histogram(
    'medallion_silver_to_gold_lag_seconds',
    'Time lag between silver enrichment and gold materialization',
    buckets=[60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400]
)

# Waterfall Enrichment Metrics
waterfall_provider_wins = Counter(
    'waterfall_provider_wins_total',
    'Number of times each provider successfully enriched a field',
    ['provider', 'field_name']
)

waterfall_fallback_count = Counter(
    'waterfall_fallback_count_total',
    'Number of times waterfall fell back to next provider',
    ['from_provider', 'to_provider', 'field_name']
)

fields_enriched_per_run = Histogram(
    'waterfall_fields_enriched_per_run',
    'Number of fields successfully enriched in a single waterfall run',
    buckets=[0, 5, 10, 15, 20, 25, 30, 35, 40]
)

# Configuration Reload Metrics
configuration_reload_total = Counter(
    'enrichment_configuration_reload_total',
    'Number of times enrichment configuration was reloaded',
    ['status']
)


async def collect_medallion_metrics(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """
    Collect and export Medallion architecture metrics

    Args:
        session_factory: AsyncSessionmaker for database connections
    """
    try:
        async with session_factory() as session:
            # Bronze layer counts by source
            result = await session.execute(text("""
                SELECT
                    COALESCE(source, 'unknown') as source,
                    COUNT(*) as count
                FROM bronze_scraped_tracks
                GROUP BY source
            """))

            for row in result:
                bronze_layer_records.labels(source=row.source).set(row.count)

            # Silver layer count
            result = await session.execute(text("""
                SELECT COUNT(*) as count
                FROM silver_enriched_tracks
            """))
            row = result.fetchone()
            if row:
                silver_layer_records.set(row.count)

            # Gold layer count (if table exists)
            try:
                result = await session.execute(text("""
                    SELECT COUNT(*) as count
                    FROM gold_track_analytics
                """))
                row = result.fetchone()
                if row:
                    gold_layer_records.set(row.count)
            except Exception as e:
                logger.debug(f"Gold layer table not found or query failed: {e}")

            # Data quality scores
            result = await session.execute(text("""
                SELECT AVG(
                    CASE
                        WHEN artist IS NOT NULL THEN 0.2 ELSE 0 END +
                    CASE
                        WHEN title IS NOT NULL THEN 0.2 ELSE 0 END +
                    CASE
                        WHEN bpm IS NOT NULL THEN 0.2 ELSE 0 END +
                    CASE
                        WHEN key IS NOT NULL THEN 0.2 ELSE 0 END +
                    CASE
                        WHEN release_date IS NOT NULL THEN 0.2 ELSE 0 END
                ) as quality_score
                FROM bronze_scraped_tracks
            """))
            row = result.fetchone()
            if row and row.quality_score is not None:
                data_quality_score.labels(layer='bronze').set(float(row.quality_score))

            # Silver data quality (more comprehensive)
            result = await session.execute(text("""
                SELECT AVG(
                    CASE WHEN artist IS NOT NULL THEN 0.1 ELSE 0 END +
                    CASE WHEN title IS NOT NULL THEN 0.1 ELSE 0 END +
                    CASE WHEN bpm IS NOT NULL THEN 0.1 ELSE 0 END +
                    CASE WHEN musical_key IS NOT NULL THEN 0.1 ELSE 0 END +
                    CASE WHEN release_date IS NOT NULL THEN 0.1 ELSE 0 END +
                    CASE WHEN spotify_id IS NOT NULL THEN 0.1 ELSE 0 END +
                    CASE WHEN musicbrainz_id IS NOT NULL THEN 0.1 ELSE 0 END +
                    CASE WHEN danceability IS NOT NULL THEN 0.05 ELSE 0 END +
                    CASE WHEN energy IS NOT NULL THEN 0.05 ELSE 0 END +
                    CASE WHEN valence IS NOT NULL THEN 0.05 ELSE 0 END +
                    CASE WHEN acousticness IS NOT NULL THEN 0.05 ELSE 0 END +
                    CASE WHEN instrumentalness IS NOT NULL THEN 0.05 ELSE 0 END +
                    CASE WHEN liveness IS NOT NULL THEN 0.05 ELSE 0 END +
                    CASE WHEN speechiness IS NOT NULL THEN 0.05 ELSE 0 END
                ) as quality_score
                FROM silver_enriched_tracks
            """))
            row = result.fetchone()
            if row and row.quality_score is not None:
                data_quality_score.labels(layer='silver').set(float(row.quality_score))

            # Enrichment completeness by category
            result = await session.execute(text("""
                SELECT
                    'identifiers' as category,
                    AVG(
                        CASE WHEN spotify_id IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN musicbrainz_id IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN isrc IS NOT NULL THEN 1 ELSE 0 END
                    ) / 3.0 as completeness
                FROM silver_enriched_tracks
                UNION ALL
                SELECT
                    'audio_features' as category,
                    AVG(
                        CASE WHEN danceability IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN energy IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN valence IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN acousticness IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN instrumentalness IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN liveness IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN speechiness IS NOT NULL THEN 1 ELSE 0 END
                    ) / 7.0 as completeness
                FROM silver_enriched_tracks
                UNION ALL
                SELECT
                    'metadata' as category,
                    AVG(
                        CASE WHEN bpm IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN musical_key IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN release_date IS NOT NULL THEN 1 ELSE 0 END +
                        CASE WHEN genre IS NOT NULL THEN 1 ELSE 0 END
                    ) / 4.0 as completeness
                FROM silver_enriched_tracks
            """))

            for row in result:
                enrichment_completeness.labels(
                    field_category=row.category
                ).set(float(row.completeness))

            # Data flow lag metrics (Bronze -> Silver)
            result = await session.execute(text("""
                SELECT
                    EXTRACT(EPOCH FROM (s.enriched_at - b.scraped_at))::FLOAT as lag_seconds
                FROM silver_enriched_tracks s
                JOIN bronze_scraped_tracks b ON b.id = s.bronze_track_id
                WHERE s.enriched_at IS NOT NULL
                    AND b.scraped_at IS NOT NULL
                    AND s.enriched_at > b.scraped_at
                ORDER BY s.enriched_at DESC
                LIMIT 1000
            """))

            for row in result:
                if row.lag_seconds and row.lag_seconds > 0:
                    bronze_to_silver_lag_seconds.observe(row.lag_seconds)

            logger.info("Medallion metrics collected successfully")

    except Exception as e:
        logger.error(f"Error collecting Medallion metrics: {e}", exc_info=True)


async def start_metrics_collector(
    session_factory: async_sessionmaker[AsyncSession],
    interval_seconds: int = 60
) -> None:
    """
    Start the metrics collection loop

    Args:
        session_factory: AsyncSessionmaker for database connections
        interval_seconds: How often to collect metrics (default: 60s)
    """
    logger.info(f"Starting Medallion metrics collector (interval: {interval_seconds}s)")

    while True:
        try:
            await collect_medallion_metrics(session_factory)
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            logger.info("Metrics collector cancelled")
            break
        except Exception as e:
            logger.error(f"Error in metrics collection loop: {e}", exc_info=True)
            await asyncio.sleep(interval_seconds)


def record_waterfall_enrichment(
    field_name: str,
    provider: str,
    fallback_chain: Optional[list[str]] = None
) -> None:
    """
    Record metrics about a waterfall enrichment operation

    Args:
        field_name: Name of the field being enriched
        provider: Provider that successfully enriched the field
        fallback_chain: List of providers tried before success (if any)
    """
    # Record the winning provider
    waterfall_provider_wins.labels(
        provider=provider,
        field_name=field_name
    ).inc()

    # Record fallback chain if applicable
    if fallback_chain and len(fallback_chain) > 1:
        for i in range(len(fallback_chain) - 1):
            waterfall_fallback_count.labels(
                from_provider=fallback_chain[i],
                to_provider=fallback_chain[i + 1],
                field_name=field_name
            ).inc()


def record_enrichment_run(fields_enriched: int) -> None:
    """
    Record metrics about a complete enrichment run

    Args:
        fields_enriched: Number of fields successfully enriched
    """
    fields_enriched_per_run.observe(fields_enriched)


def record_config_reload(success: bool) -> None:
    """
    Record a configuration reload event

    Args:
        success: Whether the reload was successful
    """
    status = 'success' if success else 'error'
    configuration_reload_total.labels(status=status).inc()
