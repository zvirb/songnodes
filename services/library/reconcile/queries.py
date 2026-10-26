import asyncpg
from typing import List, Dict, Any

async def fetch_library_tracks(conn: asyncpg.Connection) -> List[Dict[str, Any]]:
    query = """
        SELECT
            lt.id,
            tx.norm_key,
            st.artist_name,
            st.track_title,
            e1.value#>>'{}' AS isrc,
            e2.value#>>'{}' AS musicbrainz_id
        FROM library.tracks lt
        JOIN silver_enriched_tracks st ON st.id = lt.id
        LEFT JOIN library.track_xref tx ON tx.canonical_id = lt.id AND tx.source_system = 'musiclibrary'
        LEFT JOIN silver_track_metadata_evidence e1 ON e1.track_id = lt.id AND e1.field = 'isrc'
        LEFT JOIN silver_track_metadata_evidence e2 ON e2.track_id = lt.id AND e2.field = 'musicbrainz_id'
    """
    rows = await conn.fetch(query)
    return [dict(row) for row in rows]

async def fetch_silver_tracks(conn: asyncpg.Connection) -> List[Dict[str, Any]]:
    query = """
        SELECT
            t.id,
            t.artist_name,
            t.track_title,
            e1.value#>>'{}' AS isrc,
            e2.value#>>'{}' AS musicbrainz_id
        FROM silver_enriched_tracks t
        LEFT JOIN silver_track_metadata_evidence e1 ON e1.track_id = t.id AND e1.field = 'isrc'
        LEFT JOIN silver_track_metadata_evidence e2 ON e2.track_id = t.id AND e2.field = 'musicbrainz_id'
    """
    rows = await conn.fetch(query)
    return [dict(row) for row in rows]
