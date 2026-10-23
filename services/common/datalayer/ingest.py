"""Canonical bronze -> silver ingestion (replaces the ad-hoc ETL paths).

For one bronze playlist: validate completeness (positions 1..N with no gaps, declared size honoured),
resolve canonical artists, upsert silver tracks (exact artist+title, case-insensitive; fuzzy resolution is a
separate, reversible step), record the ordered set, and create directed N -> N+1 transitions only where both
positions hold a valid, different track. Everything is keyed so replays and retries cannot duplicate rows:

* a playlist is "ingested" once its silver row carries `enrichment_metadata.ingested_by = INGEST_MARKER`;
* an incomplete playlist is recorded as `validation_status = 'failed'` with the reason and creates nothing else;
* silver rows already written by the legacy scraper pipeline are adopted, and transitions are not created again
  if any edge already references the playlist;
* same-track upserts take an advisory lock, so concurrent workers cannot create the same track twice.
"""
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from common.metadata.matching import normalize_isrc
from common.metadata.names import clean_name, is_placeholder_artist, normalize
from common.metadata.tempo import known_bpm

from . import evidence, outbox
from .errors import CatalogError

INGEST_MARKER = 'datalayer-ingest-v1'
MAX_ENTRIES = 5000


def raw_object(value) -> Dict[str, Any]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return {}
    return value if isinstance(value, dict) else {}


def as_int(value) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return None
    return number


def raw_evidence(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Provider-supplied values worth keeping as evidence. Invalid or zero values are dropped, not guessed."""
    found: Dict[str, Any] = {}
    bpm = known_bpm(raw.get('bpm'))
    if bpm and 20 <= bpm <= 300:
        found['bpm'] = bpm
    key = raw.get('key') or raw.get('musical_key')
    if isinstance(key, str) and key.strip():
        found['key'] = key.strip()
    code = normalize_isrc(raw.get('isrc'))
    if code:
        found['isrc'] = code
    duration = as_int(raw.get('duration_ms'))
    if duration and duration > 0:
        found['duration_ms'] = duration
    genre = raw.get('genre') or raw.get('genres')
    genres = [genre] if isinstance(genre, str) else [g for g in genre if isinstance(g, str)] if isinstance(genre, list) else []
    genres = [g.strip() for g in genres if g.strip()]
    if genres:
        found['genre'] = genres
    label = raw.get('record_label') or raw.get('label')
    if isinstance(label, str) and label.strip():
        found['record_label'] = label.strip()
    mix = raw.get('mix_name') or raw.get('version')
    if isinstance(mix, str) and mix.strip():
        found['mix_name'] = mix.strip()
    return found


async def resolve_artist(conn, name: str, source: str = 'ingest') -> str:
    """Canonical artist name for `name` (matched by normalised name), creating it when new."""
    key = normalize(name)
    existing = await conn.fetchval(
        'SELECT canonical_name FROM silver_enriched_artists WHERE normalized_name = $1 ORDER BY created_at LIMIT 1', key)
    if existing:
        return existing
    return await conn.fetchval("""
        INSERT INTO silver_enriched_artists (bronze_ids, canonical_name, normalized_name, validation_status,
                                             enrichment_metadata, deduplication_strategy)
        VALUES ('{}', $1, $2, 'needs_review', $3::jsonb, 'manual')
        ON CONFLICT (canonical_name) DO UPDATE SET canonical_name = EXCLUDED.canonical_name
        RETURNING canonical_name
    """, name, key, json.dumps({'source': source}))


async def upsert_track(conn, artist: str, title: str, bronze_id: Optional[UUID], source: str,
                       raw: Optional[Dict[str, Any]] = None, by: str = 'ingest') -> Dict[str, Any]:
    """Find or create the silver track for (artist, title). Returns {'id', 'status': created|updated}."""
    canonical = await resolve_artist(conn, artist, by)
    await conn.execute("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", f'{normalize(canonical)}|{normalize(title)}')
    track = await conn.fetchval("""
        SELECT id FROM silver_enriched_tracks
        WHERE lower(artist_name) = lower($1) AND lower(track_title) = lower($2) ORDER BY created_at LIMIT 1
    """, canonical, title)
    if track:
        if bronze_id is not None:
            await conn.execute("""
                UPDATE silver_enriched_tracks SET updated_at = NOW(),
                    additional_bronze_ids = CASE WHEN bronze_id = $2 OR $2 = ANY(COALESCE(additional_bronze_ids, '{}'))
                                                 THEN additional_bronze_ids
                                                 ELSE COALESCE(additional_bronze_ids, '{}') || $2::uuid END
                WHERE id = $1""", track, bronze_id)
        status = 'updated'
    else:
        track = await conn.fetchval("""
            INSERT INTO silver_enriched_tracks (bronze_id, artist_name, track_title, validation_status, enrichment_metadata)
            VALUES ($1, $2, $3, 'needs_review', $4::jsonb) RETURNING id
        """, bronze_id, canonical, title, json.dumps({'source': by, 'bronze_source': source}))
        status = 'created'
    found = raw_evidence(raw or {})
    if found:
        for field, value in found.items():
            await evidence.record(conn, track, field, value, source, method='scraped', independent_group=source)
        await evidence.apply_all(conn, track)
    await outbox.append(conn, 'track', track, status, {'by': by, 'source': source})
    return {'id': track, 'status': status}


async def load_entries(conn, bronze_playlist_id: UUID, raw_playlist: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = await conn.fetch("""
        SELECT id, position, artist_name, track_title, raw_json, source FROM bronze_scraped_tracks
        WHERE playlist_id = $1 ORDER BY position NULLS LAST, id""", bronze_playlist_id)
    if rows:
        return [{'bronze_id': r['id'], 'position': r['position'], 'artist': r['artist_name'], 'title': r['track_title'],
                 'raw': raw_object(r['raw_json']), 'source': r['source']} for r in rows]
    items = raw_playlist.get('tracks')
    entries = []
    for index, item in enumerate(items if isinstance(items, list) else [], start=1):
        item = item if isinstance(item, dict) else {}
        entries.append({'bronze_id': None, 'position': as_int(item.get('position')) or index,
                        'artist': item.get('artist_name') or item.get('artist'),
                        'title': item.get('track_title') or item.get('track_name') or item.get('title'),
                        'raw': item, 'source': None})
    return entries


def completeness_errors(entries: List[Dict[str, Any]], declared: Optional[int]) -> Dict[str, Any]:
    positions = [e['position'] for e in entries]
    errors: Dict[str, Any] = {}
    if not entries:
        return {'reason': 'no_tracks'}
    if any(p is None for p in positions):
        errors['reason'] = 'missing_position'
    elif len(set(positions)) != len(positions):
        errors['reason'] = 'duplicate_position'
    else:
        expected = set(range(1, max(positions) + 1))
        missing = sorted(expected - set(positions))
        if min(positions) != 1 or missing:
            errors.update({'reason': 'position_gap', 'missing': missing[:50] or [1]})
    if not errors and declared is not None and declared > len(entries):
        errors.update({'reason': 'declared_count_exceeds_loaded', 'declared': declared, 'loaded': len(entries)})
    if len(entries) > MAX_ENTRIES:
        errors = {'reason': 'too_many_tracks', 'loaded': len(entries)}
    return errors


async def ingest_playlist(conn, bronze_playlist_id: UUID) -> Dict[str, Any]:
    """Ingest one bronze playlist. Safe to call repeatedly; returns what happened."""
    async with conn.transaction():
        bronze = await conn.fetchrow('SELECT * FROM bronze_scraped_playlists WHERE id = $1 FOR UPDATE', bronze_playlist_id)
        if bronze is None:
            raise CatalogError(404, 'Bronze playlist not found')
        existing = await conn.fetchrow('SELECT id, enrichment_metadata FROM silver_enriched_playlists WHERE bronze_id = $1 FOR UPDATE',
                                       bronze_playlist_id)
        if existing and raw_object(existing['enrichment_metadata']).get('ingested_by') == INGEST_MARKER:
            return {'status': 'already_ingested', 'silver_playlist_id': str(existing['id']), 'entries': [], 'transitions': 0,
                    'created': 0, 'updated': 0, 'failed': 0}
        raw = raw_object(bronze['raw_json'])
        source = bronze['source']
        entries = await load_entries(conn, bronze_playlist_id, raw)
        declared = as_int(raw.get('total_tracks') or raw.get('track_count'))
        errors = completeness_errors(entries, declared)
        dj_raw = clean_name(bronze['artist_name'])
        dj_valid = bool(dj_raw) and not is_placeholder_artist(dj_raw)
        dj_name = await resolve_artist(conn, dj_raw, 'ingest') if dj_valid else (dj_raw or 'Unknown')
        dj_id = await conn.fetchval('SELECT id FROM silver_enriched_artists WHERE canonical_name = $1', dj_name) if dj_valid else None
        name = bronze['playlist_name'] or bronze['event_name'] or str(bronze['source_url'])
        status = 'failed' if errors else ('valid' if dj_valid else 'needs_review')
        warnings = [] if dj_valid else ['dj_artist_missing']
        metadata = json.dumps({'ingested_by': INGEST_MARKER, 'source': source, 'adopted': existing is not None,
                               'validation_errors': errors or None, 'validation_warnings': warnings})
        if existing:
            silver_playlist = existing['id']
            await conn.execute("""
                UPDATE silver_enriched_playlists SET enrichment_metadata = $2::jsonb, validation_status = $3, updated_at = NOW()
                WHERE id = $1""", silver_playlist, metadata, status)
        else:
            silver_playlist = await conn.fetchval("""
                INSERT INTO silver_enriched_playlists (bronze_id, playlist_name, artist_id, artist_name, event_name, event_date,
                    track_count, validation_status, enrichment_metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb) RETURNING id
            """, bronze_playlist_id, name, dj_id, dj_name, bronze['event_name'], bronze['event_date'], declared or len(entries) or None,
                                                  status, metadata)
        if errors:
            await outbox.append(conn, 'setlist', silver_playlist, 'rejected', errors)
            return {'status': 'rejected', 'silver_playlist_id': str(silver_playlist), 'errors': errors, 'entries': [],
                    'transitions': 0, 'created': 0, 'updated': 0, 'failed': len(entries)}

        result: Dict[str, Any] = {'status': 'ingested', 'silver_playlist_id': str(silver_playlist), 'entries': [],
                                  'transitions': 0, 'created': 0, 'updated': 0, 'failed': 0}
        track_at: Dict[int, UUID] = {}
        for entry in sorted(entries, key=lambda e: e['position']):
            artist, title = clean_name(entry['artist']), clean_name(entry['title'])
            base = {'position': entry['position'], 'artist': artist, 'title': title}
            if is_placeholder_artist(artist) or not title:
                result['failed'] += 1
                result['entries'].append({**base, 'status': 'failed', 'error': 'A specific artist and a title are required'})
                continue
            stored = await upsert_track(conn, artist, title, entry['bronze_id'], entry['source'] or source, entry['raw'])
            track_at[entry['position']] = stored['id']
            result['created' if stored['status'] == 'created' else 'updated'] += 1
            result['entries'].append({**base, 'status': stored['status'], 'track_id': str(stored['id'])})
            await conn.execute("""
                INSERT INTO silver_playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3)
                ON CONFLICT DO NOTHING""", silver_playlist, stored['id'], entry['position'])

        already_linked = existing is not None and await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM silver_track_transitions WHERE playlist_occurrences::text LIKE $1 OR playlist_occurrences::text LIKE $2)",
            f'%{bronze_playlist_id}%', f'%{silver_playlist}%')
        if not already_linked:
            for position, from_track in sorted(track_at.items()):
                to_track = track_at.get(position + 1)
                if to_track is None or to_track == from_track:
                    continue
                occurrence = json.dumps([{'playlist_id': str(silver_playlist), 'bronze_playlist_id': str(bronze_playlist_id),
                                          'position': position, 'source': source,
                                          'date': bronze['event_date'].isoformat() if isinstance(bronze['event_date'], date) else None}])
                await conn.execute("""
                    INSERT INTO silver_track_transitions (from_track_id, to_track_id, playlist_occurrences)
                    VALUES ($1, $2, $3::jsonb)
                    ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
                        occurrence_count = silver_track_transitions.occurrence_count + 1, last_seen = NOW(), updated_at = NOW(),
                        playlist_occurrences = silver_track_transitions.playlist_occurrences || EXCLUDED.playlist_occurrences
                """, from_track, to_track, occurrence)
                result['transitions'] += 1
        await outbox.append(conn, 'setlist', silver_playlist, 'ingested', {
            'tracks': len(track_at), 'transitions': result['transitions'], 'source': source})
        return result


async def ingest_standalone_tracks(conn, limit: int = 100) -> Dict[str, int]:
    """Bronze tracks with no playlist (store/chart spiders): silver tracks without transitions."""
    rows = await conn.fetch("""
        SELECT b.id, b.source, b.artist_name, b.track_title, b.raw_json FROM bronze_scraped_tracks b
        WHERE b.playlist_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM silver_enriched_tracks t WHERE t.bronze_id = b.id OR b.id = ANY(COALESCE(t.additional_bronze_ids, '{}')))
        ORDER BY b.scraped_at, b.id LIMIT $1""", limit)
    counts = {'examined': len(rows), 'created': 0, 'updated': 0, 'skipped': 0}
    for row in rows:
        raw = raw_object(row['raw_json'])
        artist = clean_name(row['artist_name'] or raw.get('artist_name') or raw.get('artist'))
        title = clean_name(row['track_title'] or raw.get('track_title') or raw.get('track_name') or raw.get('title'))
        if is_placeholder_artist(artist) or not title:
            counts['skipped'] += 1
            continue
        async with conn.transaction():
            stored = await upsert_track(conn, artist, title, row['id'], row['source'], raw)
        counts[stored['status']] += 1
    return counts


async def ingest_pending(conn, limit: int = 25) -> Dict[str, Any]:
    """Ingest bronze playlists that have not been ingested yet (oldest first), then standalone tracks."""
    pending = [r['id'] for r in await conn.fetch("""
        SELECT b.id FROM bronze_scraped_playlists b
        LEFT JOIN silver_enriched_playlists p ON p.bronze_id = b.id AND p.enrichment_metadata->>'ingested_by' = $2
        WHERE p.id IS NULL ORDER BY b.scraped_at, b.id LIMIT $1""", limit, INGEST_MARKER)]
    summary = {'playlists': {'examined': len(pending), 'ingested': 0, 'rejected': 0, 'transitions': 0}}
    for bronze_id in pending:
        outcome = await ingest_playlist(conn, bronze_id)
        key = 'rejected' if outcome['status'] == 'rejected' else 'ingested'
        summary['playlists'][key] += 1
        summary['playlists']['transitions'] += outcome['transitions']
    summary['tracks'] = await ingest_standalone_tracks(conn, limit * 4)
    return summary
