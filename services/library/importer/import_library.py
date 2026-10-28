import json
import logging
from datetime import date, datetime, time
from typing import Any
from zoneinfo import ZoneInfo

from common.datalayer.evidence import apply_all as apply_evidence
from common.datalayer.evidence import apply_energy
from common.datalayer.evidence import record as record_evidence
from common.datalayer.ingest import upsert_track
from common.datalayer.outbox import append as append_outbox
from common.metadata import energy as energy_model

logger = logging.getLogger(__name__)
MELBOURNE = ZoneInfo('Australia/Melbourne')


def _ts(value: Any) -> datetime | None:
    """A timestamptz parameter: asyncpg accepts only datetime objects, never text.

    A date-only string ('2026-10-24') is a Melbourne calendar date and becomes local midnight; a naive
    timestamp is read as Melbourne time. Unparseable values become None so the caller's default applies.
    """
    if value is None or value == '':
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=MELBOURNE)
    if isinstance(value, date):
        return datetime.combine(value, time.min, MELBOURNE)
    if isinstance(value, str):
        text = value.strip().replace('Z', '+00:00')
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        if len(text) == 10:  # YYYY-MM-DD
            return datetime.combine(parsed.date(), time.min, MELBOURNE)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=MELBOURNE)
    return None


def _service_id(value: Any) -> str | None:
    """'https://tidal.com/browse/track/503838165' or 'https://www.deezer.com/track/2378543155' -> the numeric id."""
    if value is None:
        return None
    text = str(value).strip().rstrip('/')
    tail = text.rsplit('/', 1)[-1].split('?', 1)[0]
    return tail if tail.isdigit() else None


def _is_export(payload: dict[str, Any]) -> bool:
    """True for musicLibrary's outputs/artifact/library.json, whose tracks use the page's short keys (a, t, ...)."""
    tracks = payload.get('tracks') or []
    return bool(tracks) and isinstance(tracks[0], dict) and 'a' in tracks[0] and 't' in tracks[0] and 'artist' not in tracks[0]


def _from_export(payload: dict[str, Any]) -> dict[str, Any]:
    """Map the musicLibrary export (the Library page's file) onto the ingest sections this importer reads.

    Tracks: a/t/m/lbl/g/bpm/k/d/dz/tidal become artist/title/mix_name/label/genre/bpm/key/duration_ms/deezer_id/
    tidal_id, so upsert_track records them as evidence. tags become track_tags, rot becomes the current rotation
    (as of the export's `generated` time), and each source in src becomes an appearance on the track's last-heard
    date, plus one on its first-heard date, so first and last survive the round trip. Runs and sources pass through.
    """
    as_of = payload.get('generated') or payload.get('ledger_updated')
    out: dict[str, Any] = {'tracks': [], 'track_tags': [], 'rotation_history': [], 'appearances': [],
                           'runs': payload.get('runs', []),
                           'sources': [{'name': s.get('id') or s.get('name'), 'type': s.get('type') or 'radio'}
                                       for s in payload.get('sources', []) if isinstance(s, dict) and (s.get('id') or s.get('name'))]}
    for t in payload.get('tracks', []):
        tid = t.get('id')
        if not tid or not (t.get('a') or '').strip() or not (t.get('t') or '').strip():
            continue  # never import a track without both artist and title (CLAUDE.md, artist attribution)
        out['tracks'].append({
            'id': tid, 'artist': t['a'].strip(), 'title': t['t'].strip(), 'mix_name': t.get('m'), 'label': t.get('lbl'),
            # The Library page reads its pillar (House, Techno, UKG) from the genre column, so the pillar wins.
            'genre': t.get('p') or t.get('g'), 'bpm': t.get('bpm'), 'key': t.get('k'), 'energy': t.get('e'),
            'duration_ms': int(t['d'] * 1000) if isinstance(t.get('d'), (int, float)) and t['d'] > 0 else None,
            'deezer_id': _service_id(t.get('dz')), 'tidal_id': _service_id(t.get('tidal')),
            'export': t,
        })
        out['track_tags'] += [{'track_id': tid, 'tag': tag} for tag in t.get('tags') or [] if tag]
        if t.get('rot') is not None and as_of:
            out['rotation_history'].append({'track_id': tid, 'rotation': t['rot'], 'changed_at': as_of})
        sources = [s for s in t.get('src') or [] if s]
        if t.get('last'):
            out['appearances'] += [{'track_id': tid, 'source': s, 'date': t['last']} for s in sources]
        if t.get('first') and t.get('first') != t.get('last') and sources:
            out['appearances'].append({'track_id': tid, 'source': sources[0], 'date': t['first']})
    return out

async def process_payload(conn, payload: dict[str, Any]) -> dict[str, Any]:
    if _is_export(payload):
        payload = _from_export(payload)
    async with conn.transaction():
        return await _process_payload(conn, payload)

async def _process_payload(conn, payload: dict[str, Any]) -> dict[str, Any]:
    """Processes the library ingest payload safely."""
    stats = {
        'tracks': {'inserted': 0, 'updated': 0, 'unchanged': 0, 'skipped': 0},
        'appearances': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'rotation_history': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'chart_positions': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'pending': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'rejected': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'beatport_check': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'sources': {'inserted': 0, 'updated': 0, 'unchanged': 0},
        'runs': {'inserted': 0, 'updated': 0, 'unchanged': 0, 'skipped': 0},
        'sets': {'inserted': 0, 'updated': 0, 'unchanged': 0}
    }

    tracks = payload.get('tracks', [])
    logged_release_year_skip = False
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
            if evidence_field == 'label':
                if track.get('label'):
                    await record_evidence(conn, canonical_id, 'record_label', track['label'], 'musiclibrary', method='importer')
            elif evidence_field == 'release_year':
                if track.get('release_year'):
                    if not logged_release_year_skip:
                        logger.info("Skipping unallowed evidence field release_year in this import run.")
                        logged_release_year_skip = True
                    stats['tracks']['skipped'] += 1
            else:
                if track.get(evidence_field):
                    await record_evidence(conn, canonical_id, evidence_field, track[evidence_field], 'musiclibrary', method='importer')
        await apply_evidence(conn, canonical_id)  # write the recorded ids, label and genre onto the track

        if track.get('energy') is not None:  # the musicLibrary 1-10 estimate, kept as evidence with its source
            await apply_energy(conn, canonical_id, [energy_model.reading(track['energy'], '1-10', 'provider', 'musiclibrary_export')])

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
            """, canonical_id, app.get('source'), _ts(app.get('date')), app.get('chart_rank'), _ts(app.get('created_at')))
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
            """, canonical_id, None if rot.get('rotation') is None else str(rot.get('rotation')), _ts(rot.get('changed_at')), _ts(rot.get('created_at')))
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
            """, canonical_id, pending.get('reason'), _ts(pending.get('created_at')))
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
            """, canonical_id, rej.get('reason'), _ts(rej.get('created_at')))
            if inserted: stats['rejected']['inserted'] += 1
            else: stats['rejected']['unchanged'] += 1

    for idx, run in enumerate(payload.get('runs', [])):
        run_date_val = _ts(run.get('run_date')) or _ts(run.get('date'))

        if not run_date_val:
            logger.warning(f"Skipping run at index {idx} due to missing valid date.")
            stats['runs']['skipped'] += 1
            continue

        status = run.get('status', 'completed')

        metrics = run.get('metrics')
        if metrics is None:
            exclude_keys = {'date', 'run_date', 'status', 'metrics', 'created_at'}
            metrics = {k: v for k, v in run.items() if k not in exclude_keys}

        inserted = await conn.fetchval("""
            INSERT INTO library.runs (run_date, status, metrics, created_at)
            SELECT $1::timestamptz, $2, $3::jsonb, COALESCE($4::timestamptz, NOW())
            WHERE NOT EXISTS (
                SELECT 1 FROM library.runs WHERE run_date = $1::timestamptz
            ) RETURNING id
        """, run_date_val, status, json.dumps(metrics), _ts(run.get('created_at')))
        if inserted: stats['runs']['inserted'] += 1
        else: stats['runs']['unchanged'] += 1

    for src in payload.get('sources', []):
        inserted = await conn.fetchval("""
            INSERT INTO library.sources (name, type, created_at)
            SELECT $1, $2, COALESCE($3::timestamptz, NOW())
            WHERE NOT EXISTS (
                SELECT 1 FROM library.sources WHERE name = $1 AND type = $2
            ) RETURNING id
        """, src.get('name'), src.get('type'), _ts(src.get('created_at')))
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
            """, canonical_id, chart.get('chart_name'), chart.get('position'), _ts(chart.get('date')), _ts(chart.get('created_at')))
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
            """, canonical_id, _ts(bchk.get('checked_at')), json.dumps(bchk.get('result')), _ts(bchk.get('created_at')))
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
            """, canonical_id, t_tag.get('tag'), _ts(t_tag.get('created_at')))

    for s in payload.get('sets', []):
        inserted = await conn.fetchval("""
            INSERT INTO library.sets (id, name, description, created_at, updated_at)
            SELECT $1, $2, $3, COALESCE($4::timestamptz, NOW()), COALESCE($5::timestamptz, NOW())
            WHERE NOT EXISTS (SELECT 1 FROM library.sets WHERE id = $1)
            RETURNING id
        """, s.get('id'), s.get('name'), s.get('description'), _ts(s.get('created_at')), _ts(s.get('updated_at')))

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
            """, st.get('set_id'), canonical_id, st.get('position'), _ts(st.get('created_at')))

    return stats
