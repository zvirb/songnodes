"""
Data Quality Review API

Endpoints for human-in-the-loop validation of low-confidence enrichment data.
Follows 2025 best practices for data quality management with confidence tiers.
"""

from typing import List, Optional, Literal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Import your database session dependency
# Adjust import based on your project structure
# from ..database import get_db_session

router = APIRouter(prefix="/api/data-quality", tags=["data-quality"])


class SetlistContext(BaseModel):
    """Context from the setlist where this track appears"""
    playlist_id: str
    playlist_name: str
    track_position: int
    total_tracks: int
    previous_tracks: List[dict] = Field(
        default_factory=list,
        description="2-3 tracks before this one"
    )
    next_tracks: List[dict] = Field(
        default_factory=list,
        description="2-3 tracks after this one"
    )
    dj_name: Optional[str] = None
    event_date: Optional[str] = None


class TrackReviewItem(BaseModel):
    """Track needing human review"""
    track_id: str
    title: str
    artist_name: Optional[str] = None

    # Original scraped data
    scraped_genre: Optional[str] = None
    scraped_artist: Optional[str] = None
    scraped_title: Optional[str] = None

    # Enrichment suggestions
    suggested_genre: Optional[str] = None
    suggested_artist: Optional[str] = None
    genre_confidence: Optional[Literal["high", "medium", "low"]] = None
    genre_match_score: Optional[float] = None

    # Metadata quality indicators
    has_spotify_id: bool = False
    has_musicbrainz_id: bool = False
    has_isrc: bool = False
    enrichment_sources: List[str] = Field(default_factory=list)

    # Setlist context (if available)
    setlist_contexts: List[SetlistContext] = Field(
        default_factory=list,
        description="All setlists where this track appears"
    )

    # Review metadata
    created_at: datetime
    last_scraped: Optional[datetime] = None
    review_count: int = 0
    last_reviewed_at: Optional[datetime] = None


class ApprovalRequest(BaseModel):
    """User approval/rejection of a suggestion"""
    track_id: str
    field: Literal["genre", "artist", "title"]
    action: Literal["approve", "reject", "skip"]
    approved_value: Optional[str] = Field(
        None,
        description="The value being approved (for audit trail)"
    )
    user_note: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional note from reviewer"
    )


class ReviewStats(BaseModel):
    """Statistics for data quality dashboard"""
    total_needs_review: int
    by_confidence: dict[str, int] = Field(
        default_factory=dict,
        description="Count by confidence level"
    )
    by_issue_type: dict[str, int] = Field(
        default_factory=dict,
        description="Count by issue type (missing_genre, low_confidence, etc.)"
    )
    reviewed_today: int = 0
    approved_today: int = 0
    rejected_today: int = 0


# @router.get("/tracks/needs-review", response_model=List[TrackReviewItem])
async def get_tracks_needing_review(
    confidence_level: Optional[Literal["high", "medium", "low"]] = Query(
        None,
        description="Filter by confidence level"
    ),
    issue_type: Optional[Literal["missing_genre", "low_confidence", "unknown_artist"]] = Query(
        None,
        description="Filter by issue type"
    ),
    limit: int = Query(50, ge=1, le=200, description="Max tracks to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    # db: AsyncSession = Depends(get_db_session)
):
    """
    Get tracks that need human review.

    Returns tracks with:
    - Low/medium confidence enrichment
    - Missing critical metadata
    - Conflicting data from multiple sources

    Includes setlist context to help reviewers make informed decisions.
    """

    # Build dynamic query based on filters
    where_clauses = []
    params = {"limit": limit, "offset": offset}

    # Base condition: tracks with confidence flags or suggestions
    base_condition = """
        (metadata->>'genre_confidence' IS NOT NULL
         OR metadata->>'genre_suggestion' IS NOT NULL
         OR (SELECT COUNT(*) FROM track_artists WHERE track_id = t.id) = 0)
    """
    where_clauses.append(base_condition)

    # Filter by confidence level
    if confidence_level:
        where_clauses.append("metadata->>'genre_confidence' = :confidence_level")
        params["confidence_level"] = confidence_level

    # Filter by issue type
    if issue_type == "missing_genre":
        where_clauses.append("genre IS NULL")
    elif issue_type == "low_confidence":
        where_clauses.append("metadata->>'genre_confidence' IN ('low', 'medium')")
    elif issue_type == "unknown_artist":
        where_clauses.append("(SELECT COUNT(*) FROM track_artists WHERE track_id = t.id) = 0")

    where_clause = " AND ".join(where_clauses)

    query = text(f"""
        WITH track_data AS (
            SELECT
                t.id as track_id,
                t.title,
                t.genre as scraped_genre,
                metadata->>'original_genre' as original_genre,
                metadata->>'genre_suggestion' as suggested_genre,
                metadata->>'genre_confidence' as genre_confidence,
                (metadata->>'genre_match_score')::float as genre_match_score,
                t.spotify_id,
                t.musicbrainz_id,
                t.isrc,
                metadata->'enrichment_sources' as enrichment_sources,
                t.created_at,
                t.updated_at as last_scraped,
                metadata->'review_metadata'->>'review_count' as review_count,
                (metadata->'review_metadata'->>'last_reviewed_at')::timestamp as last_reviewed_at
            FROM tracks t
            WHERE {where_clause}
            ORDER BY
                CASE
                    WHEN metadata->>'genre_confidence' = 'low' THEN 1
                    WHEN metadata->>'genre_confidence' = 'medium' THEN 2
                    WHEN metadata->>'genre_confidence' = 'high' THEN 3
                    ELSE 4
                END,
                t.created_at DESC
            LIMIT :limit OFFSET :offset
        ),
        artist_data AS (
            SELECT
                ta.track_id,
                STRING_AGG(a.name, ', ' ORDER BY ta.position) as artist_names
            FROM track_artists ta
            JOIN artists a ON ta.artist_id = a.artist_id
            GROUP BY ta.track_id
        ),
        setlist_data AS (
            SELECT
                pt.track_id,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'playlist_id', p.playlist_id::text,
                        'playlist_name', p.name,
                        'track_position', pt.position,
                        'total_tracks', p.tracklist_count,
                        'dj_name', p.dj_artist_id::text,
                        'event_date', p.event_date::text
                    )
                ) as setlists
            FROM playlist_tracks pt
            JOIN playlists p ON pt.playlist_id = p.playlist_id
            GROUP BY pt.track_id
        )
        SELECT
            td.*,
            ad.artist_names,
            sd.setlists
        FROM track_data td
        LEFT JOIN artist_data ad ON td.track_id = ad.track_id
        LEFT JOIN setlist_data sd ON td.track_id = sd.track_id
    """)

    # Execute query (uncomment when db session is available)
    # result = await db.execute(query, params)
    # rows = result.fetchall()

    # For now, return mock data structure
    return [
        {
            "track_id": "mock-track-id",
            "title": "Example Track",
            "artist_name": "Example Artist",
            "scraped_genre": "Deep House",
            "suggested_genre": "House",
            "genre_confidence": "medium",
            "genre_match_score": 85.0,
            "has_spotify_id": True,
            "has_musicbrainz_id": False,
            "has_isrc": True,
            "enrichment_sources": ["spotify", "musicbrainz"],
            "setlist_contexts": [],
            "created_at": datetime.now(),
            "review_count": 0
        }
    ]


# @router.get("/tracks/{track_id}/context", response_model=List[SetlistContext])
async def get_track_setlist_context(
    track_id: str,
    context_size: int = Query(3, ge=1, le=10, description="Tracks before/after")
    # db: AsyncSession = Depends(get_db_session)
):
    """
    Get setlist context for a track (surrounding tracks).

    Helps reviewers understand the musical context:
    - Genre consistency with surrounding tracks
    - BPM flow
    - Energy progression
    - Artist patterns in the DJ's style
    """

    query = text("""
        WITH track_playlists AS (
            SELECT
                pt.playlist_id,
                pt.position as target_position,
                p.name as playlist_name,
                p.tracklist_count,
                p.dj_artist_id,
                p.event_date
            FROM playlist_tracks pt
            JOIN playlists p ON pt.playlist_id = p.playlist_id
            WHERE pt.track_id = :track_id
        ),
        context_tracks AS (
            SELECT
                tp.playlist_id,
                tp.playlist_name,
                tp.target_position,
                tp.tracklist_count,
                tp.dj_artist_id,
                tp.event_date,
                pt.position,
                t.id as track_id,
                t.title,
                STRING_AGG(a.name, ', ') as artists,
                t.bpm,
                t.key,
                t.energy,
                t.genre,
                CASE
                    WHEN pt.position < tp.target_position THEN 'before'
                    WHEN pt.position > tp.target_position THEN 'after'
                    ELSE 'current'
                END as relative_position
            FROM track_playlists tp
            JOIN playlist_tracks pt ON tp.playlist_id = pt.playlist_id
            JOIN tracks t ON pt.track_id = t.id
            LEFT JOIN track_artists ta ON t.id = ta.track_id
            LEFT JOIN artists a ON ta.artist_id = a.artist_id
            WHERE ABS(pt.position - tp.target_position) <= :context_size
            GROUP BY tp.playlist_id, tp.playlist_name, tp.target_position,
                     tp.tracklist_count, tp.dj_artist_id, tp.event_date,
                     pt.position, t.id, t.title, t.bpm, t.key, t.energy, t.genre
            ORDER BY tp.playlist_id, pt.position
        )
        SELECT * FROM context_tracks
    """)

    # Mock response
    return []


# @router.post("/tracks/approve", status_code=200)
async def approve_suggestion(
    approval: ApprovalRequest,
    # db: AsyncSession = Depends(get_db_session)
):
    """
    Approve or reject an enrichment suggestion.

    Actions:
    - approve: Apply the suggestion and mark as human-verified
    - reject: Keep original value, mark suggestion as incorrect
    - skip: No action, track remains in review queue

    Updates:
    - Track metadata with approved value
    - Review audit trail
    - Confidence score (human verification = high confidence)
    """

    if approval.action == "approve":
        # Update track with approved value
        update_query = None

        if approval.field == "genre":
            update_query = text("""
                UPDATE tracks
                SET
                    genre = :approved_value,
                    metadata = JSONB_SET(
                        JSONB_SET(
                            COALESCE(metadata, '{}'::jsonb),
                            '{genre_confidence}',
                            '"human_verified"'
                        ),
                        '{review_metadata}',
                        JSONB_BUILD_OBJECT(
                            'last_reviewed_at', NOW(),
                            'reviewed_by', 'human',
                            'review_count', COALESCE((metadata->'review_metadata'->>'review_count')::int, 0) + 1,
                            'approved_value', :approved_value,
                            'user_note', :user_note
                        )
                    ),
                    updated_at = NOW()
                WHERE id = :track_id
            """)

        # Execute update
        # await db.execute(update_query, {
        #     "track_id": approval.track_id,
        #     "approved_value": approval.approved_value,
        #     "user_note": approval.user_note
        # })
        # await db.commit()

        return {
            "status": "approved",
            "track_id": approval.track_id,
            "field": approval.field,
            "value": approval.approved_value
        }

    elif approval.action == "reject":
        # Mark suggestion as rejected
        reject_query = text("""
            UPDATE tracks
            SET metadata = JSONB_SET(
                COALESCE(metadata, '{}'::jsonb),
                '{review_metadata}',
                JSONB_BUILD_OBJECT(
                    'last_reviewed_at', NOW(),
                    'reviewed_by', 'human',
                    'review_count', COALESCE((metadata->'review_metadata'->>'review_count')::int, 0) + 1,
                    'rejected_field', :field,
                    'rejected_value', :approved_value,
                    'user_note', :user_note,
                    'status', 'rejected'
                )
            ),
            updated_at = NOW()
            WHERE id = :track_id
        """)

        return {
            "status": "rejected",
            "track_id": approval.track_id,
            "field": approval.field
        }

    else:  # skip
        return {
            "status": "skipped",
            "track_id": approval.track_id
        }


# @router.get("/stats", response_model=ReviewStats)
async def get_review_stats(
    # db: AsyncSession = Depends(get_db_session)
):
    """
    Get statistics for data quality dashboard.

    Metrics:
    - Total tracks needing review
    - Breakdown by confidence level
    - Breakdown by issue type
    - Review activity (today/week/month)
    """

    stats_query = text("""
        WITH review_stats AS (
            SELECT
                COUNT(*) FILTER (
                    WHERE metadata->>'genre_confidence' IN ('low', 'medium')
                       OR metadata->>'genre_suggestion' IS NOT NULL
                ) as total_needs_review,
                COUNT(*) FILTER (WHERE metadata->>'genre_confidence' = 'low') as low_confidence,
                COUNT(*) FILTER (WHERE metadata->>'genre_confidence' = 'medium') as medium_confidence,
                COUNT(*) FILTER (WHERE metadata->>'genre_confidence' = 'high') as high_confidence,
                COUNT(*) FILTER (WHERE genre IS NULL) as missing_genre,
                COUNT(*) FILTER (
                    WHERE (SELECT COUNT(*) FROM track_artists WHERE track_id = tracks.id) = 0
                ) as unknown_artist,
                COUNT(*) FILTER (
                    WHERE (metadata->'review_metadata'->>'last_reviewed_at')::date = CURRENT_DATE
                ) as reviewed_today,
                COUNT(*) FILTER (
                    WHERE (metadata->'review_metadata'->>'last_reviewed_at')::date = CURRENT_DATE
                      AND metadata->'review_metadata'->>'status' = 'approved'
                ) as approved_today,
                COUNT(*) FILTER (
                    WHERE (metadata->'review_metadata'->>'last_reviewed_at')::date = CURRENT_DATE
                      AND metadata->'review_metadata'->>'status' = 'rejected'
                ) as rejected_today
            FROM tracks
        )
        SELECT * FROM review_stats
    """)

    # Mock response
    return {
        "total_needs_review": 1250,
        "by_confidence": {
            "low": 450,
            "medium": 600,
            "high": 200
        },
        "by_issue_type": {
            "missing_genre": 300,
            "low_confidence": 450,
            "unknown_artist": 500
        },
        "reviewed_today": 0,
        "approved_today": 0,
        "rejected_today": 0
    }
