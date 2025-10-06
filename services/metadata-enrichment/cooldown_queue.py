"""
⏳ Cool-Down Queue System - Temporal Re-Enrichment Strategy

This module implements a sophisticated retry strategy that acknowledges the
lifecycle of electronic music: promos → IDs → official releases.

Problem: A track that is unidentifiable TODAY might be identifiable in 3 months
when it gets an official release on Beatport, Spotify, etc.

Solution: Instead of marking tracks as "permanently failed," place them in a
cool-down queue with a future retry timestamp. The system will automatically
re-attempt enrichment after the cool-down period.

Lifecycle Example:
    Day 0:   Track played as "ID - ID" in Above & Beyond's set
    Day 1:   Our system tries to enrich → Fails (no data available)
    Day 1:   → Placed in 90-day cool-down queue
    Day 90:  System automatically retries enrichment
    Day 90:  Track now released on Anjunabeats as "Ilan Bluestone - Frozen Ground"
    Day 90:  → Successfully enriched! 🎉

This transforms our "last resort manual intervention" into an automated,
long-term strategy that matches how the music industry actually works.
"""

import structlog
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from enum import Enum
from sqlalchemy import text

logger = structlog.get_logger(__name__)


class CoolDownStrategy(str, Enum):
    """Strategies for determining cool-down periods"""
    FIXED = "fixed"  # Fixed period (e.g., always 90 days)
    EXPONENTIAL = "exponential"  # Exponential backoff (30d, 60d, 120d, ...)
    ADAPTIVE = "adaptive"  # Based on track characteristics


class CoolDownQueue:
    """
    Manages the cool-down queue for failed enrichments

    Tracks are moved through states:
        failed → pending_re_enrichment → (wait) → pending → (retry) → completed/failed
    """

    def __init__(
        self,
        default_cooldown_days: int = 90,
        max_retry_attempts: int = 5,
        strategy: CoolDownStrategy = CoolDownStrategy.ADAPTIVE
    ):
        self.default_cooldown_days = default_cooldown_days
        self.max_retry_attempts = max_retry_attempts
        self.strategy = strategy

    async def add_to_cooldown(
        self,
        db_session,
        track_id: str,
        failure_reason: str,
        retry_attempt: int = 0,
        track_metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Add a failed track to the cool-down queue

        Args:
            db_session: Database session
            track_id: Track UUID
            failure_reason: Why enrichment failed
            retry_attempt: Current retry attempt number
            track_metadata: Optional metadata to inform cool-down strategy

        Returns:
            True if added successfully
        """
        # Check if max retries exceeded
        if retry_attempt >= self.max_retry_attempts:
            logger.warning(
                "Track exceeded max retry attempts, marking as permanently failed",
                track_id=track_id,
                retry_attempt=retry_attempt,
                max_retries=self.max_retry_attempts
            )

            await self._mark_permanently_failed(db_session, track_id, failure_reason)
            return False

        # Calculate cool-down period
        cooldown_days = self._calculate_cooldown_period(
            retry_attempt=retry_attempt,
            track_metadata=track_metadata
        )

        retry_after = datetime.utcnow() + timedelta(days=cooldown_days)

        try:
            # Update enrichment_status
            query = text("""
                UPDATE enrichment_status
                SET
                    status = 'pending_re_enrichment',
                    retry_after = :retry_after,
                    retry_count = :retry_count,
                    cooldown_reason = :cooldown_reason,
                    cooldown_strategy = :strategy,
                    updated_at = CURRENT_TIMESTAMP
                WHERE track_id = :track_id
            """)

            await db_session.execute(
                query,
                {
                    'track_id': track_id,
                    'retry_after': retry_after,
                    'retry_count': retry_attempt + 1,
                    'cooldown_reason': failure_reason,
                    'strategy': self.strategy.value
                }
            )

            await db_session.commit()

            logger.info(
                "⏳ Track added to cool-down queue",
                track_id=track_id,
                cooldown_days=cooldown_days,
                retry_after=retry_after.isoformat(),
                retry_attempt=retry_attempt
            )

            return True

        except Exception as e:
            await db_session.rollback()
            logger.error(
                "Failed to add track to cool-down queue",
                error=str(e),
                track_id=track_id
            )
            return False

    async def get_ready_for_retry(
        self,
        db_session,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get tracks that are ready to be retried (cool-down period expired)

        Args:
            db_session: Database session
            limit: Maximum number of tracks to return

        Returns:
            List of track dictionaries ready for retry
        """
        try:
            query = text("""
                SELECT
                    t.id,
                    t.title,
                    t.metadata,
                    a.name as artist_name,
                    es.status,
                    es.retry_count,
                    es.retry_after,
                    es.cooldown_reason,
                    es.error_message
                FROM tracks t
                LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.role = 'primary'
                LEFT JOIN artists a ON ta.artist_id = a.artist_id
                JOIN enrichment_status es ON t.id = es.track_id
                WHERE
                    es.status = 'pending_re_enrichment'
                    AND es.retry_after <= CURRENT_TIMESTAMP
                ORDER BY es.retry_after ASC
                LIMIT :limit
            """)

            result = await db_session.execute(query, {'limit': limit})
            tracks = result.fetchall()

            logger.info(
                "⏳ Retrieved tracks ready for retry",
                count=len(tracks),
                limit=limit
            )

            return [dict(row._mapping) for row in tracks]

        except Exception as e:
            logger.error("Failed to retrieve cool-down tracks", error=str(e))
            return []

    async def reset_to_pending(
        self,
        db_session,
        track_id: str
    ) -> bool:
        """
        Reset a cool-down track back to pending status for retry

        Args:
            db_session: Database session
            track_id: Track UUID

        Returns:
            True if reset successfully
        """
        try:
            query = text("""
                UPDATE enrichment_status
                SET
                    status = 'pending',
                    retry_after = NULL,
                    last_attempt = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE track_id = :track_id
                  AND status = 'pending_re_enrichment'
            """)

            result = await db_session.execute(query, {'track_id': track_id})
            await db_session.commit()

            if result.rowcount > 0:
                logger.debug(
                    "Track reset to pending for retry",
                    track_id=track_id
                )
                return True
            else:
                logger.warning(
                    "No track found to reset",
                    track_id=track_id
                )
                return False

        except Exception as e:
            await db_session.rollback()
            logger.error(
                "Failed to reset track to pending",
                error=str(e),
                track_id=track_id
            )
            return False

    def _calculate_cooldown_period(
        self,
        retry_attempt: int,
        track_metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Calculate cool-down period based on strategy with jitter

        Jitter prevents "thundering herd" problem where many tracks
        retry at exactly the same time, overwhelming the system.

        Returns: Number of days for cool-down (with jitter applied)
        """
        import random

        if self.strategy == CoolDownStrategy.FIXED:
            base_cooldown = self.default_cooldown_days

        elif self.strategy == CoolDownStrategy.EXPONENTIAL:
            # Exponential backoff: 30, 60, 120, 240 days
            base_cooldown = min(30 * (2 ** retry_attempt), 365)

        elif self.strategy == CoolDownStrategy.ADAPTIVE:
            # Adaptive strategy based on track characteristics
            base_cooldown = self.default_cooldown_days

            if track_metadata:
                # Factor 1: If track has label, shorter cool-down
                # (labels release on schedules, so we know when to check back)
                metadata = track_metadata.get('metadata', {})
                original_data = metadata.get('original_data', {})
                label = original_data.get('label')

                if label:
                    base_cooldown = 60  # 2 months if we know the label

                # Factor 2: If track is recent, shorter cool-down
                # (recent tracks more likely to get released soon)
                created_at = track_metadata.get('created_at')
                if created_at:
                    from dateutil import parser
                    try:
                        track_age = datetime.utcnow() - parser.parse(str(created_at))
                        if track_age.days < 30:
                            base_cooldown = 45  # 1.5 months for very recent tracks
                    except:
                        pass

                # Factor 3: Exponential component for repeated failures
                backoff_multiplier = 1 + (retry_attempt * 0.5)
                base_cooldown = int(base_cooldown * backoff_multiplier)
                base_cooldown = min(base_cooldown, 365)  # Max 1 year

        else:
            base_cooldown = self.default_cooldown_days

        # Apply jitter (±10% random variation)
        # This prevents thundering herd where many tracks retry simultaneously
        jitter_percent = random.uniform(-0.1, 0.1)
        jittered_cooldown = int(base_cooldown * (1 + jitter_percent))

        # Ensure at least 1 day cooldown
        return max(jittered_cooldown, 1)

    async def _mark_permanently_failed(
        self,
        db_session,
        track_id: str,
        reason: str
    ):
        """
        Mark a track as permanently failed (exceeded max retries)

        Args:
            db_session: Database session
            track_id: Track UUID
            reason: Failure reason
        """
        try:
            query = text("""
                UPDATE enrichment_status
                SET
                    status = 'permanently_failed',
                    error_message = :reason,
                    is_retriable = false,
                    retry_after = NULL,
                    updated_at = CURRENT_TIMESTAMP
                WHERE track_id = :track_id
            """)

            await db_session.execute(
                query,
                {
                    'track_id': track_id,
                    'reason': f"Max retry attempts exceeded. Last failure: {reason}"
                }
            )

            await db_session.commit()

            logger.warning(
                "❌ Track marked as permanently failed",
                track_id=track_id,
                reason=reason
            )

        except Exception as e:
            await db_session.rollback()
            logger.error(
                "Failed to mark track as permanently failed",
                error=str(e),
                track_id=track_id
            )

    async def get_cooldown_stats(self, db_session) -> Dict[str, Any]:
        """
        Get statistics about the cool-down queue

        Returns:
            Dict with queue statistics
        """
        try:
            query = text("""
                SELECT
                    COUNT(*) as total_in_queue,
                    COUNT(*) FILTER (WHERE retry_after <= CURRENT_TIMESTAMP) as ready_now,
                    COUNT(*) FILTER (WHERE retry_after > CURRENT_TIMESTAMP) as waiting,
                    MIN(retry_after) as next_retry_time,
                    AVG(retry_count) as avg_retry_attempts
                FROM enrichment_status
                WHERE status = 'pending_re_enrichment'
            """)

            result = await db_session.execute(query)
            row = result.fetchone()

            stats = {
                'total_in_queue': row.total_in_queue or 0,
                'ready_for_retry': row.ready_now or 0,
                'waiting': row.waiting or 0,
                'next_retry_time': row.next_retry_time.isoformat() if row.next_retry_time else None,
                'avg_retry_attempts': float(row.avg_retry_attempts) if row.avg_retry_attempts else 0.0
            }

            return stats

        except Exception as e:
            logger.error("Failed to get cool-down stats", error=str(e))
            return {}


# ============================================================================
# BATCH OPERATIONS
# ============================================================================

async def process_cooldown_queue(
    db_session_factory,
    enrichment_pipeline,  # Reference to enrichment pipeline
    limit: int = 50
) -> Dict[str, int]:
    """
    Process tracks in cool-down queue that are ready for retry

    This should be called periodically (e.g., daily cron job) to
    automatically retry tracks after their cool-down period expires.

    Args:
        db_session_factory: Database session factory
        enrichment_pipeline: The enrichment pipeline to retry tracks with
        limit: Max tracks to process in this batch

    Returns:
        Stats dict with retry results
    """
    queue = CoolDownQueue()

    stats = {
        'retrieved': 0,
        'reset_to_pending': 0,
        'enrichment_triggered': 0,
        'failed': 0
    }

    try:
        async with db_session_factory() as session:
            # Get tracks ready for retry
            ready_tracks = await queue.get_ready_for_retry(session, limit=limit)
            stats['retrieved'] = len(ready_tracks)

            logger.info(
                "⏳ Processing cool-down queue",
                tracks_ready=len(ready_tracks)
            )

            # Reset each track to pending
            for track in ready_tracks:
                async with db_session_factory() as update_session:
                    success = await queue.reset_to_pending(
                        update_session,
                        track['id']
                    )

                    if success:
                        stats['reset_to_pending'] += 1
                    else:
                        stats['failed'] += 1

            logger.info(
                "✅ Cool-down queue processing completed",
                **stats
            )

            return stats

    except Exception as e:
        logger.error("Cool-down queue processing failed", error=str(e))
        raise


async def move_failed_to_cooldown(
    db_session_factory,
    max_tracks: int = 100
) -> Dict[str, int]:
    """
    Move non-retriable failed tracks to cool-down queue

    This is a utility function to migrate existing failed tracks
    into the cool-down system.

    Args:
        db_session_factory: Database session factory
        max_tracks: Maximum tracks to migrate

    Returns:
        Stats dict with migration results
    """
    queue = CoolDownQueue()

    stats = {
        'candidates': 0,
        'migrated': 0,
        'skipped': 0,
        'failed': 0
    }

    try:
        async with db_session_factory() as session:
            # Find non-retriable failed tracks
            query = text("""
                SELECT
                    t.id,
                    t.title,
                    t.metadata,
                    t.created_at,
                    es.error_message,
                    es.retry_count
                FROM tracks t
                JOIN enrichment_status es ON t.id = es.track_id
                WHERE
                    es.status = 'failed'
                    AND es.is_retriable = false
                    AND (es.retry_count < :max_retries OR es.retry_count IS NULL)
                ORDER BY t.created_at DESC
                LIMIT :limit
            """)

            result = await session.execute(
                query,
                {'max_retries': queue.max_retry_attempts, 'limit': max_tracks}
            )
            failed_tracks = result.fetchall()
            stats['candidates'] = len(failed_tracks)

            logger.info(
                "🔄 Migrating failed tracks to cool-down queue",
                candidates=len(failed_tracks)
            )

            # Add each to cool-down queue
            for track in failed_tracks:
                async with db_session_factory() as update_session:
                    success = await queue.add_to_cooldown(
                        db_session=update_session,
                        track_id=track.id,
                        failure_reason=track.error_message or "No matching data found",
                        retry_attempt=track.retry_count or 0,
                        track_metadata={
                            'metadata': track.metadata,
                            'created_at': track.created_at
                        }
                    )

                    if success:
                        stats['migrated'] += 1
                    else:
                        # Track was marked as permanently failed (max retries)
                        stats['skipped'] += 1

            logger.info(
                "✅ Migration to cool-down queue completed",
                **stats
            )

            return stats

    except Exception as e:
        logger.error("Migration to cool-down queue failed", error=str(e))
        raise


# ============================================================================
# DATABASE SCHEMA UPDATES
# ============================================================================

COOLDOWN_SCHEMA_MIGRATION = """
-- Add columns for cool-down queue management

ALTER TABLE enrichment_status
ADD COLUMN IF NOT EXISTS retry_after TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cooldown_reason TEXT,
ADD COLUMN IF NOT EXISTS cooldown_strategy VARCHAR(20);

-- Create index for efficient cool-down queue queries
CREATE INDEX IF NOT EXISTS idx_enrichment_cooldown_ready
ON enrichment_status(retry_after)
WHERE status = 'pending_re_enrichment' AND retry_after IS NOT NULL;

-- Create view for cool-down queue monitoring
CREATE OR REPLACE VIEW cooldown_queue_summary AS
SELECT
    cooldown_strategy,
    COUNT(*) as track_count,
    COUNT(*) FILTER (WHERE retry_after <= CURRENT_TIMESTAMP) as ready_now,
    AVG(retry_count) as avg_retry_attempts,
    MIN(retry_after) as next_retry,
    MAX(retry_after) as last_retry
FROM enrichment_status
WHERE status = 'pending_re_enrichment'
GROUP BY cooldown_strategy;

COMMENT ON VIEW cooldown_queue_summary IS
'Summary of tracks in cool-down queue by strategy';
"""
