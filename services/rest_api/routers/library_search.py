import json
from typing import List, Optional
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

def get_pool():
    from main import db_pool
    return db_pool

router = APIRouter(prefix="/api/v1/library", tags=["library-search"])

class LibraryTrackSearchResponse(BaseModel):
    id: str
    a: str
    t: str
    m: Optional[str]
    d: Optional[float]
    bpm: Optional[float]
    k: Optional[str]
    e: Optional[float]
    p: Optional[str]
    rot: Optional[int]
    tags: Optional[List[str]] = []
    src: Optional[List[str]] = []
    first: Optional[str]
    last: Optional[str]
    g: Optional[str]
    lbl: Optional[str]
    sync: Optional[str]
    tidal: Optional[str]
    dz: Optional[str]
    bp: Optional[str]
    chart: Optional[dict]
    rev: bool
    ovr: bool
    local: bool
    mbid: Optional[str] = None
    mbconf: Optional[str] = None
    mbdump: Optional[str] = None
    source_url: Optional[str] = None

def substring(query: str) -> str:
    return '%' + query.replace('\\\\', '\\\\\\\\').replace('%', '\\\\%').replace('_', '\\\\_') + '%'

@router.get('/search', response_model=List[LibraryTrackSearchResponse])
async def library_search(
    q: Optional[str] = Query(None, description="Text query over artist, title, mix, aliases"),
    pillar: Optional[str] = None,
    tier: Optional[str] = None,
    rotation: Optional[int] = None,
    source: Optional[str] = None,
    crate: Optional[str] = None,
    tags: Optional[str] = None,
    label: Optional[str] = None,
    limit: int = Query(50, ge=1, le=5000),
    offset: int = Query(0, ge=0)
):
    query_parts = []
    params = []

    query_parts.append("""
        SELECT pt.track_id as id,
               pt.artist_name as a,
               pt.track_title as t,
               pt.mix_name as m,
               (pt.duration_ms / 1000.0) as d,
               pt.bpm,
               pt.camelot_key as k,
               pt.energy_canonical as e,
               pt.genre as p,
               (SELECT r.rotation::int FROM library.rotation_history r WHERE r.track_id = pt.track_id ORDER BY changed_at DESC LIMIT 1) as rot,
               ARRAY(SELECT tag FROM library.track_tags WHERE track_id = pt.track_id) as tags,
               ARRAY(SELECT source FROM library.appearances WHERE track_id = pt.track_id) as src,
               (SELECT min(date)::text FROM library.appearances WHERE track_id = pt.track_id) as first,
               (SELECT max(date)::text FROM library.appearances WHERE track_id = pt.track_id) as last,
               pt.genre as g,
               pt.record_label as lbl,
               NULL as sync,
               pt.tidal_id as tidal,
               pt.deezer_id as dz,
               NULL as bp,
               NULL as chart,
               pt.metadata_review as rev,
               FALSE as ovr,
               FALSE as local,
               evi.value #>> '{}' as mbid,
               evi.confidence::text as mbconf,
               evi.raw->>'dump_date' as mbdump,
               evi.raw->>'source_url' as source_url
        FROM projection_tracks pt
        JOIN library.tracks lt ON lt.id = pt.track_id
        LEFT JOIN silver_enriched_artists sa ON sa.canonical_name = pt.artist_name
        LEFT JOIN LATERAL (
            SELECT e.value, e.confidence, e.raw FROM silver_track_metadata_evidence e
            WHERE e.track_id = pt.track_id AND e.field = 'musicbrainz_id'
            ORDER BY e.confidence DESC NULLS LAST, e.id DESC LIMIT 1
        ) evi ON TRUE
    """)

    where_clauses = []

    if q:
        params.append(substring(q))
        idx = len(params)
        where_clauses.append(f"""
            (pt.track_title ILIKE ${idx}
             OR pt.artist_name ILIKE ${idx}
             OR pt.mix_name ILIKE ${idx}
             OR immutable_array_to_string(sa.aliases, ' ') ILIKE ${idx}
             OR to_tsvector('english', pt.track_title || ' ' || pt.artist_name) @@ plainto_tsquery('english', ${idx}))
        """)

    if rotation is not None:
        params.append(rotation)
        idx = len(params)
        where_clauses.append(f"""
            (SELECT r.rotation::int FROM library.rotation_history r WHERE r.track_id = pt.track_id ORDER BY changed_at DESC LIMIT 1) = ${idx}
        """)

    if tags:
        tags_list = [t.strip() for t in tags.split(',')]
        params.append(tags_list)
        idx = len(params)
        where_clauses.append(f"EXISTS (SELECT 1 FROM library.track_tags tt WHERE tt.track_id = pt.track_id AND tt.tag = ANY(${idx}))")

    if label:
        params.append(substring(label))
        idx = len(params)
        where_clauses.append(f"pt.record_label ILIKE ${idx}")

    if pillar:
        params.append(pillar)
        idx = len(params)
        where_clauses.append(f"pt.genre = ${idx}")

    if source:
        params.append(source)
        idx = len(params)
        where_clauses.append(f"EXISTS (SELECT 1 FROM library.appearances app WHERE app.track_id = pt.track_id AND app.source = ${idx})")

    if where_clauses:
        query_parts.append("WHERE " + " AND ".join(where_clauses))

    query_parts.append("ORDER BY pt.artist_name, pt.track_title, pt.track_id")

    params.append(limit)
    limit_idx = len(params)
    params.append(offset)
    offset_idx = len(params)

    query_parts.append(f"LIMIT ${limit_idx} OFFSET ${offset_idx}")

    final_query = " ".join(query_parts)

    async with get_pool().acquire() as conn:
        rows = await conn.fetch(final_query, *params)

    results = []
    for row in rows:
        r_dict = dict(row)
        r_dict['id'] = str(r_dict['id'])
        r_dict['rot'] = int(r_dict['rot']) if r_dict['rot'] else None
        results.append(r_dict)

    return results

def register(app):
    app.include_router(router)
