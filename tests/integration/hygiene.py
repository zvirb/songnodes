"""Cleanup for tests that run next to the live worker, which projects and enqueues work asynchronously.

After a test deletes its source rows, derived rows (projection) and outbox events about the now-missing aggregates can
still appear or remain. This removes exactly those orphans, limited to events created since the test began.
"""


def started_at(sql) -> str:
    return sql('SELECT clock_timestamp()').strip()


def remove_orphans(sql, started: str) -> None:
    sql(f"""BEGIN;
        DELETE FROM projection_tracks p WHERE NOT EXISTS (SELECT 1 FROM silver_enriched_tracks t WHERE t.id = p.track_id);
        DELETE FROM outbox_events e WHERE e.created_at >= '{started}'::timestamptz AND (
            (e.aggregate_type = 'track' AND NOT EXISTS (SELECT 1 FROM silver_enriched_tracks t WHERE t.id = e.aggregate_id))
         OR (e.aggregate_type = 'setlist' AND NOT EXISTS (SELECT 1 FROM silver_enriched_playlists p WHERE p.id = e.aggregate_id))
         OR (e.aggregate_type = 'artist' AND NOT EXISTS (SELECT 1 FROM silver_enriched_artists a WHERE a.id = e.aggregate_id)));
        COMMIT;""")
