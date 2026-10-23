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

PLACEHOLDER_ARTISTS = ('', 'unknown', 'unknown artist', 'various', 'various artists', 'va')
PLACEHOLDER_PREFIXES = ('va @', 'various artists @', 'unknown artist,', 'unknown artist @')
IMPORT_SOURCE = 'user_import'
IMPORT_SCRAPER_VERSION = 'rest-api-tracklist-import-v1'


class CatalogError(Exception):
    """Domain failure carrying the HTTP status the API layer should report."""

    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status, self.detail = status, detail


def clean_name(value: Optional[str]) -> str:
    return (value or '').strip()


def normalize(name: str) -> str:
    return name.lower().strip()


def is_placeholder_artist(name: Optional[str]) -> bool:
    key = normalize(name or '')
    return key in PLACEHOLDER_ARTISTS or key.startswith(PLACEHOLDER_PREFIXES)


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
    return dict(await conn.fetchrow("""
        INSERT INTO silver_enriched_artists (
            bronze_ids, canonical_name, aliases, normalized_name, spotify_id, musicbrainz_id, beatport_id,
            genres, country, validation_status, enrichment_metadata, deduplication_strategy)
        VALUES ('{}', $1, $2, $3, $4, $5, $6, $7, $8, 'needs_review', $9::jsonb, 'manual')
        RETURNING id AS artist_id, created_at, updated_at
    """, name, artist.aliases, key, artist.spotify_id, artist.musicbrainz_id, getattr(artist, 'beatport_id', None),
        artist.genre_preferences, artist.country,
        manual_metadata(is_verified=artist.is_verified, popularity_score=artist.popularity_score, **external)))


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
        # Silver has no per-track artist junction, so there are no role conflicts to delete;
        # report titles that now repeat under the surviving artist for manual review.
        repeated = await conn.fetchval("""
            SELECT count(*) FROM (SELECT 1 FROM silver_enriched_tracks WHERE artist_name = $1
                                  GROUP BY lower(track_title) HAVING count(*) > 1) d
        """, target['canonical_name'])
    return {
        'merged_from': {'artist_id': str(duplicate_id), 'name': duplicate['canonical_name']},
        'merged_into': {'artist_id': str(target_id), 'name': target['canonical_name']},
        'tracks_moved': moved, 'conflicts_resolved': 0, 'repeated_titles': repeated,
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
    return dict(await conn.fetchrow("""
        INSERT INTO silver_enriched_tracks (
            artist_name, track_title, spotify_id, isrc, release_date, duration_ms, bpm, key, genre,
            energy, valence, danceability, validation_status, enrichment_metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'needs_review', $13::jsonb)
        RETURNING id AS song_id, created_at, updated_at
    """, artist, title, track.spotify_id, track.isrc, track.release_date, track.duration_ms, track.bpm,
        track.musical_key, [track.genre] if track.genre else None, track.energy, track.valence,
        track.danceability, manual_metadata(**extra)))


async def resolve_artist(conn, name: str) -> str:
    """Return the canonical artist name for `name`, creating a manual-lineage artist when none matches."""
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
    """, name, key, json.dumps({'source': IMPORT_SOURCE}))


def import_digest(entries: List[Dict[str, str]]) -> str:
    ordered = [[normalize(e['artist']), normalize(e['title'])] for e in entries]
    return hashlib.sha256(json.dumps(ordered).encode()).hexdigest()


async def import_tracklist(conn, tracks, dj_artist: Optional[str] = None, name: Optional[str] = None) -> Dict[str, Any]:
    """Bronze first (positions preserved), then silver tracks, optional silver set, and N -> N+1 transitions.

    Replaying the same ordered list is a no-op: the bronze playlist is keyed by a content digest.
    """
    stats: Dict[str, Any] = {'created': 0, 'updated': 0, 'failed': 0, 'total': len(tracks), 'details': [],
                             'transitions_created': 0, 'replayed': False}
    entries = []
    for position, item in enumerate(tracks, start=1):
        artist, title = clean_name(item.artist), clean_name(item.title)
        if is_placeholder_artist(artist) or not title:
            stats['failed'] += 1
            stats['details'].append({'artist': item.artist, 'title': item.title, 'position': position,
                                     'status': 'failed',
                                     'error': 'A specific artist and a title are required'})
            continue
        entries.append({'artist': artist, 'title': title, 'position': position, 'track_number': item.track_number})
    if not entries:
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
        """, IMPORT_SOURCE, url, digest, IMPORT_SCRAPER_VERSION, json.dumps({'tracks': entries}),
            name or f'User import {digest[:8]}', dj)
        if playlist is None:
            stats['replayed'] = True
            stats['details'] = [{'artist': e['artist'], 'title': e['title'], 'position': e['position'],
                                 'status': 'unchanged'} for e in entries] + stats['details']
            return stats
        silver_ids: Dict[int, UUID] = {}
        for entry in entries:
            artist = await resolve_artist(conn, entry['artist'])
            bronze = await conn.fetchval("""
                INSERT INTO bronze_scraped_tracks (source, source_url, source_track_id, scraper_version, raw_json,
                                                   artist_name, track_title)
                VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING id
            """, IMPORT_SOURCE, url, str(entry['position']), IMPORT_SCRAPER_VERSION, json.dumps(entry),
                entry['artist'], entry['title'])
            track = await conn.fetchval("""
                SELECT id FROM silver_enriched_tracks
                WHERE lower(artist_name) = lower($1) AND lower(track_title) = lower($2) ORDER BY created_at LIMIT 1
            """, artist, entry['title'])
            if track:
                await conn.execute("""
                    UPDATE silver_enriched_tracks
                    SET additional_bronze_ids = COALESCE(additional_bronze_ids, '{}') || $2::uuid, updated_at = NOW()
                    WHERE id = $1
                """, track, bronze)
                status = 'updated'
            else:
                track = await conn.fetchval("""
                    INSERT INTO silver_enriched_tracks (bronze_id, artist_name, track_title, validation_status,
                                                        enrichment_metadata)
                    VALUES ($1, $2, $3, 'needs_review', $4::jsonb) RETURNING id
                """, bronze, artist, entry['title'], json.dumps({'source': IMPORT_SOURCE}))
                status = 'created'
            stats['created' if status == 'created' else 'updated'] += 1
            stats['details'].append({'artist': entry['artist'], 'title': entry['title'], 'position': entry['position'],
                                     'status': status, 'track_id': str(track)})
            silver_ids[entry['position']] = track
        if dj:
            silver_set = await conn.fetchval("""
                INSERT INTO silver_enriched_playlists (bronze_id, playlist_name, artist_id, artist_name, track_count,
                                                       validation_status, enrichment_metadata)
                VALUES ($1, $2, (SELECT id FROM silver_enriched_artists WHERE canonical_name = $3), $3, $4,
                        'needs_review', $5::jsonb) RETURNING id
            """, playlist, name or f'User import {digest[:8]}', await resolve_artist(conn, dj), len(entries),
                json.dumps({'source': IMPORT_SOURCE}))
            for entry in entries:
                await conn.execute(
                    'INSERT INTO silver_playlist_tracks (playlist_id, track_id, position) VALUES ($1, $2, $3)',
                    silver_set, silver_ids[entry['position']], entry['position'])
        # Transitions only join positions N and N+1 that both imported; a skipped row breaks the chain.
        for left in entries:
            right_position = left['position'] + 1
            if right_position not in silver_ids or silver_ids[left['position']] == silver_ids[right_position]:
                continue
            occurrence = json.dumps([{'playlist_id': str(playlist), 'position': left['position'],
                                      'source': IMPORT_SOURCE}])
            await conn.execute("""
                INSERT INTO silver_track_transitions (from_track_id, to_track_id, playlist_occurrences)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (from_track_id, to_track_id) DO UPDATE SET
                    occurrence_count = silver_track_transitions.occurrence_count + 1, last_seen = NOW(),
                    updated_at = NOW(),
                    playlist_occurrences = silver_track_transitions.playlist_occurrences || EXCLUDED.playlist_occurrences
            """, silver_ids[left['position']], silver_ids[right_position], occurrence)
            stats['transitions_created'] += 1
    return stats
