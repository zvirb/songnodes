import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict

from . import jobs

logger = logging.getLogger('songnodes.target_scrape')


async def scrape_targets(conn) -> Dict[str, Any]:
    enabled = os.getenv('SCRAPE_TARGETS_ENABLED', 'true').lower() == 'true'
    if not enabled:
        return {'selected': 0, 'enqueued': 0, 'skipped_existing': 0}

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
