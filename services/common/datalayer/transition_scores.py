"""Stored harmonic scoring on Silver transitions (HS4; spec `harmonic-1` section 2.7, migration 270).

`score_transition` (common.metadata.transition_scoring) is the only classifier. This module reads the two tracks'
key, BPM and energy, turns its result into column values, and writes them: at ingest time (`ingest.py`) and through
`backfill`, an idempotent keyset walk over existing rows that only writes a row whose stored scoring differs from
what its tracks give now. Unknown inputs stay unknown: scores, gaps, deltas and energy values are NULL and the level
or move reads 'unknown'. Cost is query-time only and never stored.
"""
from typing import Any, Dict, Iterable, Optional, Tuple
from uuid import UUID

from common.metadata.transition_scoring import score_transition

# Stored columns and their SQL types, in parameter order (scored_at is set to NOW() on every write).
COLUMNS: Tuple[Tuple[str, str], ...] = (
    ('key_relation', 'text'), ('key_level', 'text'), ('key_score', 'float8'),
    ('bpm_relation', 'text'), ('bpm_gap', 'int4'), ('bpm_level', 'text'), ('bpm_score', 'float8'),
    ('compat_score', 'float8'), ('compat_coverage', 'float8'),
    ('energy_from', 'numeric'), ('energy_to', 'numeric'), ('energy_delta', 'numeric'), ('energy_move', 'text'),
    ('energy_contract', 'text'), ('move_version', 'text'),
    ('energy_from_source', 'text'), ('energy_to_source', 'text'),
    ('energy_from_calibrated', 'bool'), ('energy_to_calibrated', 'bool'),
    ('scoring_version', 'text'),
)
NAMES = [name for name, _ in COLUMNS]

TRACKS_SQL = ('SELECT id, key, camelot_key, bpm, energy_canonical, energy_source, energy_calibrated '
              'FROM silver_enriched_tracks WHERE id = ANY($1::uuid[])')


def placeholders(start: int) -> str:
    """`$start::type, ...` for every stored column, so asyncpg binds each value with the column's type."""
    return ', '.join(f'${start + i}::{kind}' for i, (_, kind) in enumerate(COLUMNS))


UPDATE_SQL = (f'UPDATE silver_track_transitions SET ({", ".join(NAMES)}, scored_at) = ({placeholders(2)}, NOW()) '
              f'WHERE id = $1 AND (scored_at IS NULL OR ({", ".join(NAMES)}) IS DISTINCT FROM ({placeholders(2)}))')


def track_input(row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Classifier input for one track; a missing track gives an all-unknown input. The repaired Camelot code wins."""
    row = row or {}
    return {'key': row.get('camelot_key') or row.get('key'), 'bpm': row.get('bpm'), 'energy': row.get('energy_canonical')}


def edge_values(from_row: Optional[Dict[str, Any]], to_row: Optional[Dict[str, Any]]) -> Tuple[Any, ...]:
    """Column values (COLUMNS order) for the directed edge from -> to."""
    scored = score_transition(track_input(from_row), track_input(to_row))
    for side, row in (('from', from_row or {}), ('to', to_row or {})):
        known = scored[f'energy_{side}'] is not None   # provenance only for an energy that was used
        scored[f'energy_{side}_source'] = row.get('energy_source') if known else None
        scored[f'energy_{side}_calibrated'] = row.get('energy_calibrated') if known else None
    return tuple(scored[name] for name in NAMES)


async def load_tracks(conn, track_ids: Iterable[UUID]) -> Dict[UUID, Dict[str, Any]]:
    ids = list({t for t in track_ids if t is not None})
    if not ids:
        return {}
    return {row['id']: dict(row) for row in await conn.fetch(TRACKS_SQL, ids)}


async def backfill(conn, limit: int = 500, after: Optional[UUID] = None) -> Dict[str, Any]:
    """Score up to `limit` transitions after `after` (by id). Safe to re-run: unchanged rows are not written."""
    rows = await conn.fetch("""
        SELECT id, from_track_id, to_track_id FROM silver_track_transitions
        WHERE ($2::uuid IS NULL OR id > $2) ORDER BY id LIMIT $1""", limit, after)
    tracks = await load_tracks(conn, [t for r in rows for t in (r['from_track_id'], r['to_track_id'])])
    counts: Dict[str, Any] = {'examined': len(rows), 'scored': 0, 'unchanged': 0,
                              'last_id': str(rows[-1]['id']) if rows else None}
    for row in rows:
        values = edge_values(tracks.get(row['from_track_id']), tracks.get(row['to_track_id']))
        status = await conn.execute(UPDATE_SQL, row['id'], *values)
        counts['scored' if str(status).endswith(' 1') else 'unchanged'] += 1
    return counts
