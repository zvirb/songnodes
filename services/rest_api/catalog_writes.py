"""Silver-catalog write operations (domain logic, independent of HTTP handlers).

Silver stores a track's primary artist as `artist_name` text that equals
`silver_enriched_artists.canonical_name`; there is no junction table. Every
operation that changes an artist therefore updates both sides in one transaction.
Nothing here invents metadata: unknown values stay NULL and manual rows carry
`enrichment_metadata.source = 'manual'`.
"""
import hashlib
import json
from typing import Any, Dict, List, Optional
from uuid import UUID

from common.datalayer import evidence, ingest, outbox
from common.datalayer.errors import CatalogError  # noqa: F401  (re-exported for callers)
from common.metadata.names import (PLACEHOLDER_ARTISTS, PLACEHOLDER_PREFIXES, clean_name, is_placeholder_artist,  # noqa: F401
                                   normalize)

IMPORT_SOURCE = 'user_import'
IMPORT_SCRAPER_VERSION = 'rest-api-tracklist-import-v1'


def require_artist_name(name: Optional[str]) -> str:
    name = clean_name(name)
    if is_placeholder_artist(name):
        raise CatalogError(422, f'Artist name "{name}" is empty or a generic placeholder')
    return name


def track_uuid(value: str) -> UUID:
    try:
        return UUID(value.removeprefix('song_'))
    except ValueError:
        raise CatalogError(422, 'Invalid track ID')


def artist_uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise CatalogError(422, 'Invalid artist ID')


def manual_metadata(**fields: Any) -> str:
    return json.dumps({'source': 'manual', **{k: v for k, v in fields.items() if v not in (None, '', [], False)}},
                      default=str)


async def lock_artists(conn, *ids: UUID) -> Dict[UUID, Any]:
    rows = await conn.fetch(
        'SELECT * FROM silver_enriched_artists WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE', list(ids))
    return {row['id']: row for row in rows}


async def create_artist(conn, artist) -> Dict[str, Any]:
    name = require_artist_name(artist.artist_name)
    key = normalize(name)
    clash = await conn.fetchval(
        'SELECT canonical_name FROM silver_enriched_artists WHERE canonical_name = $1 OR normalized_name = $2',
        name, key)
    if clash:
        raise CatalogError(409, f"Artist '{clash}' already exists")
    external = {k: getattr(artist, k, None) for k in
                ('apple_music_id', 'youtube_music_id', 'deezer_id', 'tidal_id', 'soundcloud_id', 'discogs_id')}
    async with conn.transaction():
        row = await conn.fetchrow("""
        INSERT INTO silver_enriched_artists (
            bronze_ids, canonical_name, aliases, normalized_name, spotify_id, musicbrainz_id, beatport_id,
            genres, country, validation_status, enrichment_metadata, deduplication_strategy)
        VALUES ('{}', $1, $2, $3, $4, $5, $6, $7, $8, 'needs_review', $9::jsonb, 'manual')
        RETURNING id AS artist_id, created_at, updated_at
    """, name, artist.aliases, key, artist.spotify_id, artist.musicbrainz_id, getattr(artist, 'beatport_id', None),
        artist.genre_preferences, artist.country,
        manual_metadata(is_verified=artist.is_verified, popularity_score=artist.popularity_score, **external))
        await outbox.append(conn, 'artist', row['artist_id'], 'created', {'name': name})
    return dict(row)


async def rename_artist(conn, artist_id: UUID, new_name: str) -> Dict[str, Any]:
    new_name = require_artist_name(new_name)
    key = normalize(new_name)
    async with conn.transaction():
        artist = (await lock_artists(conn, artist_id)).get(artist_id)
        if artist is None:
            raise CatalogError(404, 'Artist not found')
        old = artist['canonical_name']
        if old == new_name:
            return {'artist_id': str(artist_id), 'name': old, 'updated_at': artist['updated_at'], 'tracks_updated': 0}
        clash = await conn.fetchval("""
            SELECT canonical_name FROM silver_enriched_artists
            WHERE id <> $1 AND (canonical_name = $2 OR normalized_name = $3)
        """, artist_id, new_name, key)
        if clash:
            raise CatalogError(409, f"Artist '{clash}' already exists. Use merge endpoint instead.")
        updated = await conn.fetchval("""
            UPDATE silver_enriched_artists
            SET canonical_name = $2, normalized_name = $3, updated_at = NOW(),
                aliases = ARRAY(SELECT DISTINCT a FROM unnest(COALESCE(aliases, '{}') || $4::text) a WHERE a <> $2)
            WHERE id = $1 RETURNING updated_at
        """, artist_id, new_name, key, old)
        tracks = await retarget_artist_rows(conn, old, artist_id, artist_id, new_name)
        await outbox.append(conn, 'artist', artist_id, 'renamed', {'old_name': old, 'new_name': new_name})
    return {'artist_id': str(artist_id), 'name': new_name, 'updated_at': updated, 'tracks_updated': tracks}


async def retarget_artist_rows(conn, old_name: str, old_id: UUID, new_id: UUID, new_name: str) -> int:
    """Point tracks (by name) and DJ-set rows (by id) at the surviving artist."""
    moved = await conn.execute(
        'UPDATE silver_enriched_tracks SET artist_name = $2, updated_at = NOW() WHERE artist_name = $1',
        old_name, new_name)
    await conn.execute(
        'UPDATE silver_enriched_playlists SET artist_id = $2, artist_name = $3, updated_at = NOW() WHERE artist_id = $1',
        old_id, new_id, new_name)
    return int(moved.split()[-1])


async def merge_artist(conn, duplicate_id: UUID, target_name: str) -> Dict[str, Any]:
    target_name = clean_name(target_name)
    async with conn.transaction():
        target_id = await conn.fetchval('SELECT id FROM silver_enriched_artists WHERE canonical_name = $1', target_name)
        if target_id is None:
            raise CatalogError(404, f"Target artist '{target_name}' not found. Use rename endpoint instead.")
        if target_id == duplicate_id:
            raise CatalogError(400, 'Cannot merge artist with itself')
        locked = await lock_artists(conn, duplicate_id, target_id)
        duplicate, target = locked.get(duplicate_id), locked.get(target_id)
        if duplicate is None:
            raise CatalogError(404, 'Duplicate artist not found')
        snapshot = {
            'duplicate': json.loads(await conn.fetchval('SELECT to_jsonb(a)::text FROM silver_enriched_artists a WHERE id = $1', duplicate_id)),
            'target_before': json.loads(await conn.fetchval("""
                SELECT jsonb_build_object('aliases', aliases, 'bronze_ids', bronze_ids, 'merged_artist_ids', merged_artist_ids,
                                          'deduplication_strategy', deduplication_strategy)::text
                FROM silver_enriched_artists WHERE id = $1""", target_id)),
            'moved_track_ids': [str(r['id']) for r in await conn.fetch(
                'SELECT id FROM silver_enriched_tracks WHERE artist_name = $1', duplicate['canonical_name'])],
            'moved_set_ids': [str(r['id']) for r in await conn.fetch(
                'SELECT id FROM silver_enriched_playlists WHERE artist_id = $1', duplicate_id)],
            'target_name': target['canonical_name'],
            'flattened': [str(r['old_id']) for r in await conn.fetch(
                "SELECT old_id FROM entity_redirects WHERE entity_type = 'artist' AND new_id = $1", duplicate_id)],
        }
        await conn.execute("""
            UPDATE silver_enriched_artists SET
                aliases = ARRAY(SELECT DISTINCT a FROM unnest(
                    COALESCE(aliases, '{}') || COALESCE($2::text[], '{}') || $3::text) a WHERE a <> canonical_name),
                bronze_ids = ARRAY(SELECT DISTINCT b FROM unnest(bronze_ids || $4::uuid[]) b),
                merged_artist_ids = COALESCE(merged_artist_ids, '{}') || $5::uuid[],
                deduplication_strategy = 'manual', updated_at = NOW()
            WHERE id = $1
        """, target_id, duplicate['aliases'], duplicate['canonical_name'], duplicate['bronze_ids'],
            [duplicate_id] + list(duplicate['merged_artist_ids'] or []))
        moved = await retarget_artist_rows(conn, duplicate['canonical_name'], duplicate_id, target_id, target['canonical_name'])
        await conn.execute('DELETE FROM silver_enriched_artists WHERE id = $1', duplicate_id)
        history = await conn.fetchval("""
            INSERT INTO entity_merge_history (entity_type, survivor_id, duplicate_id, snapshot, reason)
            VALUES ('artist', $1, $2, $3::jsonb, 'manual merge') RETURNING id""", target_id, duplicate_id,
                                      json.dumps(snapshot, default=str))
        await conn.execute("UPDATE entity_redirects SET new_id = $1 WHERE entity_type = 'artist' AND new_id = $2", target_id, duplicate_id)
        await conn.execute("INSERT INTO entity_redirects (entity_type, old_id, new_id, history_id) VALUES ('artist', $1, $2, $3)",
                           duplicate_id, target_id, history)
        await outbox.append(conn, 'artist', duplicate_id, 'merged', {
            'name': duplicate['canonical_name'], 'survivor_name': target['canonical_name'], 'survivor_id': str(target_id)})
        # Silver has no per-track artist junction, so there are no role conflicts to delete;
        # report titles that now repeat under the surviving artist for manual review.
        repeated = await conn.fetchval("""
            SELECT count(*) FROM (SELECT 1 FROM silver_enriched_tracks WHERE artist_name = $1
                                  GROUP BY lower(track_title) HAVING count(*) > 1) d
        """, target['canonical_name'])
    return {
        'merged_from': {'artist_id': str(duplicate_id), 'name': duplicate['canonical_name']},
        'merged_into': {'artist_id': str(target_id), 'name': target['canonical_name']},
        'tracks_moved': moved, 'conflicts_resolved': 0, 'repeated_titles': repeated, 'history_id': history,
    }


async def delete_artist(conn, artist_id: UUID) -> Dict[str, Any]:
    async with conn.transaction():
        artist = (await lock_artists(conn, artist_id)).get(artist_id)
        if artist is None:
            raise CatalogError(404, 'Artist not found')
        tracks = await conn.fetchval(
            'SELECT count(*) FROM silver_enriched_tracks WHERE artist_name = $1', artist['canonical_name'])
        sets = await conn.fetchval('SELECT count(*) FROM silver_enriched_playlists WHERE artist_id = $1', artist_id)
        if tracks or sets:
            # Every silver track and set must keep a valid artist, so dependants cannot be detached.
            raise CatalogError(409, f"Artist '{artist['canonical_name']}' still has {tracks} track(s) and {sets} "
                                    'set(s). Rename or merge it instead.')
        await conn.execute('DELETE FROM silver_enriched_artists WHERE id = $1', artist_id)
        await outbox.append(conn, 'artist', artist_id, 'deleted', {'name': artist['canonical_name']})
    return {'artist_id': str(artist_id), 'name': artist['canonical_name'], 'tracks_removed': 0}


async def assign_artist(conn, track_id: UUID, artist_id: UUID, role: str) -> Dict[str, Any]:
    if role != 'primary':
        raise CatalogError(422, "Silver tracks store only a primary artist; role must be 'primary'")
    async with conn.transaction():
        track = await conn.fetchrow('SELECT id, artist_name FROM silver_enriched_tracks WHERE id = $1 FOR UPDATE', track_id)
        if track is None:
            raise CatalogError(404, f"Track '{track_id}' not found")
        artist = await conn.fetchrow('SELECT id, canonical_name FROM silver_enriched_artists WHERE id = $1', artist_id)
        if artist is None:
            raise CatalogError(404, f"Artist '{artist_id}' not found")
        if track['artist_name'] == artist['canonical_name']:
            raise CatalogError(409, 'Artist already assigned to this track with this role')
        if not is_placeholder_artist(track['artist_name']):
            raise CatalogError(409, 'Track already has a primary artist. Remove existing attribution first.')
        updated = await conn.fetchval("""
            UPDATE silver_enriched_tracks
            SET artist_name = $2, updated_at = NOW(),
                enrichment_metadata = enrichment_metadata || jsonb_build_object(
                    'manual_artist_assignment', jsonb_build_object('previous', $3::text, 'at', NOW()))
            WHERE id = $1 RETURNING updated_at
        """, track_id, artist['canonical_name'], track['artist_name'])
        await outbox.append(conn, 'track', track_id, 'updated', {'fields': ['artist_name']})
    return {'success': True, 'track_id': str(track_id), 'artist_id': str(artist_id), 'role': 'primary',
            'position': 0, 'created_at': updated}


async def tracks_missing_artist(conn, limit: int, offset: int, alphabetical: bool) -> List[Any]:
    order = 't.track_title' if alphabetical else 'setlist_count DESC, t.created_at DESC, t.track_title'
    return await conn.fetch(f"""
        SELECT t.id::text AS track_id, t.track_title AS title, t.created_at, t.updated_at,
               (SELECT count(*) FROM silver_playlist_tracks m WHERE m.track_id = t.id) AS setlist_count
        FROM silver_enriched_tracks t
        WHERE lower(btrim(t.artist_name)) = ANY($3::text[]) OR lower(btrim(t.artist_name)) LIKE ANY($4::text[])
        ORDER BY {order} LIMIT $1 OFFSET $2
    """, limit, offset, list(PLACEHOLDER_ARTISTS), [p + '%' for p in PLACEHOLDER_PREFIXES])


async def dirty_artists(conn, limit: int, offset: int) -> List[Any]:
    return await conn.fetch("""
        SELECT a.id::text AS artist_id, a.canonical_name AS name,
               (SELECT count(*) FROM silver_enriched_tracks t WHERE t.artist_name = a.canonical_name) AS track_count
        FROM silver_enriched_artists a
        WHERE a.canonical_name ~ '^\\[' OR a.canonical_name ~ '^[+*-] '
        ORDER BY track_count DESC, a.canonical_name LIMIT $1 OFFSET $2
    """, limit, offset)


async def artist_name_exists(conn, name: str, excluding_id: str) -> bool:
    return await conn.fetchval(
        'SELECT EXISTS(SELECT 1 FROM silver_enriched_artists WHERE canonical_name = $1 AND id <> $2::uuid)',
        name, excluding_id)


async def create_track(conn, track, artist_name: str) -> Dict[str, Any]:
    artist = require_artist_name(artist_name)
    title = clean_name(track.track_name)
    existing = await conn.fetchval(
        'SELECT id FROM silver_enriched_tracks WHERE lower(artist_name) = lower($1) AND lower(track_title) = lower($2)',
        artist, title)
    if existing:
        raise CatalogError(409, f'Track already exists in silver catalog: {existing}')
    extra = {k: getattr(track, k, None) for k in (
        'apple_music_id', 'youtube_id', 'soundcloud_id', 'musicbrainz_id', 'record_label', 'subgenre',
        'is_remix', 'remix_type', 'remixer', 'original_artist', 'data_source')}
    extra = {k: getattr(v, 'value', v) for k, v in extra.items()}
    async with conn.transaction():
        row = await conn.fetchrow("""
            INSERT INTO silver_enriched_tracks (
                artist_name, track_title, spotify_id, isrc, release_date, duration_ms, bpm, key, genre,
                energy, valence, danceability, validation_status, enrichment_metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'needs_review', $13::jsonb)
            RETURNING id AS song_id, created_at, updated_at
        """, artist, title, track.spotify_id, track.isrc, track.release_date, track.duration_ms, track.bpm,
            track.musical_key, [track.genre] if track.genre else None, track.energy, track.valence,
            track.danceability, manual_metadata(**extra))
        for field, value in (('bpm', track.bpm), ('key', track.musical_key)):
            if value is not None:
                await evidence.record(conn, row['song_id'], field, value, 'manual', method='rest_api_create')
        await outbox.append(conn, 'track', row['song_id'], 'created', {'artist': artist, 'title': title})
    return dict(row)


def import_digest(entries: List[Dict[str, str]]) -> str:
    ordered = [[normalize(e['artist']), normalize(e['title'])] for e in entries]
    return hashlib.sha256(json.dumps(ordered).encode()).hexdigest()


async def import_tracklist(conn, tracks, dj_artist: Optional[str] = None, name: Optional[str] = None) -> Dict[str, Any]:
    """Bronze first (every submitted row keeps its position), then the canonical ingestion in `common.datalayer.ingest`.

    Replaying the same ordered list is a no-op: the bronze playlist is keyed by a content digest.
    """
    stats: Dict[str, Any] = {'created': 0, 'updated': 0, 'failed': 0, 'total': len(tracks), 'details': [],
                             'transitions_created': 0, 'replayed': False}
    entries = [{'artist': clean_name(item.artist), 'title': clean_name(item.title), 'position': position,
                'track_number': item.track_number} for position, item in enumerate(tracks, start=1)]
    if not any(not is_placeholder_artist(e['artist']) and e['title'] for e in entries):
        stats['failed'] = len(entries)
        stats['details'] = [{'artist': e['artist'], 'title': e['title'], 'position': e['position'], 'status': 'failed',
                             'error': 'A specific artist and a title are required'} for e in entries]
        return stats
    dj = require_artist_name(dj_artist) if dj_artist else None
    digest = import_digest(entries)
    url = f'user-import://sha256/{digest}'
    async with conn.transaction():
        playlist = await conn.fetchval("""
            INSERT INTO bronze_scraped_playlists (source, source_url, source_playlist_id, scraper_version, raw_json,
                                                  playlist_name, artist_name)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
            ON CONFLICT (source, source_url, source_playlist_id) DO NOTHING RETURNING id
        """, IMPORT_SOURCE, url, digest, IMPORT_SCRAPER_VERSION, json.dumps({'tracks': entries, 'total_tracks': len(entries)}),
            name or f'User import {digest[:8]}', dj)
        if playlist is None:
            stats['replayed'] = True
            stats['details'] = [{'artist': e['artist'], 'title': e['title'], 'position': e['position'], 'status': 'unchanged'}
                                for e in entries]
            return stats
        for entry in entries:
            await conn.execute("""
                INSERT INTO bronze_scraped_tracks (source, source_url, source_track_id, scraper_version, raw_json,
                                                   artist_name, track_title, playlist_id, position)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
            """, IMPORT_SOURCE, url, str(entry['position']), IMPORT_SCRAPER_VERSION, json.dumps(entry),
                entry['artist'], entry['title'], playlist, entry['position'])
        result = await ingest.ingest_playlist(conn, playlist)
    stats.update({'created': result['created'], 'updated': result['updated'], 'failed': result['failed'],
                  'transitions_created': result['transitions'], 'details': result['entries']})
    return stats
