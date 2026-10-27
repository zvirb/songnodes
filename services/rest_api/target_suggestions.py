import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

async def get_target_suggestions(pool, limit: int = 20) -> List[Dict[str, Any]]:
    # 1. We want tracks from silver_enriched_tracks
    # 2. Priority tracks played on >=2 Melbourne shows. We can check `event_location ILIKE '%Melbourne%'`
    #    in silver_enriched_playlists, joined through silver_playlist_tracks.
    # 3. 0 existing target/scrape records. target_tracks table has `title` and `artist`.
    #    We should exclude tracks that match existing target_tracks by title and artist, or join by something if there's an ID.
    #    Actually target_tracks has `title` and `artist`.
    # 4. low graph edge density: maybe check gold_track_graph or silver_track_transitions?
    #    We can check `gold_track_graph.total_outgoing_edges` or simply the count of transitions from `silver_track_transitions`.

    query = """
    WITH melbourne_shows AS (
        SELECT pt.track_id, COUNT(DISTINCT p.id) as melbourne_show_count
        FROM silver_playlist_tracks pt
        JOIN silver_enriched_playlists p ON pt.playlist_id = p.id
        WHERE p.event_location ILIKE '%Melbourne%'
           OR p.event_name ILIKE '%Melbourne%'
        GROUP BY pt.track_id
    ),
    edge_density AS (
        SELECT from_track_id as track_id, COUNT(*) as edge_count
        FROM silver_track_transitions
        GROUP BY from_track_id
    ),
    existing_targets AS (
        SELECT lower(trim(title)) as title, lower(trim(artist)) as artist
        FROM target_tracks
    )
    SELECT
        t.id,
        t.track_title as title,
        t.artist_name as artist,
        t.genre as genres,
        t.key as camelot_key,
        COALESCE(ms.melbourne_show_count, 0) as melbourne_shows,
        COALESCE(ed.edge_count, 0) as edge_count
    FROM silver_enriched_tracks t
    LEFT JOIN melbourne_shows ms ON t.id = ms.track_id
    LEFT JOIN edge_density ed ON t.id = ed.track_id
    WHERE NOT EXISTS (
        SELECT 1 FROM existing_targets et
        WHERE et.title = lower(trim(t.track_title))
          AND et.artist = lower(trim(t.artist_name))
    )
    """

    async with pool.acquire() as conn:
        rows = await conn.fetch(query)

    if not rows:
        return []

    suggestions = []
    for row in rows:
        score = 0
        rationales = []

        if row['melbourne_shows'] >= 2:
            score += 50
            rationales.append(f"Heard on {row['melbourne_shows']} Melbourne shows")

        # We need "tracks in camelot keys with low graph edge density"
        # Let's say edge_count <= 2 is low. We can adjust.
        if row['camelot_key'] and row['edge_count'] <= 2:
            score += 30
            rationales.append(f"Low graph edge density in key {row['camelot_key']} ({row['edge_count']} edges)")
        elif row['edge_count'] <= 2:
            score += 15
            rationales.append(f"Low graph edge density ({row['edge_count']} edges)")

        # Give some base score for not being in targets (which is all of them based on the WHERE clause)
        score += 10
        rationales.append("0 existing target records")

        # Basic cleanup for genres array which could be None
        genres = row["genres"] if row["genres"] else []

        suggestions.append({
            "title": row["title"],
            "artist": row["artist"],
            "genres": genres,
            "rationale": " • ".join(rationales) if rationales else "Candidate for discovery",
            "priority_score": score
        })

    # Sort by priority_score descending
    suggestions.sort(key=lambda x: x["priority_score"], reverse=True)

    return suggestions[:limit]
