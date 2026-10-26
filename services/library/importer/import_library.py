import json
import logging
from typing import Dict, Any
from common.datalayer.ingest import upsert_track
from common.datalayer.evidence import record as record_evidence
from common.datalayer.outbox import append as append_outbox

logger = logging.getLogger(__name__)

async def process_payload(conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    async with conn.transaction():
        return await _process_payload(conn, payload)

async def _process_payload(conn, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Processes the library ingest payload safely."""
    stats = {
        'tracks': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'appearances': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'rotation_history': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'chart_positions': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'pending': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'rejected': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'beatport_check': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'sources': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'runs': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'sets': {'inserted': 0, 'updated': 0, 'unchanged': 0}
    }

    tracks = payload.get('tracks', [])
    track_id_map = {}
    for track in tracks:
        track_id = track.get('id')
        artist = track.get('artist', 'Unknown')
        title = track.get('title', 'Unknown')

        res = await upsert_track(conn, artist=artist, title=title, bronze_id=None, source='musiclibrary', raw=track, by='ingest')
        canonical_id = res['id']
        track_id_map[track_id] = canonical_id

        await conn.execute("""
            INSERT INTO library.track_xref (source_system, source_id, canonical_id, confidence, norm_key)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (source_system, source_id) DO UPDATE SET canonical_id = EXCLUDED.canonical_id, norm_key = EXCLUDED.norm_key
        """, 'musiclibrary', track_id, canonical_id, 1.0, track.get('norm_key'))

        await conn.execute("""
            INSERT INTO library.tracks (id) VALUES ($1) ON CONFLICT DO NOTHING
        """, canonical_id)

        for evidence_field in ['isrc', 'tidal_id', 'deezer_id', 'genre', 'label', 'release_year']:
            if track.get(evidence_field):
                await record_evidence(conn, canonical_id, evidence_field, track[evidence_field], 'musiclibrary', method='importer')

        if res['status'] == 'created':
            stats['tracks']['inserted'] += 1
        elif res['status'] == 'updated':
            stats['tracks']['updated'] += 1
        else:
            stats['tracks']['unchanged'] += 1

        await append_outbox(conn, 'library_track', canonical_id, 'library.track.upserted.v1', {
            'source_system': 'musiclibrary',
            'source_id': track_id,
            'norm_key': track.get('norm_key'),
            'attributes': track
        })

    for app in payload.get('appearances', []):
        track_id = app.get('track_id')
        canonical_id = track_id_map.get(track_id)
        if canonical_id:
            inserted = await conn.fetchval("""
                INSERT INTO library.appearances (track_id, source, date, chart_rank, created_at)
                SELECT $1, $2, $3::timestamptz, $4, COALESCE($5::timestamptz, NOW())
                WHERE NOT EXISTS (
                    SELECT 1 FROM library.appearances WHERE track_id = $1 AND source = $2 AND date = $3::timestamptz
                )
                RETURNING id
            """, canonical_id, app.get('source'), app.get('date'), app.get('chart_rank'), app.get('created_at'))
            if inserted: stats['appearances']['inserted'] += 1
            else: stats['appearances']['unchanged'] += 1

    for rot in payload.get('rotation_history', []):
        track_id = rot.get('track_id')
        canonical_id = track_id_map.get(track_id)
        if canonical_id:
            inserted = await conn.fetchval("""
                INSERT INTO library.rotation_history (track_id, rotation, changed_at, created_at)
                SELECT $1, $2, $3::timestamptz, COALESCE($4::timestamptz, NOW())
                WHERE NOT EXISTS (
                    SELECT 1 FROM library.rotation_history WHERE track_id = $1 AND rotation = $2 AND changed_at = $3::timestamptz
                )
                RETURNING id
            """, canonical_id, rot.get('rotation'), rot.get('changed_at'), rot.get('created_at'))
            if inserted:
                stats['rotation_history']['inserted'] += 1
                await append_outbox(conn, 'library_track', canonical_id, 'library.track.rotation_changed.v1', {
                    'rotation': rot.get('rotation'),
                    'changed_at': rot.get('changed_at')
                })
            else: stats['rotation_history']['unchanged'] += 1

    for pending in payload.get('pending', []):
        track_id = pending.get('track_id')
        canonical_id = track_id_map.get(track_id)
        if canonical_id:
            inserted = await conn.fetchval("""
                INSERT INTO library.pending (track_id, reason, created_at)
                SELECT $1, $2, COALESCE($3::timestamptz, NOW())
                WHERE NOT EXISTS (
                    SELECT 1 FROM library.pending WHERE track_id = $1 AND reason = $2
                ) RETURNING id
            """, canonical_id, pending.get('reason'), pending.get('created_at'))
            if inserted: stats['pending']['inserted'] += 1
            else: stats['pending']['unchanged'] += 1

    for rej in payload.get('rejected', []):
        track_id = rej.get('track_id')
        canonical_id = track_id_map.get(track_id)
        if canonical_id:
            inserted = await conn.fetchval("""
                INSERT INTO library.rejected (track_id, reason, created_at)
                SELECT $1, $2, COALESCE($3::timestamptz, NOW())
                WHERE NOT EXISTS (
                    SELECT 1 FROM library.rejected WHERE track_id = $1 AND reason = $2
                ) RETURNING id
            """, canonical_id, rej.get('reason'), rej.get('created_at'))
            if inserted: stats['rejected']['inserted'] += 1
            else: stats['rejected']['unchanged'] += 1

    for run in payload.get('runs', []):
        inserted = await conn.fetchval("""
            INSERT INTO library.runs (run_date, status, metrics, created_at)
            SELECT $1::timestamptz, $2, $3::jsonb, COALESCE($4::timestamptz, NOW())
            WHERE NOT EXISTS (
                SELECT 1 FROM library.runs WHERE run_date = $1::timestamptz
            ) RETURNING id
        """, run.get('run_date'), run.get('status'), json.dumps(run.get('metrics', {})), run.get('created_at'))
        if inserted: stats['runs']['inserted'] += 1
        else: stats['runs']['unchanged'] += 1

    for src in payload.get('sources', []):
        inserted = await conn.fetchval("""
            INSERT INTO library.sources (name, type, created_at)
            SELECT $1, $2, COALESCE($3::timestamptz, NOW())
            WHERE NOT EXISTS (
                SELECT 1 FROM library.sources WHERE name = $1 AND type = $2
            ) RETURNING id
        """, src.get('name'), src.get('type'), src.get('created_at'))
        if inserted: stats['sources']['inserted'] += 1
        else: stats['sources']['unchanged'] += 1

    for chart in payload.get('chart_positions', []):
        track_id = chart.get('track_id')
        canonical_id = track_id_map.get(track_id)
        if canonical_id:
            inserted = await conn.fetchval("""
                INSERT INTO library.chart_positions (track_id, chart_name, position, date, created_at)
                SELECT $1, $2, $3, $4::timestamptz, COALESCE($5::timestamptz, NOW())
                WHERE NOT EXISTS (
                    SELECT 1 FROM library.chart_positions WHERE track_id = $1 AND chart_name = $2 AND position = $3 AND date = $4::timestamptz
                ) RETURNING id
            """, canonical_id, chart.get('chart_name'), chart.get('position'), chart.get('date'), chart.get('created_at'))
            if inserted: stats['chart_positions']['inserted'] += 1
            else: stats['chart_positions']['unchanged'] += 1

    for bchk in payload.get('beatport_check', []):
        track_id = bchk.get('track_id')
        canonical_id = track_id_map.get(track_id)
        if canonical_id:
            inserted = await conn.fetchval("""
                INSERT INTO library.beatport_check (track_id, checked_at, result, created_at)
                SELECT $1, $2::timestamptz, $3::jsonb, COALESCE($4::timestamptz, NOW())
                WHERE NOT EXISTS (
                    SELECT 1 FROM library.beatport_check WHERE track_id = $1 AND checked_at = $2::timestamptz
                ) RETURNING id
            """, canonical_id, bchk.get('checked_at'), json.dumps(bchk.get('result')), bchk.get('created_at'))
            if inserted: stats['beatport_check']['inserted'] += 1
            else: stats['beatport_check']['unchanged'] += 1

    for t_tag in payload.get('track_tags', []):
        track_id = t_tag.get('track_id')
        canonical_id = track_id_map.get(track_id)
        if canonical_id:
            await conn.execute("""
                INSERT INTO library.track_tags (track_id, tag, created_at)
                VALUES ($1, $2, COALESCE($3::timestamptz, NOW()))
                ON CONFLICT DO NOTHING
            """, canonical_id, t_tag.get('tag'), t_tag.get('created_at'))

    for s in payload.get('sets', []):
        inserted = await conn.fetchval("""
            INSERT INTO library.sets (id, name, description, created_at, updated_at)
            SELECT $1, $2, $3, COALESCE($4::timestamptz, NOW()), COALESCE($5::timestamptz, NOW())
            WHERE NOT EXISTS (SELECT 1 FROM library.sets WHERE id = $1)
            RETURNING id
        """, s.get('id'), s.get('name'), s.get('description'), s.get('created_at'), s.get('updated_at'))

        if inserted:
            stats['sets']['inserted'] += 1
        else:
            stats['sets']['unchanged'] += 1

    for st in payload.get('set_tracks', []):
        track_id = st.get('track_id')
        canonical_id = track_id_map.get(track_id)
        if canonical_id:
            await conn.execute("""
                INSERT INTO library.set_tracks (set_id, track_id, position, created_at)
                VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))
                ON CONFLICT DO NOTHING
            """, st.get('set_id'), canonical_id, st.get('position'), st.get('created_at'))

    return stats
