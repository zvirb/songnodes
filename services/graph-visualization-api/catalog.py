"""Read models for the checked-in silver catalog and directed transitions.

This is the PostgreSQL baseline, not the future Memgraph or search implementation.
All graph routes share identity, visibility, and edge-endpoint rules here.
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from common.track_metadata import stored_metadata


VISIBLE_TRACK = """trim(t.artist_name) != '' AND lower(trim(t.artist_name)) NOT IN
    ('unknown', 'unknown artist', 'various artists', 'va')"""


def track_uuid(node_id):
    value = node_id.removeprefix('song_')
    try:
        return UUID(value)
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=422, detail="Invalid track/node ID")


def node_from_row(row):
    metadata = {
        'title': row.track_title, 'artist': row.artist_name,
        'label': f'{row.artist_name} - {row.track_title}', 'node_type': 'song',
        'category': row.genre[0] if row.genre else None,
        'genre': row.genre[0] if row.genre else None, 'genres': row.genre,
        'release_year': row.release_date.year if row.release_date else None,
        'bpm': float(row.bpm) if row.bpm is not None else None,
        'musical_key': row.key, 'key': row.key,
        'energy': float(row.energy) if row.energy is not None else None,
        'danceability': float(row.danceability) if row.danceability is not None else None,
        'valence': float(row.valence) if row.valence is not None else None,
        'duration_ms': row.duration_ms, 'spotify_id': row.spotify_id, 'isrc': row.isrc,
        'release_date': row.release_date.isoformat() if row.release_date else None,
    }
    metadata.update(stored_metadata(dict(row._mapping)))
    return {'id': f'song_{row.id}', 'track_id': str(row.id),
            'artist': row.artist_name, 'title': row.track_title,
            'position': {'x': 0.0, 'y': 0.0}, 'metadata': metadata}


async def neighborhood_ids(session, center, depth, max_nodes):
    center = track_uuid(center)
    found = await session.scalar(text(f'SELECT id FROM silver_enriched_tracks t WHERE id = :id AND {VISIBLE_TRACK}'), {'id': center})
    if found is None:
        return []
    seen = {center}
    frontier = [center]
    for _ in range(depth):
        remaining = max_nodes - len(seen)
        if not frontier or remaining <= 0:
            break
        result = await session.execute(text(f"""
            WITH candidates AS (
                SELECT to_track_id AS id FROM silver_track_transitions
                WHERE from_track_id = ANY(CAST(:frontier AS uuid[]))
                UNION
                SELECT from_track_id AS id FROM silver_track_transitions
                WHERE to_track_id = ANY(CAST(:frontier AS uuid[]))
            )
            SELECT t.id FROM candidates c JOIN silver_enriched_tracks t ON t.id = c.id
            WHERE {VISIBLE_TRACK} AND NOT(t.id = ANY(CAST(:seen AS uuid[])))
            ORDER BY t.id LIMIT :remaining
        """), {'frontier': frontier, 'seen': list(seen), 'remaining': remaining})
        frontier = list(result.scalars())
        seen.update(frontier)
    return list(seen)


async def nodes(session, center=None, depth=1, max_nodes=5000, limit=5000, offset=0):
    params = {'limit': min(limit, max_nodes), 'offset': offset}
    condition = VISIBLE_TRACK
    if center is not None:
        params['ids'] = await neighborhood_ids(session, center, depth, max_nodes)
        condition += ' AND t.id = ANY(CAST(:ids AS uuid[]))'
    total = await session.scalar(text(f'SELECT count(*) FROM silver_enriched_tracks t WHERE {condition}'), params)
    result = await session.execute(text(f"""
        SELECT t.* FROM silver_enriched_tracks t WHERE {condition}
        ORDER BY t.created_at DESC, t.id LIMIT :limit OFFSET :offset
    """), params)
    return {'nodes': [node_from_row(row) for row in result],
            'total': total, 'limit': params['limit'], 'offset': offset}


async def edges(session, node_ids=None, limit=30000, offset=0):
    params = {'limit': limit, 'offset': offset}
    condition = f"""{VISIBLE_TRACK} AND EXISTS (
        SELECT 1 FROM silver_enriched_tracks t WHERE t.id = e.to_track_id AND {VISIBLE_TRACK}
    )"""
    if node_ids is not None:
        params['ids'] = [track_uuid(value) for value in node_ids]
        # Both endpoints must be present; [] means an empty subgraph, never all edges.
        condition += ' AND e.from_track_id = ANY(CAST(:ids AS uuid[])) AND e.to_track_id = ANY(CAST(:ids AS uuid[]))'
    base = f'FROM silver_track_transitions e JOIN silver_enriched_tracks t ON t.id = e.from_track_id WHERE {condition}'
    total = await session.scalar(text(f'SELECT count(*) {base}'), params)
    result = await session.execute(text(f"""
        SELECT e.* {base} ORDER BY e.occurrence_count DESC, e.from_track_id, e.to_track_id
        LIMIT :limit OFFSET :offset
    """), params)
    values = []
    for row in result:
        source, target = f'song_{row.from_track_id}', f'song_{row.to_track_id}'
        values.append({'id': f'{source}__{target}', 'source': source, 'target': target,
                       'weight': float(row.occurrence_count), 'type': 'sequential', 'edge_type': 'sequential'})
    return {'edges': values, 'total': total, 'limit': limit, 'offset': offset}


async def graph(session, limit=5000, center=None, depth=1):
    node_result = await nodes(session, center, depth, limit, limit)
    edge_result = await edges(session, [node['id'] for node in node_result['nodes']])
    return {'nodes': node_result['nodes'], 'edges': edge_result['edges'], 'metadata': {
        'total_nodes': len(node_result['nodes']), 'total_edges': len(edge_result['edges']),
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }}


async def search(session, query, limit=20, offset=0):
    # Literal substring search for the baseline; typo-tolerant search belongs to milestone 5.
    query = query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="Search query must not be blank")
    pattern = '%' + query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
    condition = f'{VISIBLE_TRACK} AND (t.track_title ILIKE :query OR t.artist_name ILIKE :query)'
    params = {'query': pattern, 'limit': limit, 'offset': offset}
    total = await session.scalar(text(f'SELECT count(*) FROM silver_enriched_tracks t WHERE {condition}'), params)
    rows = await session.execute(text(f"""
        SELECT t.* FROM silver_enriched_tracks t WHERE {condition}
        ORDER BY lower(t.track_title), t.id LIMIT :limit OFFSET :offset
    """), params)
    return {'results': [{'id': f'song_{row.id}', 'title': row.track_title,
                          'artist': row.artist_name, 'score': 1.0, 'highlights': {}} for row in rows],
            'total': total, 'suggestions': []}


async def statistics(session):
    total_nodes = await session.scalar(text(f'SELECT count(*) FROM silver_enriched_tracks t WHERE {VISIBLE_TRACK}'))
    edge_totals = (await session.execute(text(f"""
        SELECT count(*) AS total_edges, coalesce(sum(e.occurrence_count), 0) AS total_occurrences,
               coalesce(avg(e.occurrence_count), 0) AS avg_occurrence_count,
               coalesce(max(e.occurrence_count), 0) AS max_occurrence_count
        FROM silver_track_transitions e JOIN silver_enriched_tracks t ON t.id = e.from_track_id
        WHERE {VISIBLE_TRACK} AND EXISTS (
            SELECT 1 FROM silver_enriched_tracks t WHERE t.id = e.to_track_id AND {VISIBLE_TRACK})
    """))).mappings().one()
    genres = await session.execute(text(f"""
        SELECT t.genre[1] AS genre, count(*) AS count FROM silver_enriched_tracks t
        WHERE {VISIBLE_TRACK} AND t.genre[1] IS NOT NULL
        GROUP BY t.genre[1] ORDER BY count(*) DESC, t.genre[1] LIMIT 10
    """))
    database_stats = {}
    for label, table in [('total_tracks', 'silver_enriched_tracks'), ('total_artists', 'silver_enriched_artists'),
                         ('total_playlists', 'silver_enriched_playlists'), ('total_playlist_tracks', 'silver_playlist_tracks')]:
        database_stats[label] = await session.scalar(text(f'SELECT count(*) FROM {table}'))
    return {'graph_stats': {'nodes': {'total_nodes': total_nodes, 'song_nodes': total_nodes,
                                    'artist_nodes': 0, 'nodes_with_artists': total_nodes, 'nodes_without_artists': 0},
                            'edges': dict(edge_totals), 'top_genres': [dict(row._mapping) for row in genres]},
            'database_stats': database_stats,
            'metadata': {'generated_at': datetime.now(timezone.utc).isoformat(), 'cache_status': 'fresh'}}
