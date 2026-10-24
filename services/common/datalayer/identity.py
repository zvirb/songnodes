"""Stable identities across merges (Milestone 3).

A merge never loses information: the duplicate row, its set memberships, its transition edges, its
evidence and the survivor's pre-merge state are snapshotted in `entity_merge_history`, a redirect keeps
the old id resolvable, and `unmerge_tracks` restores everything unless later activity touched the merged
edges. Ordered set membership (`silver_playlist_tracks`) is re-pointed, never dropped.
"""
import json
from typing import Any, Dict, List, Optional
from uuid import UUID

from . import outbox
from .errors import CatalogError

# Columns the survivor may inherit from the duplicate when it has no value of its own.
FILLABLE = ('spotify_id', 'isrc', 'release_date', 'duration_ms', 'bpm', 'key', 'genre', 'energy', 'valence',
            'danceability', 'camelot_key', 'record_label', 'mix_name', 'tidal_id', 'deezer_id', 'apple_music_id',
            'beatport_id', 'musicbrainz_id', 'energy_canonical', 'energy_source', 'energy_calibrated',
            'energy_contract_version')
MAX_REDIRECT_DEPTH = 25


def row_json(row) -> Dict[str, Any]:
    value = row['j']
    return json.loads(value) if isinstance(value, str) else value


async def resolve_id(conn, entity_type: str, entity_id: UUID) -> UUID:
    """Follow merge redirects to the surviving id (the id itself when never merged)."""
    current = entity_id
    for _ in range(MAX_REDIRECT_DEPTH):
        target = await conn.fetchval(
            'SELECT new_id FROM entity_redirects WHERE entity_type = $1 AND old_id = $2', entity_type, current)
        if target is None:
            return current
        current = target
    raise CatalogError(500, 'Redirect chain too deep')


async def merge_tracks(conn, survivor_id: UUID, duplicate_id: UUID, reason: Optional[str] = None) -> int:
    """Merge `duplicate_id` into `survivor_id`; returns the history id."""
    if survivor_id == duplicate_id:
        raise CatalogError(400, 'Cannot merge a track with itself')
    async with conn.transaction():
        rows = await conn.fetch('SELECT id FROM silver_enriched_tracks WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE',
                                [survivor_id, duplicate_id])
        if {r['id'] for r in rows} != {survivor_id, duplicate_id}:
            raise CatalogError(404, 'Track not found')
        duplicate = row_json(await conn.fetchrow('SELECT to_jsonb(t) AS j FROM silver_enriched_tracks t WHERE id = $1', duplicate_id))
        survivor = await conn.fetchrow('SELECT to_jsonb(t) AS j FROM silver_enriched_tracks t WHERE id = $1', survivor_id)
        survivor = row_json(survivor)

        # 1. Survivor inherits values it lacks; remember what it held before.
        filled = {c: survivor.get(c) for c in FILLABLE if survivor.get(c) is None and duplicate.get(c) is not None}
        if filled:
            assignments = ', '.join(f'{c} = d.{c}' for c in filled)
            await conn.execute(f"""
                UPDATE silver_enriched_tracks s SET {assignments}, updated_at = NOW()
                FROM silver_enriched_tracks d WHERE s.id = $1 AND d.id = $2""", survivor_id, duplicate_id)
        await conn.execute("""
            UPDATE silver_enriched_tracks s SET
                additional_bronze_ids = ARRAY(SELECT DISTINCT b FROM unnest(
                    COALESCE(s.additional_bronze_ids, '{}') || COALESCE(d.additional_bronze_ids, '{}')
                    || CASE WHEN d.bronze_id IS NULL THEN '{}'::uuid[] ELSE ARRAY[d.bronze_id] END) b
                    WHERE b IS DISTINCT FROM s.bronze_id),
                updated_at = NOW()
            FROM silver_enriched_tracks d WHERE s.id = $1 AND d.id = $2""", survivor_id, duplicate_id)

        # 2. Ordered set membership moves to the survivor.
        member_rows = [json.loads(r['j']) if isinstance(r['j'], str) else r['j'] for r in await conn.fetch(
            'SELECT to_jsonb(m) AS j FROM silver_playlist_tracks m WHERE track_id = $1', duplicate_id)]
        inserted_members = [dict(r) for r in await conn.fetch("""
            INSERT INTO silver_playlist_tracks (playlist_id, track_id, position, cue_time_ms)
            SELECT playlist_id, $1, position, cue_time_ms FROM silver_playlist_tracks WHERE track_id = $2
            ON CONFLICT DO NOTHING RETURNING playlist_id, position""", survivor_id, duplicate_id)]
        await conn.execute('DELETE FROM silver_playlist_tracks WHERE track_id = $1', duplicate_id)

        # 3. Evidence follows the survivor.
        evidence_rows = [json.loads(r['j']) if isinstance(r['j'], str) else r['j'] for r in await conn.fetch(
            'SELECT to_jsonb(e) AS j FROM silver_track_metadata_evidence e WHERE track_id = $1', duplicate_id)]
        moved_evidence = [r['id'] for r in await conn.fetch("""
            INSERT INTO silver_track_metadata_evidence
                (track_id, field, value, raw, source, method, method_version, independent_group, confidence,
                 contract_version, measured_at, retrieved_at)
            SELECT $1, field, value, raw, source, method, method_version, independent_group, confidence,
                   contract_version, measured_at, retrieved_at
            FROM silver_track_metadata_evidence WHERE track_id = $2
            ON CONFLICT DO NOTHING RETURNING id""", survivor_id, duplicate_id)]

        # 4. Transition edges: re-point, sum counts, drop self-loops.
        duplicate_edges = [json.loads(r['j']) if isinstance(r['j'], str) else r['j'] for r in await conn.fetch(
            'SELECT to_jsonb(x) AS j FROM silver_track_transitions x WHERE from_track_id = $1 OR to_track_id = $1', duplicate_id)]
        edges_before: Dict[str, Optional[dict]] = {}
        for edge in duplicate_edges:
            source = survivor_id if UUID(edge['from_track_id']) == duplicate_id else UUID(edge['from_track_id'])
            target = survivor_id if UUID(edge['to_track_id']) == duplicate_id else UUID(edge['to_track_id'])
            if source == target:
                continue
            existing = await conn.fetchrow('SELECT to_jsonb(x) AS j FROM silver_track_transitions x '
                                           'WHERE from_track_id = $1 AND to_track_id = $2', source, target)
            edges_before[f'{source}>{target}'] = row_json(existing) if existing else None
            await conn.execute("""
                INSERT INTO silver_track_transitions
                    (from_track_id, to_track_id, occurrence_count, first_seen, last_seen, playlist_occurrences,
                     avg_bpm_difference, avg_key_compatibility, avg_energy_difference, transition_quality_score)
                VALUES ($1, $2, $3, $4::timestamp, $5::timestamp, $6::jsonb, $7, $8, $9, $10)
                ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
                    occurrence_count = silver_track_transitions.occurrence_count + EXCLUDED.occurrence_count,
                    first_seen = LEAST(silver_track_transitions.first_seen, EXCLUDED.first_seen),
                    last_seen = GREATEST(silver_track_transitions.last_seen, EXCLUDED.last_seen),
                    playlist_occurrences = silver_track_transitions.playlist_occurrences || EXCLUDED.playlist_occurrences,
                    avg_bpm_difference = COALESCE(silver_track_transitions.avg_bpm_difference, EXCLUDED.avg_bpm_difference),
                    avg_key_compatibility = COALESCE(silver_track_transitions.avg_key_compatibility, EXCLUDED.avg_key_compatibility),
                    avg_energy_difference = COALESCE(silver_track_transitions.avg_energy_difference, EXCLUDED.avg_energy_difference),
                    transition_quality_score = COALESCE(silver_track_transitions.transition_quality_score, EXCLUDED.transition_quality_score),
                    updated_at = NOW()
            """, source, target, edge['occurrence_count'], _ts(edge['first_seen']), _ts(edge['last_seen']),
                json.dumps(edge['playlist_occurrences']), edge['avg_bpm_difference'], edge['avg_key_compatibility'],
                edge['avg_energy_difference'], edge['transition_quality_score'])

        # 5. Redirects: the duplicate resolves to the survivor; anything that pointed at it is flattened.
        flattened = [str(r['old_id']) for r in await conn.fetch(
            "SELECT old_id FROM entity_redirects WHERE entity_type = 'track' AND new_id = $1", duplicate_id)]
        snapshot = {'duplicate': duplicate, 'survivor_filled': {c: None for c in filled},
                    'survivor_additional_bronze_ids_before': survivor.get('additional_bronze_ids'),
                    'duplicate_members': member_rows, 'inserted_members': [
                        {'playlist_id': str(m['playlist_id']), 'position': m['position']} for m in inserted_members],
                    'duplicate_evidence': evidence_rows, 'moved_evidence_ids': moved_evidence,
                    'duplicate_edges': duplicate_edges, 'survivor_edges_before': edges_before, 'flattened': flattened}
        history = await conn.fetchval("""
            INSERT INTO entity_merge_history (entity_type, survivor_id, duplicate_id, snapshot, reason)
            VALUES ('track', $1, $2, $3::jsonb, $4) RETURNING id""", survivor_id, duplicate_id,
                                      json.dumps(snapshot, default=str), reason)
        await conn.execute("UPDATE entity_redirects SET new_id = $1 WHERE entity_type = 'track' AND new_id = $2",
                           survivor_id, duplicate_id)
        await conn.execute("INSERT INTO entity_redirects (entity_type, old_id, new_id, history_id) "
                           "VALUES ('track', $1, $2, $3)", duplicate_id, survivor_id, history)

        # 6. Delete the duplicate (cascades remaining edges/evidence) and announce the merge.
        await conn.execute('DELETE FROM silver_enriched_tracks WHERE id = $1', duplicate_id)
        await outbox.append(conn, 'track', duplicate_id, 'merged', {'survivor_id': str(survivor_id)})
        await outbox.append(conn, 'track', survivor_id, 'updated', {'merged_from': str(duplicate_id)})
    return history


def _ts(value):
    from datetime import datetime
    return datetime.fromisoformat(value) if isinstance(value, str) else value


async def unmerge_tracks(conn, history_id: int) -> Dict[str, Any]:
    """Restore a merged duplicate. Refuses when later activity changed the merged edges."""
    async with conn.transaction():
        history = await conn.fetchrow("SELECT * FROM entity_merge_history WHERE id = $1 AND entity_type = 'track' FOR UPDATE",
                                      history_id)
        if history is None:
            raise CatalogError(404, 'Merge not found')
        if history['reverted_at'] is not None:
            raise CatalogError(409, 'Merge was already reverted')
        survivor_id, duplicate_id = history['survivor_id'], history['duplicate_id']
        snapshot = json.loads(history['snapshot']) if isinstance(history['snapshot'], str) else history['snapshot']
        if await conn.fetchval('SELECT NOT EXISTS(SELECT 1 FROM silver_enriched_tracks WHERE id = $1)', survivor_id):
            raise CatalogError(409, 'Survivor no longer exists')
        await conn.fetchval('SELECT id FROM silver_enriched_tracks WHERE id = $1 FOR UPDATE', survivor_id)

        for key in snapshot['survivor_edges_before']:
            left, right = key.split('>')
            changed = await conn.fetchval("""
                SELECT updated_at > (SELECT merged_at::timestamp FROM entity_merge_history WHERE id = $3)
                FROM silver_track_transitions WHERE from_track_id = $1 AND to_track_id = $2""",
                                          UUID(left), UUID(right), history_id)
            if changed:
                raise CatalogError(409, 'Transitions changed after the merge; unmerge refused')

        await conn.execute('INSERT INTO silver_enriched_tracks SELECT * FROM jsonb_populate_record(NULL::silver_enriched_tracks, $1::jsonb)',
                           json.dumps(snapshot['duplicate']))
        for column in snapshot['survivor_filled']:
            if column not in FILLABLE:
                raise CatalogError(500, f'Unexpected column in snapshot: {column}')
        if snapshot['survivor_filled']:
            assignments = ', '.join(f'{c} = NULL' for c in snapshot['survivor_filled'])
            await conn.execute(f'UPDATE silver_enriched_tracks SET {assignments}, updated_at = NOW() WHERE id = $1', survivor_id)
        before_ids = snapshot['survivor_additional_bronze_ids_before']
        await conn.execute("""
            UPDATE silver_enriched_tracks SET updated_at = NOW(), additional_bronze_ids =
                CASE WHEN $2::jsonb IS NULL OR $2::jsonb = 'null'::jsonb THEN NULL
                     ELSE ARRAY(SELECT jsonb_array_elements_text($2::jsonb)::uuid) END
            WHERE id = $1""", survivor_id, json.dumps(before_ids))

        for key, before in snapshot['survivor_edges_before'].items():
            left, right = key.split('>')
            await conn.execute('DELETE FROM silver_track_transitions WHERE from_track_id = $1 AND to_track_id = $2',
                               UUID(left), UUID(right))
            if before is not None:
                await conn.execute('INSERT INTO silver_track_transitions SELECT * FROM jsonb_populate_record(NULL::silver_track_transitions, $1::jsonb)',
                                   json.dumps(before))
        for edge in snapshot['duplicate_edges']:
            await conn.execute("""
                INSERT INTO silver_track_transitions
                SELECT r.* FROM jsonb_populate_record(NULL::silver_track_transitions, $1::jsonb) r
                WHERE EXISTS (SELECT 1 FROM silver_enriched_tracks WHERE id = r.from_track_id)
                  AND EXISTS (SELECT 1 FROM silver_enriched_tracks WHERE id = r.to_track_id)
                ON CONFLICT DO NOTHING""", json.dumps(edge))

        for member in snapshot['inserted_members']:
            await conn.execute('DELETE FROM silver_playlist_tracks WHERE playlist_id = $1 AND track_id = $2 AND position = $3',
                               UUID(member['playlist_id']), survivor_id, member['position'])
        for member in snapshot['duplicate_members']:
            await conn.execute("""
                INSERT INTO silver_playlist_tracks
                SELECT r.* FROM jsonb_populate_record(NULL::silver_playlist_tracks, $1::jsonb) r
                WHERE EXISTS (SELECT 1 FROM silver_enriched_playlists WHERE id = r.playlist_id) ON CONFLICT DO NOTHING""",
                               json.dumps(member))

        if snapshot['moved_evidence_ids']:
            await conn.execute('DELETE FROM silver_track_metadata_evidence WHERE id = ANY($1::bigint[])', snapshot['moved_evidence_ids'])
        for evidence in snapshot['duplicate_evidence']:
            await conn.execute('INSERT INTO silver_track_metadata_evidence SELECT * FROM jsonb_populate_record(NULL::silver_track_metadata_evidence, $1::jsonb) ON CONFLICT DO NOTHING',
                               json.dumps(evidence))

        await conn.execute("DELETE FROM entity_redirects WHERE entity_type = 'track' AND old_id = $1", duplicate_id)
        for old in snapshot['flattened']:
            await conn.execute("UPDATE entity_redirects SET new_id = $1 WHERE entity_type = 'track' AND old_id = $2",
                               duplicate_id, UUID(old))
        await conn.execute('UPDATE entity_merge_history SET reverted_at = NOW() WHERE id = $1', history_id)
        await outbox.append(conn, 'track', duplicate_id, 'updated', {'unmerged_from': str(survivor_id)})
        await outbox.append(conn, 'track', survivor_id, 'updated', {'unmerged': str(duplicate_id)})
    return {'survivor_id': str(survivor_id), 'duplicate_id': str(duplicate_id)}


async def history_for(conn, entity_type: str, entity_id: UUID) -> List[Any]:
    return await conn.fetch("""
        SELECT id, survivor_id, duplicate_id, reason, merged_at, reverted_at FROM entity_merge_history
        WHERE entity_type = $1 AND (survivor_id = $2 OR duplicate_id = $2) ORDER BY id""", entity_type, entity_id)


async def unmerge_artists(conn, history_id: int) -> Dict[str, Any]:
    """Reverse an artist merge: recreate the duplicate and re-point the tracks and sets that moved.

    The survivor's aliases, lineage ids and dedup fields return to their pre-merge values (aliases added
    to the survivor after the merge are not preserved). Refused if the duplicate's name is now taken.
    """
    async with conn.transaction():
        history = await conn.fetchrow("SELECT * FROM entity_merge_history WHERE id = $1 AND entity_type = 'artist' FOR UPDATE",
                                      history_id)
        if history is None:
            raise CatalogError(404, 'Merge not found')
        if history['reverted_at'] is not None:
            raise CatalogError(409, 'Merge was already reverted')
        snapshot = json.loads(history['snapshot']) if isinstance(history['snapshot'], str) else history['snapshot']
        survivor_id, duplicate_id = history['survivor_id'], history['duplicate_id']
        duplicate = snapshot['duplicate']
        if await conn.fetchval('SELECT NOT EXISTS(SELECT 1 FROM silver_enriched_artists WHERE id = $1)', survivor_id):
            raise CatalogError(409, 'Survivor no longer exists')
        if await conn.fetchval('SELECT EXISTS(SELECT 1 FROM silver_enriched_artists WHERE canonical_name = $1 OR normalized_name = $2)',
                               duplicate['canonical_name'], duplicate['normalized_name']):
            raise CatalogError(409, 'The duplicate artist name is now used by another artist')
        await conn.execute('INSERT INTO silver_enriched_artists SELECT * FROM jsonb_populate_record(NULL::silver_enriched_artists, $1::jsonb)',
                           json.dumps(duplicate))
        before = snapshot['target_before']
        await conn.execute("""
            UPDATE silver_enriched_artists SET
                aliases = CASE WHEN $2::jsonb = 'null'::jsonb THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text($2::jsonb)) END,
                bronze_ids = ARRAY(SELECT jsonb_array_elements_text($3::jsonb)::uuid),
                merged_artist_ids = CASE WHEN $4::jsonb = 'null'::jsonb THEN NULL
                                         ELSE ARRAY(SELECT jsonb_array_elements_text($4::jsonb)::uuid) END,
                deduplication_strategy = $5, updated_at = NOW()
            WHERE id = $1""", survivor_id, json.dumps(before['aliases']), json.dumps(before['bronze_ids']),
                           json.dumps(before['merged_artist_ids']), before['deduplication_strategy'])
        await conn.execute('UPDATE silver_enriched_tracks SET artist_name = $1, updated_at = NOW() WHERE id = ANY($2::uuid[]) AND artist_name = $3',
                           duplicate['canonical_name'], [UUID(i) for i in snapshot['moved_track_ids']], snapshot['target_name'])
        await conn.execute('UPDATE silver_enriched_playlists SET artist_id = $1, artist_name = $2, updated_at = NOW() WHERE id = ANY($3::uuid[]) AND artist_id = $4',
                           duplicate_id, duplicate['canonical_name'], [UUID(i) for i in snapshot['moved_set_ids']], survivor_id)
        await conn.execute("DELETE FROM entity_redirects WHERE entity_type = 'artist' AND old_id = $1", duplicate_id)
        for old in snapshot.get('flattened', []):
            await conn.execute("UPDATE entity_redirects SET new_id = $1 WHERE entity_type = 'artist' AND old_id = $2", duplicate_id, UUID(old))
        await conn.execute('UPDATE entity_merge_history SET reverted_at = NOW() WHERE id = $1', history_id)
        await outbox.append(conn, 'artist', duplicate_id, 'unmerged', {
            'name': duplicate['canonical_name'], 'survivor_name': snapshot['target_name'], 'survivor_id': str(survivor_id)})
    return {'survivor_id': str(survivor_id), 'duplicate_id': str(duplicate_id)}
