#!/usr/bin/env python3
"""
Reprocess Failed Enrichments Script

This script identifies tracks that failed enrichment and resets them for re-processing.
It supports:
- Date range filtering
- Specific track ID filtering
- Filtering by failure type (all failed, retriable only, non-retriable)
- Different enrichment sources
- Dry-run mode for safe testing
- Immediate triggering of re-enrichment (optional)

Usage Examples:
    # Dry-run: See what would be reprocessed
    python reprocess_failed_enrichments.py --dry-run

    # Reset all failed tracks from last 7 days
    python reprocess_failed_enrichments.py --days 7

    # Reset specific track
    python reprocess_failed_enrichments.py --track-id abc123-def456-...

    # Reset only retriable failures (circuit breaker errors)
    python reprocess_failed_enrichments.py --retriable-only

    # Reset failures for specific source
    python reprocess_failed_enrichments.py --source spotify --limit 100

    # Reset and immediately trigger enrichment
    python reprocess_failed_enrichments.py --trigger-now --limit 50

Author: Claude Code (Anthropic)
Version: 1.0.0
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

import asyncpg
import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),
    logger_factory=structlog.WriteLoggerFactory(),
    cache_logger_on_first_use=False,
)

logger = structlog.get_logger(__name__)


class EnrichmentReprocessor:
    """Handles resetting failed enrichments for re-processing"""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        """Establish database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            logger.info("Database connection pool created successfully")
        except Exception as e:
            logger.error("Failed to connect to database", error=str(e))
            raise

    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("Database connection pool closed")

    async def find_failed_tracks(
        self,
        days: Optional[int] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        track_ids: Optional[List[str]] = None,
        retriable_only: bool = False,
        non_retriable_only: bool = False,
        source_filter: Optional[str] = None,
        limit: int = 100
    ) -> List[dict]:
        """
        Find tracks that failed enrichment based on filters

        Args:
            days: Only include tracks that failed in last N days
            start_date: Filter by start date
            end_date: Filter by end date
            track_ids: Specific track IDs to process
            retriable_only: Only retriable failures (circuit breaker errors)
            non_retriable_only: Only non-retriable failures
            source_filter: Filter by source that failed (spotify, musicbrainz, etc.)
            limit: Maximum number of tracks to return

        Returns:
            List of track records with failure information
        """
        conditions = []
        params = {}

        # Base condition: failed or partial status
        if not retriable_only and not non_retriable_only:
            conditions.append("(es.status = 'failed' OR es.status = 'partial')")
        else:
            if retriable_only:
                conditions.append("es.status = 'failed' AND es.is_retriable = true")
            if non_retriable_only:
                conditions.append("es.status = 'failed' AND (es.is_retriable = false OR es.is_retriable IS NULL)")

        # Date range filtering
        if track_ids:
            placeholders = ', '.join(f"${i+1}" for i in range(len(track_ids)))
            conditions.append(f"es.track_id IN ({placeholders})")
            for idx, track_id in enumerate(track_ids, start=1):
                params[f"${idx}"] = UUID(track_id)
        else:
            # Date filtering only if not using specific track IDs
            if days:
                param_name = f"${len(params) + 1}"
                conditions.append(f"es.last_attempt >= CURRENT_TIMESTAMP - INTERVAL '{days} days'")
            elif start_date:
                param_name = f"${len(params) + 1}"
                conditions.append(f"es.last_attempt >= {param_name}")
                params[param_name] = start_date

            if end_date:
                param_name = f"${len(params) + 1}"
                conditions.append(f"es.last_attempt <= {param_name}")
                params[param_name] = end_date

        # Source filtering
        if source_filter:
            param_name = f"${len(params) + 1}"
            conditions.append(f"es.error_message ILIKE {param_name}")
            params[param_name] = f"%{source_filter}%"

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        query = f"""
            SELECT
                es.track_id,
                t.title,
                STRING_AGG(DISTINCT a.name, ', ') as artists,
                es.status,
                es.sources_enriched,
                es.retry_count,
                es.last_attempt,
                es.error_message,
                es.is_retriable
            FROM enrichment_status es
            JOIN tracks t ON es.track_id = t.id
            LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.role = 'primary'
            LEFT JOIN artists a ON ta.artist_id = a.artist_id
            WHERE {where_clause}
            GROUP BY es.track_id, t.title, es.status, es.sources_enriched,
                     es.retry_count, es.last_attempt, es.error_message, es.is_retriable
            ORDER BY es.last_attempt DESC
            LIMIT {limit}
        """

        try:
            # Convert params dict to list for asyncpg
            param_values = [params[k] for k in sorted(params.keys())]

            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, *param_values)

            results = []
            for row in rows:
                results.append({
                    'track_id': str(row['track_id']),
                    'title': row['title'],
                    'artists': row['artists'] or 'Unknown',
                    'status': row['status'],
                    'sources_enriched': row['sources_enriched'],
                    'retry_count': row['retry_count'],
                    'last_attempt': row['last_attempt'],
                    'error_message': row['error_message'],
                    'is_retriable': row['is_retriable']
                })

            logger.info(
                "Found failed tracks",
                count=len(results),
                filters={
                    'days': days,
                    'retriable_only': retriable_only,
                    'source_filter': source_filter
                }
            )

            return results

        except Exception as e:
            logger.error("Failed to query failed tracks", error=str(e))
            raise

    async def reset_to_pending(
        self,
        track_ids: List[str],
        dry_run: bool = False
    ) -> int:
        """
        Reset tracks to pending status for re-enrichment

        Args:
            track_ids: List of track IDs to reset
            dry_run: If True, don't actually update the database

        Returns:
            Number of tracks reset
        """
        if not track_ids:
            logger.warning("No track IDs provided for reset")
            return 0

        if dry_run:
            logger.info(
                "DRY RUN: Would reset tracks to pending",
                count=len(track_ids)
            )
            return len(track_ids)

        query = """
            UPDATE enrichment_status
            SET
                status = 'pending',
                error_message = NULL,
                is_retriable = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE track_id = ANY($1::uuid[])
        """

        try:
            async with self.pool.acquire() as conn:
                result = await conn.execute(
                    query,
                    [UUID(tid) for tid in track_ids]
                )

                # Parse "UPDATE N" response
                updated_count = int(result.split()[-1])

            logger.info(
                "Reset tracks to pending status",
                count=updated_count,
                track_ids_sample=track_ids[:5]
            )

            return updated_count

        except Exception as e:
            logger.error("Failed to reset tracks", error=str(e))
            raise

    async def trigger_enrichment(
        self,
        track_ids: List[str],
        api_url: str = "http://localhost:8020"
    ):
        """
        Trigger immediate enrichment via API

        Args:
            track_ids: List of track IDs to enrich
            api_url: Base URL of metadata-enrichment service
        """
        import aiohttp

        try:
            async with aiohttp.ClientSession() as session:
                url = f"{api_url}/enrich/trigger"
                params = {'limit': len(track_ids)}

                async with session.post(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        logger.info(
                            "Triggered enrichment via API",
                            response=data
                        )
                    else:
                        error_text = await response.text()
                        logger.error(
                            "Failed to trigger enrichment",
                            status=response.status,
                            error=error_text
                        )
        except Exception as e:
            logger.error("Failed to trigger enrichment via API", error=str(e))


async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Reprocess failed track enrichments",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry-run to see what would be reprocessed
  %(prog)s --dry-run

  # Reset all failed tracks from last 7 days
  %(prog)s --days 7

  # Reset specific tracks
  %(prog)s --track-id abc123 --track-id def456

  # Reset only retriable failures
  %(prog)s --retriable-only --limit 200

  # Reset failures for specific source
  %(prog)s --source spotify --limit 100

  # Reset and immediately trigger enrichment
  %(prog)s --trigger-now --limit 50
        """
    )

    parser.add_argument(
        '--days',
        type=int,
        help='Only process tracks that failed in last N days'
    )
    parser.add_argument(
        '--start-date',
        type=str,
        help='Start date filter (YYYY-MM-DD)'
    )
    parser.add_argument(
        '--end-date',
        type=str,
        help='End date filter (YYYY-MM-DD)'
    )
    parser.add_argument(
        '--track-id',
        action='append',
        dest='track_ids',
        help='Specific track ID to process (can be used multiple times)'
    )
    parser.add_argument(
        '--retriable-only',
        action='store_true',
        help='Only process retriable failures (circuit breaker errors)'
    )
    parser.add_argument(
        '--non-retriable-only',
        action='store_true',
        help='Only process non-retriable failures'
    )
    parser.add_argument(
        '--source',
        choices=['spotify', 'musicbrainz', 'discogs', 'lastfm', 'beatport'],
        help='Filter by source that failed'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=100,
        help='Maximum number of tracks to process (default: 100)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be reset without actually doing it'
    )
    parser.add_argument(
        '--trigger-now',
        action='store_true',
        help='Immediately trigger enrichment after reset (via API)'
    )
    parser.add_argument(
        '--api-url',
        default='http://localhost:8020',
        help='Metadata enrichment service API URL (default: http://localhost:8020)'
    )
    parser.add_argument(
        '--database-url',
        default=os.getenv(
            'DATABASE_URL',
            'postgresql://musicdb_user:musicdb_secure_pass_2024@localhost:5433/musicdb'
        ),
        help='PostgreSQL database URL (default: from DATABASE_URL env var)'
    )

    args = parser.parse_args()

    # Parse dates
    start_date = None
    end_date = None
    if args.start_date:
        start_date = datetime.strptime(args.start_date, '%Y-%m-%d')
    if args.end_date:
        end_date = datetime.strptime(args.end_date, '%Y-%m-%d')

    # Fix database URL - asyncpg doesn't support SQLAlchemy driver notation
    database_url = args.database_url.replace('postgresql+asyncpg://', 'postgresql://')

    # Initialize reprocessor
    reprocessor = EnrichmentReprocessor(database_url)

    try:
        await reprocessor.connect()

        # Find failed tracks
        logger.info("Searching for failed tracks...")
        failed_tracks = await reprocessor.find_failed_tracks(
            days=args.days,
            start_date=start_date,
            end_date=end_date,
            track_ids=args.track_ids,
            retriable_only=args.retriable_only,
            non_retriable_only=args.non_retriable_only,
            source_filter=args.source,
            limit=args.limit
        )

        if not failed_tracks:
            logger.info("No failed tracks found matching criteria")
            return 0

        # Display summary
        print(f"\nFound {len(failed_tracks)} failed track(s):\n")
        print(f"{'Track ID':<40} {'Title':<40} {'Artists':<30} {'Status':<12} {'Retries':<8} {'Error'}")
        print("-" * 160)

        for track in failed_tracks[:20]:  # Show first 20
            error_preview = (track['error_message'] or 'No error message')[:50]
            print(
                f"{track['track_id']:<40} "
                f"{track['title'][:39]:<40} "
                f"{track['artists'][:29]:<30} "
                f"{track['status']:<12} "
                f"{track['retry_count']:<8} "
                f"{error_preview}"
            )

        if len(failed_tracks) > 20:
            print(f"\n... and {len(failed_tracks) - 20} more tracks")

        # Reset tracks
        track_ids = [t['track_id'] for t in failed_tracks]
        updated_count = await reprocessor.reset_to_pending(
            track_ids=track_ids,
            dry_run=args.dry_run
        )

        print(f"\n{'[DRY RUN] Would reset' if args.dry_run else 'Reset'} {updated_count} track(s) to pending status")

        # Trigger enrichment if requested
        if args.trigger_now and not args.dry_run:
            print("\nTriggering immediate enrichment...")
            await reprocessor.trigger_enrichment(
                track_ids=track_ids,
                api_url=args.api_url
            )

        return updated_count

    except Exception as e:
        logger.error("Script failed", error=str(e), exc_info=True)
        return -1
    finally:
        await reprocessor.close()


if __name__ == '__main__':
    exit_code = asyncio.run(main())
    sys.exit(0 if exit_code >= 0 else 1)
