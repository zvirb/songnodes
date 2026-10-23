"""Source evidence, consensus application and Camelot repair (WP3/WP4 non-audio, WP5 data side).

Every provider or manual measurement is stored in `silver_track_metadata_evidence`; track columns are
then derived from evidence (consensus for BPM/key, configured priority for the other fields). Existing
values are only replaced by evidence that is at least as strong, and unresolved disagreements set
`metadata_review` with explicit reasons that `v_metadata_conflicts` exposes.
"""
import json
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence
from uuid import UUID

from common.metadata import camelot, consensus, energy, field_resolution as fr

from . import outbox
from .errors import CatalogError

RESOLVED_FIELDS = {  # evidence field -> silver column
    'isrc': 'isrc', 'duration_ms': 'duration_ms', 'mix_name': 'mix_name', 'genre': 'genre',
    'record_label': 'record_label', 'tidal_id': 'tidal_id', 'deezer_id': 'deezer_id', 'musicbrainz_id': 'musicbrainz_id',
}
IDENTIFIER_FIELDS = {'tidal_id', 'deezer_id', 'musicbrainz_id'}
REVIEW_PREFIXES = ('bpm_', 'key_', 'isrc_', 'genre_', 'record_label_', 'duration_', 'mix_name_', 'match_')


async def record(conn, track_id: UUID, field: str, value: Any, source: str, *, method: str = 'provider',
                 method_version: str = '', independent_group: Optional[str] = None, confidence: Optional[float] = None,
                 raw: Optional[Dict[str, Any]] = None, contract_version: Optional[str] = None,
                 measured_at: Optional[datetime] = None) -> bool:
    """Store one measurement. Re-recording the same value from the same source only refreshes retrieved_at."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return False
    inserted = await conn.fetchval("""
        INSERT INTO silver_track_metadata_evidence
            (track_id, field, value, raw, source, method, method_version, independent_group, confidence,
             contract_version, measured_at)
        VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (track_id, field, source, method, method_version, value)
        DO UPDATE SET retrieved_at = NOW(), raw = COALESCE(EXCLUDED.raw, silver_track_metadata_evidence.raw)
        RETURNING (xmax = 0)
    """, track_id, field, json.dumps(value, default=str), json.dumps(raw, default=str) if raw is not None else None,
                                  source, method, method_version, independent_group or source, confidence,
                                  contract_version, measured_at)
    return bool(inserted)


async def load(conn, track_id: UUID, field: str) -> List[Any]:
    return await conn.fetch('SELECT * FROM silver_track_metadata_evidence WHERE track_id = $1 AND field = $2 ORDER BY id',
                            track_id, field)


def decoded(value):
    return json.loads(value) if isinstance(value, str) else value


async def _set_reasons(conn, track_id: UUID, prefixes: Sequence[str], reasons: Iterable[str]) -> None:
    """Replace the review reasons that belong to `prefixes`, keep all others, and derive the review flag."""
    await conn.execute("""
        UPDATE silver_enriched_tracks SET
            metadata_review_reasons = ARRAY(
                SELECT DISTINCT r FROM unnest(
                    ARRAY(SELECT x FROM unnest(metadata_review_reasons) x
                          WHERE NOT EXISTS (SELECT 1 FROM unnest($2::text[]) p WHERE x LIKE p || '%')) || $3::text[]) r),
            updated_at = NOW()
        WHERE id = $1""", track_id, list(prefixes), list(reasons))
    await conn.execute('UPDATE silver_enriched_tracks SET metadata_review = cardinality(metadata_review_reasons) > 0 WHERE id = $1',
                       track_id)


async def apply_consensus(conn, track_id: UUID, trust: Sequence[str] = consensus.DEFAULT_TRUST) -> Dict[str, Any]:
    """Derive bpm, key and camelot_key from stored evidence. Returns the consensus outcome per field."""
    track = await conn.fetchrow('SELECT id, genre FROM silver_enriched_tracks WHERE id = $1 FOR UPDATE', track_id)
    if track is None:
        raise CatalogError(404, 'Track not found')
    genres = list(track['genre'] or [])
    outcome: Dict[str, Any] = {}
    reasons: List[str] = []

    def items(rows, field):
        return [consensus.Evidence(field, decoded(r['value']), r['source'], r['method'], r['method_version'] or None,
                                   r['independent_group'], float(r['confidence']) if r['confidence'] is not None else None)
                for r in rows]

    bpm = consensus.bpm_consensus(items(await load(conn, track_id, 'bpm'), 'bpm'), genres, trust)
    key = consensus.key_consensus(items(await load(conn, track_id, 'key'), 'key'), trust)
    for name, result in (('bpm', bpm), ('key', key)):
        outcome[name] = {'status': result.status, 'value': result.value, 'review': result.review,
                         'supporting_groups': list(result.supporting_groups), 'near_groups': list(result.near_groups)}
        if result.status == 'manual':
            continue  # a person decided; provider disagreement stays in the evidence but needs no review
        if result.status == 'unresolved':
            reasons.append(f'{name}_unresolved')
        if result.conflicting:
            reasons.append(f'{name}_conflict')
        if result.near_groups:
            reasons.append(f'{name}_near')
    if bpm.value is not None:
        await conn.execute('UPDATE silver_enriched_tracks SET bpm = $2, updated_at = NOW() WHERE id = $1', track_id, round(float(bpm.value), 2))
    if key.chosen is not None:
        await conn.execute("""UPDATE silver_enriched_tracks SET key = $2, camelot_key = $3, updated_at = NOW() WHERE id = $1""",
                           track_id, str(key.chosen.value), key.value)
    await _set_reasons(conn, track_id, ('bpm_', 'key_'), reasons)
    await outbox.append(conn, 'track', track_id, 'updated', {'fields': ['bpm', 'key', 'camelot_key'], 'by': 'consensus'})
    return outcome


async def existing_source(conn, track_id: UUID, field: str, current: Any, priority: Sequence[str]) -> Optional[str]:
    """Best-ranked source whose evidence equals the current column value; None means a legacy value."""
    if current is None:
        return None
    rows = await load(conn, track_id, field)
    matching = [r['source'] for r in rows if fr.comparable(decoded(r['value'])) == fr.comparable(
        list(current) if isinstance(current, (list, tuple)) else current)]
    return min(matching, key=lambda s: fr.rank(s, priority)) if matching else None


async def apply_field(conn, track_id: UUID, field: str, priorities=None) -> fr.Resolution:
    """Resolve one non-consensus field from evidence and write it only if it beats the existing value."""
    column = RESOLVED_FIELDS[field]
    priority = (priorities or fr.DEFAULT_PRIORITIES).get(field, ('tidal', 'deezer', 'musicbrainz'))
    current = await conn.fetchval(f'SELECT {column} FROM silver_enriched_tracks WHERE id = $1 FOR UPDATE', track_id)
    rows = await load(conn, track_id, field)
    candidates = [fr.Candidate(r['source'], decoded(r['value']), float(r['confidence']) if r['confidence'] is not None else None)
                  for r in rows]
    if field in IDENTIFIER_FIELDS:
        # Provider ids are only recorded for confirmed matches; disagreement between sources is a review item.
        known = [c for c in candidates if fr.is_known(c.value)]
        if not known:
            resolution = fr.Resolution(field, 'none')
        else:
            best = max(known, key=lambda c: c.confidence or 0.0)
            distinct = {str(c.value) for c in known}
            resolution = fr.Resolution(field, 'keep_existing' if str(current) == str(best.value) else 'set',
                                       best.value, best.source, tuple(c for c in known if c is not best),
                                       review=len(distinct) > 1, reason='highest-confidence confirmed match')
    else:
        resolution = fr.resolve_field(field, candidates,
                                      fr.Existing(current, await existing_source(conn, track_id, field, current, priority)),
                                      priorities)
    if resolution.action == 'set':
        await conn.execute(f'UPDATE silver_enriched_tracks SET {column} = $2, updated_at = NOW() WHERE id = $1',
                           track_id, resolution.value)
    await _set_reasons(conn, track_id, (f'{field}_',), [f'{field}_conflict'] if resolution.review else [])
    return resolution


async def apply_all(conn, track_id: UUID) -> Dict[str, Any]:
    async with conn.transaction():
        result: Dict[str, Any] = {'consensus': await apply_consensus(conn, track_id)}
        for field in RESOLVED_FIELDS:
            if await load(conn, track_id, field):
                resolution = await apply_field(conn, track_id, field)
                result[field] = {'action': resolution.action, 'source': resolution.source, 'review': resolution.review}
        await outbox.append(conn, 'track', track_id, 'updated', {'by': 'evidence'})
    return result


async def apply_energy(conn, track_id: UUID, readings: Sequence[energy.EnergyReading]) -> Dict[str, Any]:
    """Store canonical energy from reconciled readings. Unknown stays NULL; each reading is kept as evidence."""
    async with conn.transaction():
        for r in readings:
            if r.value is not None:
                await record(conn, track_id, 'energy', {'value': str(r.value), 'raw_value': str(r.raw_value), 'raw_scale': r.raw_scale},
                             r.source, method=r.method, method_version=r.method_version or '', confidence=r.confidence,
                             contract_version=r.contract_version, measured_at=r.measured_at)
        decision = energy.reconcile(readings)
        chosen = decision.chosen
        await conn.execute("""
            UPDATE silver_enriched_tracks SET energy_canonical = $2, energy_source = $3, energy_calibrated = $4,
                energy_contract_version = $5, updated_at = NOW() WHERE id = $1""", track_id,
                           chosen.value if chosen else None, chosen.source if chosen else None,
                           chosen.calibrated if chosen else None, chosen.contract_version if chosen else None)
        await _set_reasons(conn, track_id, ('energy_',), ['energy_conflict'] if decision.conflicts else [])
        await outbox.append(conn, 'track', track_id, 'updated', {'fields': ['energy']})
    return {'value': str(chosen.value) if chosen else None, 'band': decision.band, 'conflicts': len(decision.conflicts)}


async def repair_camelot(conn, limit: int = 500, after: Optional[UUID] = None) -> Dict[str, Any]:
    """Recompute stored Camelot values from the original key; log originals so the change is reversible.

    Statuses: unchanged, derived (nothing stored before), corrected (stored value was wrong), unrecoverable
    (a stored code without a usable original key: kept as-is and flagged `camelot_unverified`).
    """
    rows = await conn.fetch("""
        SELECT t.id, t.key, t.camelot_key, t.enrichment_metadata->>'camelot_key' AS legacy_camelot
        FROM silver_enriched_tracks t LEFT JOIN silver_camelot_corrections c ON c.track_id = t.id
        WHERE c.track_id IS NULL AND ($2::uuid IS NULL OR t.id > $2)
          AND (t.key IS NOT NULL OR t.camelot_key IS NOT NULL OR t.enrichment_metadata ? 'camelot_key')
        ORDER BY t.id LIMIT $1""", limit, after)
    counts = {'unchanged': 0, 'derived': 0, 'corrected': 0, 'unrecoverable': 0}
    for row in rows:
        stored = row['camelot_key'] or row['legacy_camelot']
        code, status = camelot.recompute(row['key'], stored)
        async with conn.transaction():
            await conn.execute("""
                INSERT INTO silver_camelot_corrections (track_id, original_camelot, original_key, recomputed_camelot, status)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING""", row['id'], stored, row['key'], code, status)
            if status in ('derived', 'corrected', 'unchanged'):
                await conn.execute('UPDATE silver_enriched_tracks SET camelot_key = $2, updated_at = NOW() WHERE id = $1', row['id'], code)
            elif status == 'unrecoverable':
                await conn.execute('UPDATE silver_enriched_tracks SET camelot_key = COALESCE(camelot_key, $2), updated_at = NOW() WHERE id = $1',
                                   row['id'], camelot.to_camelot(stored))
                await _set_reasons(conn, row['id'], ('camelot_',), ['camelot_unverified'])
            if status in ('derived', 'corrected'):
                await outbox.append(conn, 'track', row['id'], 'updated', {'fields': ['camelot_key'], 'by': 'camelot_repair'})
        counts[status] += 1
    return {'examined': len(rows), 'last_id': str(rows[-1]['id']) if rows else None, **counts}


async def revert_camelot(conn, track_id: UUID) -> bool:
    """Restore the original stored Camelot value for one track."""
    async with conn.transaction():
        row = await conn.fetchrow('SELECT * FROM silver_camelot_corrections WHERE track_id = $1 AND reverted_at IS NULL FOR UPDATE', track_id)
        if row is None:
            return False
        await conn.execute('UPDATE silver_enriched_tracks SET camelot_key = $2, updated_at = NOW() WHERE id = $1',
                           track_id, row['original_camelot'])
        await conn.execute('UPDATE silver_camelot_corrections SET reverted_at = NOW() WHERE track_id = $1', track_id)
        await outbox.append(conn, 'track', track_id, 'updated', {'fields': ['camelot_key'], 'by': 'camelot_revert'})
    return True
