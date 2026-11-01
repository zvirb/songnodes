import logging
import os
from datetime import date, datetime, timezone
from typing import Any, Dict, Optional, Tuple
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from . import jobs

logger = logging.getLogger('songnodes.target_scrape')

# DS24B: the owner's scheduled-scrape window (table scrape_window, migration 260). Melbourne calendar days,
# both ends inclusive; a null end is open. No table or no row means no window. Manual scrapes never read it.
TIMEZONE = 'Australia/Melbourne'
Window = Tuple[Optional[date], Optional[date]]
WINDOW_SQL = 'SELECT starts_on, ends_on, updated_at FROM scrape_window LIMIT 1'


def melbourne_date(now: datetime) -> date:
    """The Melbourne calendar day for an aware instant (AEST/AEDT from the tz database)."""
    return now.astimezone(ZoneInfo(TIMEZONE)).date()


async def today_in_melbourne(conn, now: Optional[datetime] = None) -> date:
    """Today in Melbourne. python:3.15-slim may have no tz database and no tzdata package is installed,
    so without one Postgres (which always has it) answers instead."""
    try:
        return melbourne_date(now or datetime.now(timezone.utc))
    except ZoneInfoNotFoundError:
        return await conn.fetchval(f"SELECT (NOW() AT TIME ZONE '{TIMEZONE}')::date")


def is_missing_table(error: Exception) -> bool:
    return type(error).__name__ == 'UndefinedTableError'


async def read_window(conn) -> Optional[Any]:
    """The window row, or None when the table or the row is missing."""
    try:
        return await conn.fetchrow(WINDOW_SQL)
    except Exception as error:
        if is_missing_table(error):
            logger.warning('scrape_window table is missing (apply sql/migrations/260_scrape_window_up.sql); no window')
            return None
        raise


def inside_window(window: Window, today: date) -> bool:
    starts_on, ends_on = window
    return (starts_on is None or today >= starts_on) and (ends_on is None or today <= ends_on)


async def scrape_targets(conn) -> Dict[str, Any]:
    enabled = os.getenv('SCRAPE_TARGETS_ENABLED', 'true').lower() == 'true'
    if not enabled:
        return {'selected': 0, 'enqueued': 0, 'skipped_existing': 0}

    row = await read_window(conn)
    window: Window = (row['starts_on'], row['ends_on']) if row else (None, None)
    if window != (None, None):
        today = await today_in_melbourne(conn)
        if not inside_window(window, today):
            starts_on, ends_on = (d.isoformat() if d else None for d in window)
            logger.info('scrape_targets skipped: today %s (%s) is outside the window %s to %s',
                        today.isoformat(), TIMEZONE, starts_on or 'open', ends_on or 'open')
            return {'selected': 0, 'enqueued': 0, 'skipped_existing': 0, 'outside_window': True,
                    'starts_on': starts_on, 'ends_on': ends_on}

    limit = int(os.getenv('SCRAPE_TARGETS_PER_RUN', '2'))
    days = int(os.getenv('TARGET_RESEARCH_DAYS', '7'))
    sources = [s.strip() for s in os.getenv('SCRAPE_TARGET_SOURCES', 'mixesdb,1001tracklists').split(',') if s.strip()]

    # Query with priority ordering: high = 1, medium = 2, low = 3 (or standard string order if enum not used, wait)
    # The table defines priority IN ('low', 'medium', 'high')
    # So CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    query = f"""
        WITH next_targets AS (
            SELECT track_id, artist, title
            FROM target_tracks
            WHERE is_active = TRUE
              AND archived = FALSE
              AND (last_searched IS NULL OR last_searched < NOW() - make_interval(days => $1))
            ORDER BY
                CASE priority
                    WHEN 'high' THEN 1
                    WHEN 'medium' THEN 2
                    ELSE 3
                END,
                last_searched NULLS FIRST,
                added_at
            LIMIT $2
            FOR UPDATE SKIP LOCKED
        )
        UPDATE target_tracks t
        SET last_searched = NOW(), updated_at = NOW()
        FROM next_targets
        WHERE t.track_id = next_targets.track_id
        RETURNING next_targets.track_id, next_targets.artist, next_targets.title
    """

    rows = await conn.fetch(query, days, limit)

    selected = len(rows)
    enqueued = 0
    skipped_existing = 0

    now_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    for row in rows:
        artist = (row['artist'] or '').strip()
        title = (row['title'] or '').strip()

        if not artist or not title:
            continue

        search_query = f"{artist} {title}"

        for source in sources:
            key = f"target:{row['track_id']}:{source}:{now_date}"
            payload = {
                'source': source,
                'search_query': search_query,
                'target_track_id': str(row['track_id'])
            }
            _, created = await jobs.enqueue(conn, 'scrape', key, payload)
            if created:
                enqueued += 1
            else:
                skipped_existing += 1

    logger.info('scrape_targets run: selected=%d, enqueued=%d, skipped_existing=%d', selected, enqueued, skipped_existing)

    return {'selected': selected, 'enqueued': enqueued, 'skipped_existing': skipped_existing}


async def record_playlists_found(conn, payload: Dict[str, Any], bronze_playlists: int) -> Optional[int]:
    """Write `target_tracks.playlists_found` once a scrape job for a target has its result.

    The count is the latest search's count, not a running total: the bronze playlists persisted by every
    succeeded scrape job for this target created since the scheduler last stamped `last_searched` (one job per
    source), plus this job's own. A running total would grow on every weekly re-search, because the scraper
    upserts a playlist it has seen before and reports it again.

    Retries cannot double count: the runner calls the handler, this update and `jobs.complete` in one
    transaction, so a failed attempt rolls the update back, and the sum only reads jobs that already succeeded
    (this job is added once, by its own count). A job from an older search (created before `last_searched`)
    leaves the count alone. The target row is locked first, so two source jobs finishing together see each
    other's committed result. The scraper reports playlists the source search returned for the target's
    query; it does not check each tracklist for the track itself.

    Returns the new count, or None when the payload names no target or the target was not updated.
    """
    try:
        target_id = UUID(str(payload['target_track_id']))
    except (KeyError, ValueError):
        return None   # not a target scrape (or a hand-made payload with a bad id): nothing to record
    job_id = payload.get('job_id')
    job_id = UUID(str(job_id)) if job_id else None
    async with conn.transaction():
        locked = await conn.fetchrow(
            'SELECT last_searched FROM target_tracks WHERE track_id = $1::uuid FOR UPDATE', target_id)
        if locked is None:
            return None
        return await conn.fetchval("""
            UPDATE target_tracks t
            SET playlists_found = $2 + COALESCE((
                    SELECT SUM(COALESCE((j.result->>'bronze_playlists')::int, 0))
                    FROM ingestion_jobs j
                    WHERE j.kind = 'scrape' AND j.status = 'succeeded'
                      AND j.payload->>'target_track_id' = t.track_id::text
                      AND (t.last_searched IS NULL OR j.created_at >= t.last_searched)
                      AND ($3::uuid IS NULL OR j.id <> $3::uuid)), 0),
                updated_at = NOW()
            WHERE t.track_id = $1::uuid
              AND ($3::uuid IS NULL OR t.last_searched IS NULL OR NOT EXISTS (
                    SELECT 1 FROM ingestion_jobs own WHERE own.id = $3::uuid AND own.created_at < t.last_searched))
            RETURNING t.playlists_found
        """, target_id, int(bronze_playlists), job_id)
