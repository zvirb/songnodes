"""`projection_tracks`: a denormalised, rebuildable read model of the silver catalog.

It is the first outbox consumer and the template for later ones (search, graph). Handlers are keyed
upserts/deletes, so replays, retries and re-ordering of unrelated aggregates are harmless. Energy bands
are computed here from the versioned contract, so a ratified contract change is applied by `rebuild`.
"""
import json
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from common.metadata import energy

CONSUMER = 'projection_tracks'

SOURCE_COLUMNS = """
    id, artist_name, track_title, bpm, key, camelot_key, energy, energy_canonical, energy_source, energy_calibrated,
    energy_contract_version, genre, record_label, mix_name, isrc, tidal_id, deezer_id, duration_ms,
    metadata_review, updated_at
"""


def project_row(row) -> Dict[str, Any]:
    """Map a silver row to a projection row. Unknown energy stays NULL; legacy 0-1 energy converts but is
    flagged uncalibrated and never receives a band."""
    value: Optional[Decimal] = row['energy_canonical']
    calibrated = row['energy_calibrated']
    source = row['energy_source']
    if value is None and row['energy'] is not None:
        legacy = energy.legacy_reading(row['energy'])
        value, calibrated, source = legacy.value, False, legacy.source
    calibrated = bool(calibrated) if value is not None else None
    return {
        'track_id': row['id'], 'artist_name': row['artist_name'], 'track_title': row['track_title'],
        'bpm': row['bpm'], 'key': row['key'], 'camelot_key': row['camelot_key'],
        'energy_canonical': value, 'energy_band': energy.classify_band(value, bool(calibrated)),
        'energy_calibrated': calibrated, 'energy_contract_version': energy.CONTRACT_VERSION if value is not None else None,
        'genre': row['genre'], 'record_label': row['record_label'], 'mix_name': row['mix_name'], 'isrc': row['isrc'],
        'tidal_id': row['tidal_id'], 'deezer_id': row['deezer_id'], 'duration_ms': row['duration_ms'],
        'metadata_review': row['metadata_review'], 'source_updated_at': row['updated_at'],
    }


COLUMNS = ['track_id', 'artist_name', 'track_title', 'bpm', 'key', 'camelot_key', 'energy_canonical', 'energy_band',
           'energy_calibrated', 'energy_contract_version', 'genre', 'record_label', 'mix_name', 'isrc', 'tidal_id',
           'deezer_id', 'duration_ms', 'metadata_review', 'source_updated_at']
UPSERT = f"""
    INSERT INTO projection_tracks ({', '.join(COLUMNS)}, projected_at)
    VALUES ({', '.join(f'${i}' for i in range(1, len(COLUMNS) + 1))}, NOW())
    ON CONFLICT (track_id) DO UPDATE SET {', '.join(f'{c} = EXCLUDED.{c}' for c in COLUMNS[1:])}, projected_at = NOW()
"""


async def project_track(conn, track_id: UUID) -> str:
    row = await conn.fetchrow(f'SELECT {SOURCE_COLUMNS} FROM silver_enriched_tracks WHERE id = $1', track_id)
    if row is None:
        await conn.execute('DELETE FROM projection_tracks WHERE track_id = $1', track_id)
        return 'deleted'
    values = project_row(row)
    await conn.execute(UPSERT, *[values[c] for c in COLUMNS])
    return 'upserted'


async def project_artist_tracks(conn, artist_name: str) -> int:
    ids = await conn.fetch('SELECT id FROM silver_enriched_tracks WHERE artist_name = $1', artist_name)
    for record in ids:
        await project_track(conn, record['id'])
    return len(ids)


async def handle_event(conn, event) -> None:
    """Idempotent handler for the events written by catalog writes, enrichment and merges."""
    kind, aggregate = event['event_type'], event['aggregate_id']
    payload = event['payload'] if isinstance(event['payload'], dict) else json.loads(event['payload'])
    if event['aggregate_type'] == 'track':
        await project_track(conn, aggregate)                     # created/updated/deleted/merged: re-read truth
        if kind == 'merged' and payload.get('survivor_id'):
            await project_track(conn, UUID(payload['survivor_id']))
    elif event['aggregate_type'] == 'artist':
        for name in {payload.get('new_name'), payload.get('name'), payload.get('survivor_name')} - {None}:
            await project_artist_tracks(conn, name)


async def rebuild(conn) -> Dict[str, Any]:
    """Recreate the projection from silver in one transaction and move the consumer to the outbox head."""
    async with conn.transaction():
        await conn.execute('TRUNCATE projection_tracks')
        rows = await conn.fetch(f'SELECT {SOURCE_COLUMNS} FROM silver_enriched_tracks')
        for row in rows:
            values = project_row(row)
            await conn.execute(UPSERT, *[values[c] for c in COLUMNS])
        from . import outbox
        await outbox.skip_to_head(conn, CONSUMER)
    return {'rebuilt': len(rows), 'contract_version': energy.CONTRACT_VERSION}


async def reconcile(conn, repair: bool = False) -> Dict[str, Any]:
    """Compare silver with the projection: missing, extra, stale or built under another contract version."""
    missing = [r['id'] for r in await conn.fetch("""
        SELECT t.id FROM silver_enriched_tracks t LEFT JOIN projection_tracks p ON p.track_id = t.id
        WHERE p.track_id IS NULL""")]
    extra = [r['track_id'] for r in await conn.fetch("""
        SELECT p.track_id FROM projection_tracks p LEFT JOIN silver_enriched_tracks t ON t.id = p.track_id
        WHERE t.id IS NULL""")]
    stale = [r['id'] for r in await conn.fetch("""
        SELECT t.id FROM silver_enriched_tracks t JOIN projection_tracks p ON p.track_id = t.id
        WHERE p.source_updated_at IS DISTINCT FROM t.updated_at
           OR (p.energy_canonical IS NOT NULL AND p.energy_contract_version IS DISTINCT FROM $1)""", energy.CONTRACT_VERSION)]
    report = {'missing': len(missing), 'extra': len(extra), 'stale': len(stale),
              'source_total': await conn.fetchval('SELECT count(*) FROM silver_enriched_tracks'),
              'projection_total': await conn.fetchval('SELECT count(*) FROM projection_tracks')}
    if repair:
        for track_id in [*missing, *stale, *extra]:
            await project_track(conn, track_id)
        report['repaired'] = len(missing) + len(extra) + len(stale)
    return report
