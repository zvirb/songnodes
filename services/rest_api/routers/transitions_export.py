"""Transitions export endpoint (Module M3).

Provides machine-readable transition evidence feed for sister projects.
"""
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Query, HTTPException, Response
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/transitions", tags=["transitions"])


def get_pool():
    from main import db_pool
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database pool not initialized")
    return db_pool


@router.get("/export")
async def export_transitions(
    limit: int = Query(100, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    min_count: int = Query(1, ge=1),
):
    """Export track transition feed conforming to contracts/transitions.v1.json."""
    pool = get_pool()
    query = """
        SELECT
            st.from_track_id::text,
            st.to_track_id::text,
            st.occurrence_count as count,
            COALESCE(st.avg_bpm_difference, 0.0) as bpm_diff,
            COALESCE(st.avg_key_compatibility >= 0.5, true) as harmonic_compatible,
            st.transition_quality_score as quality_score,
            COALESCE(
                (SELECT array_agg(DISTINCT p->>'source')
                 FROM jsonb_array_elements(st.playlist_occurrences) p
                 WHERE p->>'source' IS NOT NULL),
                ARRAY[]::text[]
            ) as sources,
            COALESCE(t1.artist_name, t1_alt.artist_name) as from_artist,
            COALESCE(t1.track_title, t1_alt.track_title) as from_title,
            COALESCE(t2.artist_name, t2_alt.artist_name) as to_artist,
            COALESCE(t2.track_title, t2_alt.track_title) as to_title
        FROM silver_track_transitions st
        LEFT JOIN projection_tracks t1 ON t1.track_id = st.from_track_id
        LEFT JOIN projection_tracks t2 ON t2.track_id = st.to_track_id
        LEFT JOIN silver_enriched_tracks t1_alt ON t1_alt.id = st.from_track_id
        LEFT JOIN silver_enriched_tracks t2_alt ON t2_alt.id = st.to_track_id
        WHERE st.occurrence_count >= $1
        ORDER BY st.occurrence_count DESC, st.updated_at DESC
        LIMIT $2 OFFSET $3
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, min_count, limit, offset)

    items = []
    for r in rows:
        items.append({
            "from_track_id": r["from_track_id"],
            "to_track_id": r["to_track_id"],
            "from_artist": r["from_artist"],
            "from_title": r["from_title"],
            "to_artist": r["to_artist"],
            "to_title": r["to_title"],
            "count": int(r["count"]),
            "confidence": min(1.0, 0.5 + 0.1 * min(5, int(r["count"]))),
            "bpm_diff": float(r["bpm_diff"]) if r["bpm_diff"] is not None else None,
            "harmonic_compatible": bool(r["harmonic_compatible"]) if r["harmonic_compatible"] is not None else None,
            "quality_score": float(r["quality_score"]) if r["quality_score"] is not None else None,
            "sources": list(r["sources"]) if r["sources"] else []
        })

    return {
        "version": "1.0.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "transitions": items
    }


def register(app):
    app.include_router(router)
