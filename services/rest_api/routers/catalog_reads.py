"""Silver-catalog reads preserving legacy field names and explicit source provenance."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from common.track_metadata import stored_metadata

from catalog_models import (CatalogArtist, CatalogSetlist, CatalogSetlistDetail,
                            CatalogSetlistEntry, CatalogTrack)

router = APIRouter(tags=['catalog'])


def get_pool():
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=503, detail='Database pool not initialized')
    return db_pool


def track_uuid(value):
    try:
        return UUID(value.removeprefix('song_'))
    except ValueError:
        raise HTTPException(status_code=422, detail='Invalid track ID')


def substring(value):
    if not value.strip():
        raise HTTPException(status_code=422, detail='Search query must contain text')
    return '%' + value.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'


def provenance(row):
    source = row['source']
    sources = row['sources'] if 'sources' in row.keys() else ([source] if source is not None else [])
    return {'data_source': source, 'data_sources': sources,
            'source_url': row['source_url'], 'scrape_timestamp': row['scraped_at'],
            'created_at': row['created_at'], 'updated_at': row['updated_at']}


TRACK_COLUMNS = """
    t.*, b.source, b.source_url, b.source_track_id, b.scraped_at,
    ARRAY(SELECT DISTINCT lineage.source FROM bronze_scraped_tracks lineage
          WHERE lineage.id = t.bronze_id OR lineage.id = ANY(t.additional_bronze_ids)
          ORDER BY lineage.source) AS sources
"""
TRACK_FROM = """
    FROM silver_enriched_tracks t
    LEFT JOIN bronze_scraped_tracks b ON b.id = t.bronze_id
"""
TRACK_SELECT = f'SELECT {TRACK_COLUMNS} {TRACK_FROM}'


def track_response(row):
    title, artist, duration = row['track_title'], row['artist_name'], row['duration_ms']
    return CatalogTrack(
        **provenance(row), id=row['id'], song_id=row['id'], track_id=row['id'],
        source_track_id=row['source_track_id'], name=title, title=title, track_name=title,
        normalized_title=title.casefold().strip(), artist=artist, artist_name=artist,
        **stored_metadata(dict(row)), release_date=row['release_date'],
        genre=row['genre'][0] if row['genre'] else None, genres=row['genre'],
        )


@router.get('/api/v1/tracks', response_model=List[CatalogTrack])
async def list_tracks(
    artist_id: Optional[UUID] = None,
    min_bpm: Optional[float] = Query(None, ge=20, le=300),
    max_bpm: Optional[float] = Query(None, ge=20, le=300),
    limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
):
    if min_bpm is not None and max_bpm is not None and min_bpm > max_bpm:
        raise HTTPException(status_code=422, detail='min_bpm must not exceed max_bpm')
    conditions, params = [], []
    if artist_id is not None:
        params.append(artist_id)
        # Silver currently records a track's artist as text, not a canonical FK.
        conditions.append(f't.artist_name = (SELECT canonical_name FROM silver_enriched_artists WHERE id = ${len(params)})')
    for value, operator in [(min_bpm, '>='), (max_bpm, '<=')]:
        if value is not None:
            params.append(value)
            conditions.append(f't.bpm {operator} ${len(params)}')
    where = ' WHERE ' + ' AND '.join(conditions) if conditions else ''
    params.extend([limit, offset])
    query = TRACK_SELECT + where + f' ORDER BY t.created_at DESC, t.id LIMIT ${len(params)-1} OFFSET ${len(params)}'
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(query, *params)
    return [track_response(row) for row in rows]


@router.get('/api/search/tracks', response_model=List[CatalogTrack])
async def search_tracks(query: str = Query(..., min_length=1, max_length=500),
                        limit: int = Query(20, ge=1, le=500), offset: int = Query(0, ge=0)):
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(TRACK_SELECT + """
            WHERE t.track_title ILIKE $1 OR t.artist_name ILIKE $1
            ORDER BY CASE WHEN lower(t.track_title) = lower($2) THEN 0 ELSE 1 END,
                     lower(t.track_title), t.id
            LIMIT $3 OFFSET $4
        """, substring(query), query.strip(), limit, offset)
    return [track_response(row) for row in rows]


@router.get('/api/tracks/{track_id}', response_model=CatalogTrack)
@router.get('/api/v1/tracks/{track_id}', response_model=CatalogTrack)
async def get_track(track_id: str):
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow(TRACK_SELECT + ' WHERE t.id = $1', track_uuid(track_id))
    if row is None:
        raise HTTPException(status_code=404, detail='Track not found')
    return track_response(row)


ARTIST_SELECT = """
    SELECT a.*,
           ARRAY(SELECT DISTINCT b.source FROM bronze_scraped_artists b
                 WHERE b.id = ANY(a.bronze_ids) ORDER BY b.source) AS sources,
           (SELECT max(b.scraped_at) FROM bronze_scraped_artists b
            WHERE b.id = ANY(a.bronze_ids)) AS scraped_at,
           (SELECT count(*) FROM silver_enriched_tracks t
            WHERE t.artist_name = a.canonical_name) AS track_count
    FROM silver_enriched_artists a
"""


def artist_response(row):
    sources = row['sources']
    return CatalogArtist(
        artist_id=row['id'], name=row['canonical_name'], artist_name=row['canonical_name'],
        normalized_name=row['normalized_name'], aliases=row['aliases'],
        genres=row['genres'], genre_preferences=row['genres'], country=row['country'],
        spotify_id=row['spotify_id'], musicbrainz_id=row['musicbrainz_id'],
        discogs_id=row['discogs_id'], beatport_id=row['beatport_id'], track_count=row['track_count'],
        data_source=sources[0] if len(sources) == 1 else None, data_sources=sources,
        scrape_timestamp=row['scraped_at'], created_at=row['created_at'], updated_at=row['updated_at'])


@router.get('/api/v1/artists', response_model=List[CatalogArtist])
async def list_artists(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(ARTIST_SELECT + ' ORDER BY lower(a.canonical_name), a.id LIMIT $1 OFFSET $2', limit, offset)
    return [artist_response(row) for row in rows]


@router.get('/api/v1/artists/search', response_model=List[CatalogArtist])
async def search_artists(query: str = Query(..., min_length=1, max_length=255), limit: int = Query(20, ge=1, le=100)):
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(ARTIST_SELECT + """
            WHERE a.canonical_name ILIKE $1 OR EXISTS (SELECT 1 FROM unnest(a.aliases) alias WHERE alias ILIKE $1)
            ORDER BY CASE WHEN lower(a.canonical_name) = lower($2) THEN 0 ELSE 1 END,
                     lower(a.canonical_name), a.id LIMIT $3
        """, substring(query), query.strip(), limit)
    results = []
    for row in rows:
        name, term = row['canonical_name'].casefold(), query.strip().casefold()
        score = 1.0 if name == term else 0.9 if name.startswith(term) else 0.7
        results.append(artist_response(row).model_copy(update={'match_score': score}))
    return results


@router.get('/api/v1/artists/{artist_id}', response_model=CatalogArtist)
async def get_artist(artist_id: UUID):
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow(ARTIST_SELECT + ' WHERE a.id = $1', artist_id)
    if row is None:
        raise HTTPException(status_code=404, detail='Artist not found')
    return artist_response(row)


SETLIST_SELECT = """
    SELECT p.*, b.source, b.source_url, b.scraped_at,
           (SELECT count(*) FROM silver_playlist_tracks m WHERE m.playlist_id = p.id) AS loaded_track_count
    FROM silver_enriched_playlists p
    LEFT JOIN bronze_scraped_playlists b ON b.id = p.bronze_id
"""


def setlist_response(row):
    duration = row['total_duration_ms']
    return CatalogSetlist(
        **provenance(row), playlist_id=row['id'], setlist_name=row['playlist_name'],
        normalized_name=row['playlist_name'].casefold().strip(), dj_artist_id=row['artist_id'],
        dj_artist_name=row['artist_name'], event_name=row['event_name'], set_date=row['event_date'],
        venue_name=row['event_venue'], venue_location=row['event_location'],
        total_tracks=row['loaded_track_count'], declared_track_count=row['track_count'],
        total_duration_ms=duration, duration_minutes=duration / 60000 if duration is not None else None)


@router.get('/api/v1/setlists', response_model=List[CatalogSetlist])
@router.get('/api/v1/playlists', response_model=List[CatalogSetlist])
async def list_setlists(dj_id: Optional[UUID] = None, source: Optional[str] = None,
                       limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    params, conditions = [], []
    for field, value in [('p.artist_id', dj_id), ('b.source', source)]:
        if value is not None:
            params.append(value)
            conditions.append(f'{field} = ${len(params)}')
    params.extend([limit, offset])
    where = ' WHERE ' + ' AND '.join(conditions) if conditions else ''
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(SETLIST_SELECT + where + f' ORDER BY p.event_date DESC NULLS LAST, p.id LIMIT ${len(params)-1} OFFSET ${len(params)}', *params)
    return [setlist_response(row) for row in rows]


async def setlist_detail(conn, playlist_id):
    row = await conn.fetchrow(SETLIST_SELECT + ' WHERE p.id = $1', playlist_id)
    if row is None:
        raise HTTPException(status_code=404, detail='Setlist not found')
    rows = await conn.fetch(f"""
        SELECT {TRACK_COLUMNS}, m.position, m.cue_time_ms {TRACK_FROM}
        JOIN silver_playlist_tracks m ON m.track_id = t.id
        WHERE m.playlist_id = $1 ORDER BY m.position, m.created_at, m.track_id
    """, playlist_id)
    tracks = [CatalogSetlistEntry(playlist_id=playlist_id, track_id=entry['id'],
                                 position=entry['position'], cue_time_ms=entry['cue_time_ms'],
                                 track=track_response(entry)) for entry in rows]
    return CatalogSetlistDetail(**setlist_response(row).model_dump(), tracks=tracks)


@router.get('/api/v1/setlists/{playlist_id}', response_model=CatalogSetlistDetail)
@router.get('/api/v1/playlists/{playlist_id}', response_model=CatalogSetlistDetail)
async def get_setlist(playlist_id: UUID):
    async with get_pool().acquire() as conn:
        async with conn.transaction(isolation='repeatable_read', readonly=True):
            return await setlist_detail(conn, playlist_id)


@router.get('/api/v1/setlists/{playlist_id}/tracks', response_model=List[CatalogSetlistEntry])
async def get_setlist_tracks(playlist_id: UUID):
    return (await get_setlist(playlist_id)).tracks
