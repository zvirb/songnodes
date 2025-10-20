"""REST API Service for SongNodes"""
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError
from typing import List, Optional, Dict, Any
import logging
import os
import sys
from datetime import datetime
import asyncpg
import json
from contextlib import asynccontextmanager
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

# Configure logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import secrets manager for unified credential management
try:
    sys.path.insert(0, '/app/common')
    from secrets_manager import get_database_url, validate_secrets
    logger.info("✅ Secrets manager imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import secrets_manager: {e}")
    logger.warning("Falling back to environment variables")

# Prometheus metrics
REQUEST_COUNT = Counter('api_requests_total', 'Total requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('api_request_duration_seconds', 'Request duration')
DB_POOL_CONNECTIONS = Gauge('db_pool_connections', 'Database pool connections', ['state'])
REDIS_MEMORY = Gauge('redis_memory_usage_bytes', 'Redis memory usage')

# Import comprehensive Pydantic models (copied from scrapers directory during Docker build)
try:
    from pydantic_models import (
        ArtistCreate, ArtistResponse, ArtistBase,
        TrackCreate, TrackResponse, TrackBase,
        SetlistCreate, SetlistResponse, SetlistBase,
        TrackArtistRelationship,
        TrackAdjacency,
        TrackSource,
        DataSource,
        HealthCheckResponse,
        ErrorResponse
    )
    logger.info("✅ Comprehensive Pydantic models imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import Pydantic models: {e}")
    logger.warning("Falling back to basic models - validation will be limited")
    # Define fallback models if import fails
    class ArtistBase(BaseModel):
        artist_name: str
        data_source: str = "unknown"
    class ArtistCreate(ArtistBase):
        pass
    class ArtistResponse(ArtistBase):
        artist_id: int
        created_at: datetime
    class TrackBase(BaseModel):
        track_name: str
        data_source: str = "unknown"
    class TrackCreate(TrackBase):
        pass
    class TrackResponse(TrackBase):
        song_id: int
        created_at: datetime
    class SetlistBase(BaseModel):
        setlist_name: str
        dj_artist_name: str
        data_source: str = "unknown"
    class SetlistCreate(SetlistBase):
        pass
    class SetlistResponse(SetlistBase):
        playlist_id: int
        created_at: datetime
    class HealthCheckResponse(BaseModel):
        status: str
        database_connected: bool
        services_available: Dict[str, Any]  # Can contain bools, dicts, strings
        timestamp: datetime = Field(default_factory=datetime.utcnow)
    class ErrorResponse(BaseModel):
        error: str
        detail: Optional[str] = None


class TrackPreviewResponse(BaseModel):
    """Response payload describing preview availability for a track."""
    track_id: str
    preview_url: Optional[str] = None
    source: Optional[str] = None
    expires_at: Optional[datetime] = None
    message: Optional[str] = None
    streaming_options: Dict[str, Optional[str]] = Field(default_factory=dict)


class TracklistImportTrack(BaseModel):
    """Model for a single track in a tracklist import request"""
    artist: str
    title: str
    track_number: Optional[int] = None


class TracklistImportRequest(BaseModel):
    """Request payload for importing a tracklist"""
    tracks: List[TracklistImportTrack]


class TracklistImportResponse(BaseModel):
    """Response payload for tracklist import operation"""
    created: int = 0
    updated: int = 0
    failed: int = 0
    total: int = 0
    details: List[Dict[str, Any]] = Field(default_factory=list)


# Database connection - use secrets_manager if available
try:
    DATABASE_URL = get_database_url(async_driver=True, use_connection_pool=True)
    # asyncpg doesn't accept SQLAlchemy-style DSN format (postgresql+asyncpg)
    # Strip the driver suffix for direct asyncpg usage
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    logger.info("✅ Using secrets_manager for database connection")
except NameError:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://musicdb_user:musicdb_secure_pass_2024@db-connection-pool:6432/musicdb")
    logger.warning("⚠️ Using fallback DATABASE_URL from environment")

db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage database connection pool lifecycle with 2025 best practices"""
    global db_pool
    try:
        # 2025 best practices: proper timeouts, connection validation, and limits
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=5,
            max_size=15,  # Reduced from 20 to prevent overflow
            command_timeout=30,  # 30 second query timeout
            # NOTE: server_settings removed - causes ProtocolViolationError with PgBouncer
            # Connection validation and health checks
            init=lambda conn: conn.set_type_codec('json', encoder=json.dumps, decoder=json.loads, schema='pg_catalog'),
            max_queries=50000,  # Recycle connections after 50k queries
            max_inactive_connection_lifetime=1800  # 30 minute max idle time
        )
        # Note: asyncpg does not support pool_recycle and pool_pre_ping directly
        # These are handled via max_queries and max_inactive_connection_lifetime above
        logger.info("Database connection pool created with enhanced 2025 configuration")
        yield
    finally:
        if db_pool:
            await db_pool.close()
            logger.info("Database connection pool closed")

app = FastAPI(
    title="SongNodes REST API",
    description="Main REST API for music data operations",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - configurable for security
# Allow both localhost and 127.0.0.1 for local development
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3006,http://127.0.0.1:3006').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
try:
    from routers import api_keys
    app.include_router(api_keys.router)
    logger.info("API Keys router registered successfully")
except Exception as e:
    logger.warning(f"Failed to load API Keys router: {str(e)}")
    logger.warning("API key management endpoints will not be available")

try:
    from routers import music_auth
    app.include_router(music_auth.router)
    logger.info("Music Authentication router registered successfully")
except Exception as e:
    logger.warning(f"Failed to load Music Authentication router: {str(e)}")
    logger.warning("Music service authentication endpoints will not be available")

try:
    from routers import youtube_api
    app.include_router(youtube_api.router)
    logger.info("YouTube API router registered successfully")
except Exception as e:
    logger.warning(f"Failed to load YouTube API router: {str(e)}")
    logger.warning("YouTube API endpoints will not be available")

try:
    from routers import tidal_playlists
    app.include_router(tidal_playlists.router)
    logger.info("Tidal Playlists router registered successfully")
except Exception as e:
    logger.warning(f"Failed to load Tidal Playlists router: {str(e)}")
    logger.warning("Tidal playlist management endpoints will not be available")

try:
    from routers import spotify_playlists
    app.include_router(spotify_playlists.router)
    logger.info("Spotify Playlists router registered successfully")
except Exception as e:
    logger.warning(f"Failed to load Spotify Playlists router: {str(e)}")
    logger.warning("Spotify playlist management endpoints will not be available")

try:
    from routers import pathfinder
    app.include_router(pathfinder.router)
    logger.info("Pathfinder router registered successfully")
except Exception as e:
    logger.warning(f"Failed to load Pathfinder router: {str(e)}")
    logger.warning("Pathfinding endpoints will not be available")

# =============================================================================
# Container-Aware Memory Monitoring
# =============================================================================

def get_container_memory_usage() -> float:
    """
    Get container memory usage percentage (cgroup-aware).

    Returns container memory usage if running in Docker, otherwise falls back
    to host memory usage. Fixes the health check anti-pattern where containers
    reported "unhealthy" based on host memory instead of their allocated limits.

    Returns:
        float: Memory usage as percentage (0-100)
    """
    from pathlib import Path

    try:
        # Try cgroup v2 first (newer Docker versions)
        memory_current = Path("/sys/fs/cgroup/memory.current")
        memory_max = Path("/sys/fs/cgroup/memory.max")

        if memory_current.exists() and memory_max.exists():
            current = int(memory_current.read_text().strip())
            limit = memory_max.read_text().strip()

            if limit != "max":
                return (current / int(limit)) * 100
    except (FileNotFoundError, ValueError, PermissionError):
        pass

    try:
        # Fall back to cgroup v1 (older Docker versions)
        usage_file = Path("/sys/fs/cgroup/memory/memory.usage_in_bytes")
        limit_file = Path("/sys/fs/cgroup/memory/memory.limit_in_bytes")

        if usage_file.exists() and limit_file.exists():
            current = int(usage_file.read_text().strip())
            limit = int(limit_file.read_text().strip())

            # Sanity check: limit shouldn't be absurdly high
            # (some systems report very large limits for "unlimited")
            if limit < (1024 ** 4):  # Less than 1TB = reasonable limit
                return (current / limit) * 100
    except (FileNotFoundError, ValueError, PermissionError):
        pass

    # Not in container or cgroup unavailable, fall back to host memory
    import psutil
    return psutil.virtual_memory().percent

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Health check endpoint with comprehensive resource monitoring per CLAUDE.md Section 5.3.4.

    Monitors:
    - Database pool usage (503 if > 80%)
    - System memory (503 if > 85%)
    - Database connectivity

    Returns comprehensive health status using Pydantic validation.
    Raises 503 Service Unavailable if resource thresholds exceeded.
    """
    try:
        # Check database pool usage
        if db_pool:
            try:
                pool_size = db_pool.get_size()
                pool_max = db_pool.get_max_size()
                pool_usage = pool_size / pool_max if pool_max > 0 else 0

                if pool_usage > 0.8:
                    raise HTTPException(
                        status_code=503,
                        detail=f"Database pool exhausted: {pool_usage:.1%} usage (threshold: 80%)"
                    )
            except AttributeError:
                # Pool doesn't have these methods, skip check
                pool_usage = 0
        else:
            pool_usage = 0

        # Check container memory (cgroup-aware)
        memory_percent = get_container_memory_usage()
        if memory_percent > 85:
            raise HTTPException(
                status_code=503,
                detail=f"Memory usage critical: {memory_percent:.1f}% (threshold: 85%)"
            )

        # Check database connectivity
        db_connected = False
        if db_pool:
            async with db_pool.acquire() as conn:
                result = await conn.fetchval("SELECT 1")
                db_connected = (result == 1)

        # All checks passed
        return HealthCheckResponse(
            status="healthy" if db_connected else "degraded",
            database_connected=db_connected,
            services_available={
                "database": db_connected,
                "api": True,
                "checks": {
                    "database_pool": {
                        "status": "ok",
                        "usage": pool_usage,
                        "threshold": 0.8
                    },
                    "memory": {
                        "status": "ok",
                        "usage": memory_percent,
                        "threshold": 85
                    }
                }
            }
        )
    except HTTPException:
        # Re-raise 503 errors
        raise
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthCheckResponse(
            status="unhealthy",
            database_connected=False,
            services_available={
                "database": False,
                "api": True,
                "error": str(e)
            }
        )

@app.get("/api/v1/artists", response_model=List[ArtistResponse])
async def get_artists(limit: int = 100, offset: int = 0):
    """
    Get list of artists with comprehensive validation.

    Uses Pydantic models to ensure data quality and type safety.
    """
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT artist_id::text as artist_id,
                   name as artist_name,
                   LOWER(TRIM(name)) as normalized_name,
                   aliases,
                   spotify_id,
                   NULL::varchar as apple_music_id,
                   NULL::varchar as youtube_channel_id,
                   NULL::varchar as soundcloud_id,
                   NULL::varchar as discogs_id,
                   musicbrainz_id,
                   genres as genre_preferences,
                   country,
                   false as is_verified,
                   0 as follower_count,
                   0 as monthly_listeners,
                   0 as popularity_score,
                   'spotify' as data_source,
                   created_at as scrape_timestamp,
                   created_at,
                   updated_at
            FROM artists
            ORDER BY name
            LIMIT $1 OFFSET $2
            """
            rows = await conn.fetch(query, limit, offset)

            artists = []
            for row in rows:
                try:
                    # Convert database row to Pydantic model
                    artist = ArtistResponse(**dict(row))
                    artists.append(artist)
                except ValidationError as ve:
                    logger.warning(f"Artist {row['artist_id']} failed validation: {ve}")
                    # Skip invalid artists
                    continue

            return artists

    except Exception as e:
        logger.error(f"Failed to fetch artists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# Dirty Artist Management - Data Quality
# =============================================================================

class DirtyArtistResponse(BaseModel):
    """Artist with formatting artifacts that needs cleaning"""
    artist_id: str
    current_name: str
    suggested_clean_name: str
    track_count: int
    has_conflict: bool = False
    pattern_type: str

class TrackWithoutArtistResponse(BaseModel):
    """Track missing primary artist attribution"""
    track_id: str
    title: str
    importance: float = 0.0
    setlist_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

class ArtistSearchResult(BaseModel):
    """Artist search result with match scoring"""
    artist_id: str
    name: str
    match_score: float = 1.0
    track_count: int = 0
    spotify_id: Optional[str] = None
    genres: Optional[List[str]] = None

class AssignArtistRequest(BaseModel):
    """Request to assign artist to track"""
    track_id: str
    artist_id: str
    role: str = "primary"

class RenameArtistRequest(BaseModel):
    """Request to rename an artist"""
    new_name: str

@app.get("/api/v1/artists/dirty", response_model=List[DirtyArtistResponse])
async def get_dirty_artists(limit: int = 50, offset: int = 0):
    """
    Get artists with formatting artifacts (dirty names).

    Returns artists that contain:
    - Timestamp prefixes: [40:54], [??:??]
    - Numeric brackets: [420], [69]
    - Special character prefixes: +, -, *
    """
    try:
        # Import the cleaning function from common module
        from common.artist_name_cleaner import clean_artist_name, has_formatting_artifacts

        async with db_pool.acquire() as conn:
            # Get dirty artists with track counts
            query = """
            SELECT
                a.artist_id::text as artist_id,
                a.name,
                COUNT(ta.track_id) as track_count
            FROM artists a
            LEFT JOIN track_artists ta ON a.artist_id = ta.artist_id
            WHERE a.name ~ '^\[' OR a.name ~ '^[+*-] '
            GROUP BY a.artist_id, a.name
            ORDER BY COUNT(ta.track_id) DESC, a.name
            LIMIT $1 OFFSET $2
            """

            rows = await conn.fetch(query, limit, offset)

            dirty_artists = []
            for row in rows:
                current_name = row['name']
                clean_name = clean_artist_name(current_name)

                # Determine pattern type
                if current_name.startswith('['):
                    if ':' in current_name[:10]:
                        pattern_type = "timestamp"
                    else:
                        pattern_type = "numeric_bracket"
                elif current_name.startswith('+'):
                    pattern_type = "plus_prefix"
                elif current_name.startswith('-'):
                    pattern_type = "dash_prefix"
                elif current_name.startswith('*'):
                    pattern_type = "asterisk_prefix"
                else:
                    pattern_type = "unknown"

                # Check if clean name conflicts with existing artist
                conflict_check = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM artists WHERE name = $1 AND artist_id != $2::uuid)",
                    clean_name, row['artist_id']
                )

                dirty_artists.append(DirtyArtistResponse(
                    artist_id=row['artist_id'],
                    current_name=current_name,
                    suggested_clean_name=clean_name,
                    track_count=row['track_count'],
                    has_conflict=conflict_check,
                    pattern_type=pattern_type
                ))

            logger.info(f"Found {len(dirty_artists)} dirty artists (limit={limit}, offset={offset})")
            return dirty_artists

    except Exception as e:
        logger.error(f"Failed to fetch dirty artists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/artists/{artist_id}/rename")
async def rename_artist(artist_id: str, request: RenameArtistRequest):
    """
    Rename an artist (for manual correction of dirty names).
    """
    try:
        new_name = request.new_name
        async with db_pool.acquire() as conn:
            # Check if new name conflicts with existing artist
            existing = await conn.fetchval(
                "SELECT artist_id FROM artists WHERE name = $1 AND artist_id != $2::uuid",
                new_name, artist_id
            )

            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"Artist '{new_name}' already exists. Use merge endpoint instead."
                )

            # Update artist name
            result = await conn.fetchrow(
                """
                UPDATE artists
                SET name = $1, updated_at = CURRENT_TIMESTAMP
                WHERE artist_id = $2::uuid
                RETURNING artist_id, name, updated_at
                """,
                new_name, artist_id
            )

            if not result:
                raise HTTPException(status_code=404, detail="Artist not found")

            logger.info(f"Renamed artist {artist_id} to '{new_name}'")
            return {
                "artist_id": str(result["artist_id"]),
                "name": result['name'],
                "updated_at": result['updated_at'].isoformat()
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to rename artist {artist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/artists/{duplicate_id}/merge")
async def merge_artist(duplicate_id: str, request: RenameArtistRequest):
    """
    Merge a duplicate artist into an existing artist with the target name.

    This endpoint:
    1. Finds the existing artist with the target name
    2. Moves all track relationships from duplicate to existing artist
    3. Deletes conflicting relationships (same track + same role)
    4. Deletes the duplicate artist

    Use this when a dirty artist name should be merged with an existing clean artist.
    """
    try:
        target_name = request.new_name
        async with db_pool.acquire() as conn:
            # Find the existing artist with target name
            existing_artist = await conn.fetchrow(
                "SELECT artist_id, name FROM artists WHERE name = $1",
                target_name
            )

            if not existing_artist:
                raise HTTPException(
                    status_code=404,
                    detail=f"Target artist '{target_name}' not found. Use rename endpoint instead."
                )

            target_id = existing_artist['artist_id']

            if str(target_id) == duplicate_id:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot merge artist with itself"
                )

            # Start transaction
            async with conn.transaction():
                # Delete conflicting track_artists (same track + same role)
                deleted_conflicts = await conn.fetchval(
                    """
                    DELETE FROM track_artists
                    WHERE artist_id = $1::uuid
                      AND EXISTS (
                          SELECT 1 FROM track_artists ta
                          WHERE ta.track_id = track_artists.track_id
                            AND ta.artist_id = $2::uuid
                            AND ta.role = track_artists.role
                      )
                    RETURNING COUNT(*)
                    """,
                    duplicate_id, target_id
                )

                # Move remaining track_artists to target artist
                moved_tracks = await conn.fetchval(
                    """
                    UPDATE track_artists
                    SET artist_id = $1::uuid
                    WHERE artist_id = $2::uuid
                    RETURNING COUNT(*)
                    """,
                    target_id, duplicate_id
                )

                # Delete the duplicate artist
                deleted_artist = await conn.fetchrow(
                    """
                    DELETE FROM artists
                    WHERE artist_id = $1::uuid
                    RETURNING artist_id, name
                    """,
                    duplicate_id
                )

                if not deleted_artist:
                    raise HTTPException(status_code=404, detail="Duplicate artist not found")

                logger.info(
                    f"Merged artist '{deleted_artist['name']}' ({duplicate_id}) into '{target_name}' ({target_id}): "
                    f"moved {moved_tracks or 0} tracks, deleted {deleted_conflicts or 0} conflicts"
                )

                return {
                    "merged_from": {
                        "artist_id": duplicate_id,
                        "name": deleted_artist['name']
                    },
                    "merged_into": {
                        "artist_id": str(target_id),
                        "name": target_name
                    },
                    "tracks_moved": moved_tracks or 0,
                    "conflicts_resolved": deleted_conflicts or 0
                }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to merge artist {duplicate_id} into '{target_name}': {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/artists/{artist_id}")
async def delete_artist(artist_id: str):
    """
    Delete an artist and all its track associations.

    This endpoint:
    1. Deletes all track_artists relationships for this artist
    2. Deletes the artist record

    Use this for artists that cannot be cleaned or merged (e.g., "[unknown]").
    """
    try:
        async with db_pool.acquire() as conn:
            # Start transaction
            async with conn.transaction():
                # Get artist info before deleting
                artist = await conn.fetchrow(
                    "SELECT artist_id, name FROM artists WHERE artist_id = $1::uuid",
                    artist_id
                )

                if not artist:
                    raise HTTPException(status_code=404, detail="Artist not found")

                # Delete all track_artists relationships
                deleted_tracks = await conn.fetchval(
                    """
                    DELETE FROM track_artists
                    WHERE artist_id = $1::uuid
                    RETURNING COUNT(*)
                    """,
                    artist_id
                )

                # Delete the artist
                await conn.execute(
                    "DELETE FROM artists WHERE artist_id = $1::uuid",
                    artist_id
                )

                logger.info(
                    f"Deleted artist '{artist['name']}' ({artist_id}) and {deleted_tracks or 0} track associations"
                )

                return {
                    "artist_id": artist_id,
                    "name": artist['name'],
                    "tracks_removed": deleted_tracks or 0
                }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete artist {artist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# Artist Attribution Manager Endpoints
# =============================================================================

@app.get("/api/v1/tracks/missing-artist", response_model=List[TrackWithoutArtistResponse])
async def get_tracks_without_artist(
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "importance"
):
    """
    Get tracks without primary artist attribution from Gold layer.

    These tracks block the enrichment pipeline and need manual artist assignment.
    Sorted by importance (setlist count) to prioritize high-value tracks.

    Args:
        limit: Maximum number of tracks to return
        offset: Number of tracks to skip for pagination
        sort_by: Sort order - 'importance' (setlist count) or 'alphabetical' (title)

    Returns:
        List of tracks missing primary artist attribution
    """
    try:
        async with db_pool.acquire() as conn:
            # Sort clause based on parameter
            if sort_by == "alphabetical":
                order_clause = "ORDER BY t.title"
            else:
                # Sort by creation date for importance (newer tracks first)
                order_clause = "ORDER BY t.created_at DESC, t.title"

            # Query tracks without primary artist from Gold layer
            # Note: Using creation date as importance metric since setlist_tracks table doesn't exist yet
            query = f"""
            SELECT
                t.id::text as track_id,
                t.title,
                0 as setlist_count,
                t.created_at,
                t.updated_at
            FROM tracks t
            LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.role = 'primary'
            WHERE ta.artist_id IS NULL
            {order_clause}
            LIMIT $1 OFFSET $2
            """

            rows = await conn.fetch(query, limit, offset)

            tracks = []
            for row in rows:
                tracks.append(TrackWithoutArtistResponse(
                    track_id=row['track_id'],
                    title=row['title'],
                    importance=float(row['setlist_count']),
                    setlist_count=row['setlist_count'],
                    created_at=row['created_at'],
                    updated_at=row['updated_at']
                ))

            logger.info(f"Found {len(tracks)} tracks without primary artist (limit={limit}, offset={offset}, sort={sort_by})")
            return tracks

    except Exception as e:
        logger.error(f"Failed to fetch tracks without artist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/artists/search", response_model=List[ArtistSearchResult])
async def search_artists(query: str, limit: int = 20):
    """
    Search artists by name with fuzzy matching.

    Uses PostgreSQL ILIKE for pattern matching, returning results sorted by
    match quality (exact matches first, then partial matches).

    Args:
        query: Artist name search query
        limit: Maximum number of results to return

    Returns:
        List of matching artists with track counts
    """
    try:
        async with db_pool.acquire() as conn:
            # Fuzzy search with ILIKE pattern matching
            search_query = """
            SELECT
                a.artist_id::text as artist_id,
                a.name,
                a.spotify_id,
                a.genres,
                COUNT(DISTINCT ta.track_id) as track_count,
                CASE
                    WHEN LOWER(a.name) = LOWER($1) THEN 1.0
                    WHEN LOWER(a.name) LIKE LOWER($1 || '%') THEN 0.9
                    WHEN LOWER(a.name) LIKE LOWER('%' || $1 || '%') THEN 0.7
                    ELSE 0.5
                END as match_score
            FROM artists a
            LEFT JOIN track_artists ta ON a.artist_id = ta.artist_id
            WHERE a.name ILIKE $2
            GROUP BY a.artist_id, a.name, a.spotify_id, a.genres
            ORDER BY match_score DESC, track_count DESC, a.name
            LIMIT $3
            """

            search_pattern = f"%{query}%"
            rows = await conn.fetch(search_query, query, search_pattern, limit)

            results = []
            for row in rows:
                results.append(ArtistSearchResult(
                    artist_id=row['artist_id'],
                    name=row['name'],
                    match_score=float(row['match_score']),
                    track_count=row['track_count'],
                    spotify_id=row['spotify_id'],
                    genres=row['genres'] if row['genres'] else None
                ))

            logger.info(f"Artist search for '{query}' returned {len(results)} results")
            return results

    except Exception as e:
        logger.error(f"Failed to search artists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/tracks/{track_id}/assign-artist")
async def assign_artist_to_track(track_id: str, request: AssignArtistRequest):
    """
    Assign an artist to a track via the track_artists junction table.

    Creates a primary artist relationship for the track. If the track already
    has a primary artist, this will fail with a 409 conflict.

    Args:
        track_id: Track ID (UUID format)
        request: Artist assignment details (artist_id, role)

    Returns:
        Success status and created relationship details
    """
    try:
        async with db_pool.acquire() as conn:
            # Verify track exists
            track_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM tracks WHERE id = $1::uuid)",
                track_id
            )
            if not track_exists:
                raise HTTPException(status_code=404, detail=f"Track '{track_id}' not found")

            # Verify artist exists
            artist_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM artists WHERE artist_id = $1::uuid)",
                request.artist_id
            )
            if not artist_exists:
                raise HTTPException(status_code=404, detail=f"Artist '{request.artist_id}' not found")

            # Check if primary artist already assigned
            if request.role == "primary":
                existing_primary = await conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM track_artists
                        WHERE track_id = $1::uuid AND role = 'primary'
                    )
                    """,
                    track_id
                )
                if existing_primary:
                    raise HTTPException(
                        status_code=409,
                        detail="Track already has a primary artist. Remove existing attribution first."
                    )

            # Insert track_artists relationship
            result = await conn.fetchrow(
                """
                INSERT INTO track_artists (track_id, artist_id, role, position)
                VALUES ($1::uuid, $2::uuid, $3, 0)
                ON CONFLICT (track_id, artist_id, role) DO NOTHING
                RETURNING track_id, artist_id, role, position, created_at
                """,
                track_id, request.artist_id, request.role
            )

            if not result:
                raise HTTPException(
                    status_code=409,
                    detail="Artist already assigned to this track with this role"
                )

            logger.info(f"✅ Assigned artist {request.artist_id} to track {track_id} (role={request.role})")

            return {
                "success": True,
                "track_id": str(result['track_id']),
                "artist_id": str(result['artist_id']),
                "role": result['role'],
                "position": result['position'],
                "created_at": result['created_at'].isoformat()
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to assign artist to track {track_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/artists/{artist_id}", response_model=ArtistResponse)
async def get_artist(artist_id: str):
    """
    Get specific artist by ID with validation.

    Returns comprehensive artist data validated by Pydantic.
    """
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT artist_id::text as artist_id,
                   name as artist_name,
                   LOWER(TRIM(name)) as normalized_name,
                   aliases,
                   spotify_id,
                   NULL::varchar as apple_music_id,
                   NULL::varchar as youtube_channel_id,
                   NULL::varchar as soundcloud_id,
                   NULL::varchar as discogs_id,
                   musicbrainz_id,
                   genres as genre_preferences,
                   country,
                   false as is_verified,
                   0 as follower_count,
                   0 as monthly_listeners,
                   0 as popularity_score,
                   'spotify' as data_source,
                   created_at as scrape_timestamp,
                   created_at,
                   updated_at
            FROM artists
            WHERE artist_id = $1::uuid
            """
            row = await conn.fetchrow(query, artist_id)

            if not row:
                raise HTTPException(status_code=404, detail="Artist not found")

            try:
                artist = ArtistResponse(**dict(row))
                return artist
            except ValidationError as ve:
                logger.error(f"Artist {artist_id} validation failed: {ve}")
                raise HTTPException(status_code=500, detail="Artist data validation failed")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch artist {artist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/artists", response_model=ArtistResponse, status_code=201)
async def create_artist(artist: ArtistCreate):
    """
    Create new artist with comprehensive validation.

    Pydantic automatically validates:
    - No generic artist names (e.g., "Various Artists")
    - Valid ISO country codes
    - Popularity score 0-100 range
    - Required fields present
    """
    try:
        async with db_pool.acquire() as conn:
            query = """
            INSERT INTO artists (
                name, normalized_name, aliases,
                spotify_id, apple_music_id, youtube_music_id,
                musicbrainz_id, beatport_id, deezer_id, tidal_id,
                genres, country, is_verified, popularity_score
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
            RETURNING artist_id, created_at, updated_at
            """

            row = await conn.fetchrow(
                query,
                artist.artist_name, artist.normalized_name, artist.aliases,
                artist.spotify_id, artist.apple_music_id,
                getattr(artist, 'youtube_music_id', None),  # Use youtube_music_id instead of youtube_channel_id
                artist.musicbrainz_id,
                getattr(artist, 'beatport_id', None),
                getattr(artist, 'deezer_id', None),
                getattr(artist, 'tidal_id', None),
                artist.genre_preferences if hasattr(artist, 'genre_preferences') else [],  # Map to genres column
                artist.country, artist.is_verified, artist.popularity_score
            )

            # Return created artist with database-generated fields
            created_artist = ArtistResponse(
                **artist.dict(),
                artist_id=row['artist_id'],
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )

            logger.info(f"✅ Created artist: {artist.artist_name} (ID: {row['artist_id']})")
            return created_artist

    except ValidationError as ve:
        logger.error(f"Artist validation failed: {ve}")
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to create artist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/tracks", response_model=List[TrackResponse])
async def get_tracks(
    artist_id: Optional[int] = None,
    min_bpm: Optional[float] = None,
    max_bpm: Optional[float] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Get list of tracks from Gold layer with comprehensive validation and filtering.

    Uses Gold medallion layer (tracks + artists + track_artists) for normalized,
    high-quality data with proper artist attribution.
    """
    try:
        async with db_pool.acquire() as conn:
            # Build dynamic query based on filters
            conditions = []
            params = []
            param_num = 1

            if artist_id:
                conditions.append(f"ta.artist_id = ${param_num}::uuid")
                params.append(artist_id)
                param_num += 1

            if min_bpm:
                conditions.append(f"t.bpm >= ${param_num}")
                params.append(min_bpm)
                param_num += 1

            if max_bpm:
                conditions.append(f"t.bpm <= ${param_num}")
                params.append(max_bpm)
                param_num += 1

            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            # Query Gold layer with proper artist joins
            query = f"""
            SELECT DISTINCT ON (t.id)
                   t.id::text as song_id, t.id::text as track_id, t.title as track_name,
                   t.normalized_title, t.duration_ms,
                   t.isrc, t.spotify_id, t.apple_music_id, t.youtube_music_id as youtube_id,
                   t.soundcloud_id, t.musicbrainz_id,
                   t.bpm, t.key as musical_key, t.energy, t.danceability, t.valence,
                   t.acousticness, t.instrumentalness, t.liveness,
                   t.speechiness, t.loudness,
                   EXTRACT(YEAR FROM t.release_date)::int as release_date,
                   t.genre, NULL as subgenre, NULL as record_label,
                   false as is_remix, false as is_mashup, false as is_live, false as is_cover,
                   false as is_instrumental, false as is_explicit,
                   NULL as remix_type, NULL as original_artist, NULL as remixer, NULL as mashup_components,
                   NULL::integer as popularity_score, NULL::integer as play_count, NULL as track_type,
                   NULL as source_context, NULL::integer as position_in_source,
                   'gold' as data_source, t.created_at as scrape_timestamp,
                   ta.artist_id::text as primary_artist_id, t.created_at, t.updated_at
            FROM tracks t
            LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.role = 'primary' AND ta.position = 0
            {where_clause}
            ORDER BY t.id, ta.position
            LIMIT ${param_num} OFFSET ${param_num + 1}
            """
            params.extend([limit, offset])

            rows = await conn.fetch(query, *params)

            tracks = []
            for row in rows:
                try:
                    track = TrackResponse(**dict(row))
                    tracks.append(track)
                except ValidationError as ve:
                    logger.warning(f"Track {row['song_id']} failed validation: {ve}")
                    continue

            return tracks

    except Exception as e:
        logger.error(f"Failed to fetch tracks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/tracks", response_model=TrackResponse, status_code=201)
async def create_track(track: TrackCreate):
    """
    Create new track with comprehensive validation.

    Pydantic automatically validates:
    - Track ID format (16-char hexadecimal)
    - BPM range (60-200)
    - Energy, danceability (0.0-1.0)
    - No generic track names
    - Remix consistency (is_remix=True requires remix_type)
    """
    try:
        async with db_pool.acquire() as conn:
            query = """
            INSERT INTO songs (
                track_id, track_name, normalized_title, duration_ms,
                isrc, spotify_id, apple_music_id, youtube_id, soundcloud_id, musicbrainz_id,
                bpm, musical_key, energy, danceability, valence, acousticness,
                instrumentalness, liveness, speechiness, loudness,
                release_date, genre, subgenre, record_label,
                is_remix, is_mashup, is_live, is_cover, is_instrumental, is_explicit,
                remix_type, original_artist, remixer, mashup_components,
                popularity_score, play_count, track_type, source_context, position_in_source,
                data_source, scrape_timestamp
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
                $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41
            )
            RETURNING song_id, created_at, updated_at
            """

            row = await conn.fetchrow(
                query,
                track.track_id, track.track_name, track.normalized_title, track.duration_ms,
                track.isrc, track.spotify_id, track.apple_music_id, track.youtube_id,
                track.soundcloud_id, track.musicbrainz_id, track.bpm, track.musical_key,
                track.energy, track.danceability, track.valence, track.acousticness,
                track.instrumentalness, track.liveness, track.speechiness, track.loudness,
                track.release_date, track.genre, track.subgenre, track.record_label,
                track.is_remix, track.is_mashup, track.is_live, track.is_cover,
                track.is_instrumental, track.is_explicit, track.remix_type,
                track.original_artist, track.remixer, track.mashup_components,
                track.popularity_score, track.play_count, track.track_type,
                track.source_context, track.position_in_source,
                track.data_source.value, track.scrape_timestamp
            )

            created_track = TrackResponse(
                **track.dict(),
                song_id=row['song_id'],
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )

            logger.info(f"✅ Created track: {track.track_name} (ID: {row['song_id']})")
            return created_track

    except ValidationError as ve:
        logger.error(f"Track validation failed: {ve}")
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as e:
        logger.error(f"Failed to create track: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/tracks/import-tracklist", response_model=TracklistImportResponse)
async def import_tracklist(request: TracklistImportRequest):
    """
    Import a tracklist from user-provided data.

    Creates new tracks or updates existing ones based on artist + title matching.
    Automatically creates artist records and track-artist relationships.

    Returns statistics on created, updated, and failed imports.
    """
    import hashlib

    stats = {
        "created": 0,
        "updated": 0,
        "failed": 0,
        "total": len(request.tracks),
        "details": [],
        "transitions_created": 0
    }

    # Track previous song_id for creating transitions
    prev_song_id = None
    imported_song_ids = []

    try:
        async with db_pool.acquire() as conn:
            for track_data in request.tracks:
                try:
                    # Generate stable track_id from artist + title hash
                    content = f"{track_data.artist.lower().strip()}:{track_data.title.lower().strip()}"
                    track_id = hashlib.md5(content.encode()).hexdigest()[:16]

                    # Normalize title for search
                    normalized_title = track_data.title.lower().strip()

                    # 1. Upsert artist
                    artist_query = """
                    INSERT INTO artists (name, normalized_name)
                    VALUES ($1, $2)
                    ON CONFLICT (normalized_name)
                    DO UPDATE SET name = EXCLUDED.name
                    RETURNING artist_id
                    """
                    artist_row = await conn.fetchrow(
                        artist_query,
                        track_data.artist.strip(),
                        track_data.artist.lower().strip()
                    )
                    artist_id = artist_row['artist_id']

                    # 2. Check if track exists (by matching normalized title + artist)
                    existing_track_query = """
                    SELECT t.id
                    FROM tracks t
                    JOIN track_artists ta ON ta.track_id = t.id
                    WHERE t.normalized_title = $1 AND ta.artist_id = $2
                    LIMIT 1
                    """
                    existing = await conn.fetchrow(
                        existing_track_query,
                        normalized_title,
                        artist_id
                    )

                    if existing:
                        # Track exists - update title if needed
                        track_id_uuid = existing['id']
                        update_query = """
                        UPDATE tracks
                        SET title = $1,
                            updated_at = NOW()
                        WHERE id = $2
                        """
                        await conn.execute(
                            update_query,
                            track_data.title.strip(),
                            track_id_uuid
                        )
                        stats["updated"] += 1
                        stats["details"].append({
                            "artist": track_data.artist,
                            "title": track_data.title,
                            "status": "updated",
                            "track_id": str(track_id_uuid)
                        })
                    else:
                        # Track doesn't exist - create it
                        insert_query = """
                        INSERT INTO tracks (
                            title, normalized_title
                        ) VALUES ($1, $2)
                        RETURNING id
                        """
                        new_track = await conn.fetchrow(
                            insert_query,
                            track_data.title.strip(),
                            normalized_title
                        )
                        track_id_uuid = new_track['id']
                        stats["created"] += 1
                        stats["details"].append({
                            "artist": track_data.artist,
                            "title": track_data.title,
                            "status": "created",
                            "track_id": str(track_id_uuid)
                        })

                    # 3. Ensure track_artists relationship exists
                    relationship_query = """
                    INSERT INTO track_artists (track_id, artist_id, role)
                    VALUES ($1, $2, 'primary')
                    ON CONFLICT (track_id, artist_id, role) DO NOTHING
                    """
                    await conn.execute(relationship_query, track_id_uuid, artist_id)

                    # 4. Create transition edge if this is not the first track
                    if prev_song_id is not None:
                        try:
                            # Use song_adjacency (requires song_id_1 < song_id_2)
                            # Sort the IDs to meet the constraint
                            if prev_song_id < track_id_uuid:
                                sid_1, sid_2 = prev_song_id, track_id_uuid
                            else:
                                sid_1, sid_2 = track_id_uuid, prev_song_id

                            transition_query = """
                            INSERT INTO song_adjacency (song_id_1, song_id_2, occurrence_count)
                            VALUES ($1, $2, 1)
                            ON CONFLICT (song_id_1, song_id_2)
                            DO UPDATE SET occurrence_count = song_adjacency.occurrence_count + 1
                            """
                            await conn.execute(transition_query, sid_1, sid_2)
                            stats["transitions_created"] += 1
                            logger.info(f"🔗 Created transition: {prev_song_id} → {track_id_uuid}")
                        except Exception as trans_error:
                            logger.warning(f"⚠️  Failed to create transition: {trans_error}")

                    # Track this track for next iteration
                    imported_song_ids.append(track_id_uuid)
                    prev_song_id = track_id_uuid

                    logger.info(f"✅ Imported: {track_data.artist} - {track_data.title} (track_id: {track_id_uuid})")

                except Exception as track_error:
                    logger.error(f"❌ Failed to import {track_data.artist} - {track_data.title}: {track_error}")
                    stats["failed"] += 1
                    stats["details"].append({
                        "artist": track_data.artist,
                        "title": track_data.title,
                        "status": "failed",
                        "error": str(track_error)
                    })

        logger.info(f"📊 Tracklist import complete: {stats['created']} created, {stats['updated']} updated, {stats['failed']} failed")
        return TracklistImportResponse(**stats)

    except Exception as e:
        logger.error(f"Failed to import tracklist: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")


@app.get("/api/search/tracks", response_model=List[TrackResponse])
async def search_tracks(
    query: str,
    limit: int = 20,
    offset: int = 0
):
    """
    Search tracks by name or artist with fuzzy matching (Gold layer).

    Uses PostgreSQL's ILIKE for pattern matching against Gold layer tracks
    with proper artist attribution via track_artists junction table.
    Results ordered by relevance (exact matches first).
    """
    try:
        async with db_pool.acquire() as conn:
            # Search Gold layer with artist joins
            search_query = """
            SELECT DISTINCT ON (t.id)
                   t.id::text as song_id, t.id::text as track_id, t.title as track_name,
                   t.normalized_title, t.duration_ms,
                   t.isrc, t.spotify_id, t.apple_music_id, t.youtube_music_id as youtube_id,
                   t.soundcloud_id, t.musicbrainz_id,
                   t.bpm, t.key as musical_key, t.energy, t.danceability, t.valence,
                   t.acousticness, t.instrumentalness, t.liveness,
                   t.speechiness, t.loudness,
                   EXTRACT(YEAR FROM t.release_date)::int as release_date,
                   t.genre, NULL as subgenre, NULL as record_label,
                   false as is_remix, false as is_mashup, false as is_live, false as is_cover,
                   false as is_instrumental, false as is_explicit,
                   NULL as remix_type, NULL as original_artist, NULL as remixer, NULL as mashup_components,
                   NULL::integer as popularity_score, NULL::integer as play_count, NULL as track_type,
                   NULL as source_context, NULL::integer as position_in_source,
                   'gold' as data_source, t.created_at as scrape_timestamp,
                   ta.artist_id::text as primary_artist_id, t.created_at, t.updated_at
            FROM tracks t
            LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.role = 'primary' AND ta.position = 0
            LEFT JOIN artists a ON ta.artist_id = a.artist_id
            WHERE t.title ILIKE $1 OR t.normalized_title ILIKE $1 OR a.name ILIKE $1
            ORDER BY t.id,
                CASE
                    WHEN t.title ILIKE $2 THEN 1
                    WHEN t.title ILIKE $1 THEN 2
                    WHEN a.name ILIKE $1 THEN 3
                    ELSE 4
                END
            LIMIT $3 OFFSET $4
            """

            search_pattern = f"%{query}%"
            exact_pattern = query
            rows = await conn.fetch(search_query, search_pattern, exact_pattern, limit, offset)

            tracks = []
            for row in rows:
                try:
                    track = TrackResponse(**dict(row))
                    tracks.append(track)
                except ValidationError as ve:
                    logger.warning(f"Track {row['song_id']} failed validation: {ve}")
                    continue

            logger.info(f"Gold layer search for '{query}' returned {len(tracks)} tracks")
            return tracks

    except Exception as e:
        logger.error(f"Failed to search tracks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tracks/{track_id}", response_model=TrackResponse)
async def get_track_by_id(track_id: str):
    """
    Get a single track by its ID from Gold layer.

    Returns track with proper artist attribution from normalized Gold tables.
    """
    try:
        async with db_pool.acquire() as conn:
            # Query Gold layer with artist joins
            query = """
            SELECT t.id::text as song_id, t.id::text as track_id, t.title as track_name,
                   t.normalized_title, t.duration_ms,
                   t.isrc, t.spotify_id, t.apple_music_id, t.youtube_music_id as youtube_id,
                   t.soundcloud_id, t.musicbrainz_id,
                   t.bpm, t.key as musical_key, t.energy, t.danceability, t.valence,
                   t.acousticness, t.instrumentalness, t.liveness,
                   t.speechiness, t.loudness,
                   EXTRACT(YEAR FROM t.release_date)::int as release_date,
                   t.genre, NULL as subgenre, NULL as record_label,
                   false as is_remix, false as is_mashup, false as is_live, false as is_cover,
                   false as is_instrumental, false as is_explicit,
                   NULL as remix_type, NULL as original_artist, NULL as remixer, NULL as mashup_components,
                   NULL::integer as popularity_score, NULL::integer as play_count, NULL as track_type,
                   NULL as source_context, NULL::integer as position_in_source,
                   'gold' as data_source, t.created_at as scrape_timestamp,
                   ta.artist_id::text as primary_artist_id, t.created_at, t.updated_at
            FROM tracks t
            LEFT JOIN track_artists ta ON t.id = ta.track_id AND ta.role = 'primary' AND ta.position = 0
            WHERE t.id::text = $1
            LIMIT 1
            """

            row = await conn.fetchrow(query, track_id)

            if not row:
                raise HTTPException(status_code=404, detail=f"Track with ID '{track_id}' not found in Gold layer")

            try:
                track = TrackResponse(**dict(row))
                return track
            except ValidationError as ve:
                logger.error(f"Track {track_id} failed validation: {ve}")
                raise HTTPException(status_code=500, detail="Track data validation failed")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch track {track_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class TrackUpdateRequest(BaseModel):
    """Request model for manual track metadata updates"""
    artist_name: Optional[str] = None
    track_title: Optional[str] = None
    bpm: Optional[float] = None
    key: Optional[str] = None
    genre: Optional[str] = None

@app.patch("/api/tracks/{track_id}")
async def update_track_metadata(track_id: str, update_data: TrackUpdateRequest):
    """
    Update track metadata in Silver layer for manual corrections.

    Allows users to manually correct artist attribution, track title, and audio features
    when automated extraction/enrichment produces incorrect results.

    Updates are applied to silver_enriched_tracks (Silver layer), not Gold layer.
    Gold layer remains read-only and reflects the canonical, fully-enriched state.

    Args:
        track_id: Track ID (with or without 'song_' prefix)
        update_data: Fields to update (at least one required)

    Returns:
        Updated track metadata
    """
    try:
        # Validate at least one field is being updated
        if not any([update_data.artist_name, update_data.track_title,
                   update_data.bpm, update_data.key, update_data.genre]):
            raise HTTPException(
                status_code=400,
                detail="At least one field must be updated"
            )

        # Strip 'song_' prefix if present for database query
        normalized_id = track_id.replace('song_', '')

        async with db_pool.acquire() as conn:
            # Build dynamic UPDATE query
            set_clauses = []
            params = []
            param_num = 1

            if update_data.artist_name is not None:
                set_clauses.append(f"artist_name = ${param_num}")
                params.append(update_data.artist_name)
                param_num += 1

            if update_data.track_title is not None:
                set_clauses.append(f"track_title = ${param_num}")
                params.append(update_data.track_title)
                param_num += 1

            if update_data.bpm is not None:
                set_clauses.append(f"bpm = ${param_num}")
                params.append(update_data.bpm)
                param_num += 1

            if update_data.key is not None:
                set_clauses.append(f"key = ${param_num}")
                params.append(update_data.key)
                param_num += 1

            if update_data.genre is not None:
                set_clauses.append(f"genre = ${param_num}")
                params.append(update_data.genre)
                param_num += 1

            # Add updated_at timestamp
            set_clauses.append("updated_at = NOW()")

            # Execute update on Silver layer
            query = f"""
            UPDATE silver_enriched_tracks
            SET {', '.join(set_clauses)}
            WHERE id::text = ${param_num}
            RETURNING id, track_title, artist_name, bpm, key, genre, updated_at
            """
            params.append(normalized_id)

            row = await conn.fetchrow(query, *params)

            if not row:
                raise HTTPException(
                    status_code=404,
                    detail=f"Track '{track_id}' not found in Silver layer"
                )

            logger.info(f"✅ Updated track {track_id}: artist='{row['artist_name']}', title='{row['track_title']}'")

            return {
                "track_id": f"song_{row['id']}",
                "artist_name": row['artist_name'],
                "track_title": row['track_title'],
                "bpm": float(row['bpm']) if row['bpm'] is not None else None,
                "key": row['key'],
                "genre": row['genre'],
                "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update track {track_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/tracks/{track_id}/preview", response_model=TrackPreviewResponse)
async def get_track_preview(track_id: str):
    """Return preview metadata for a track from Gold layer, falling back to streaming IDs when audio isn't stored."""

    if not db_pool:
        raise HTTPException(status_code=503, detail="Database connection not ready")

    normalized_id = track_id
    if track_id.startswith('song_'):
        normalized_id = track_id[len('song_'):]

    try:
        async with db_pool.acquire() as conn:
            # Query Gold layer for preview data
            query = """
            SELECT
                t.id::text AS song_id,
                t.id::text as track_id,
                t.title,
                NULL as preview_url,
                t.spotify_id,
                t.tidal_id,
                t.apple_music_id,
                t.updated_at
            FROM tracks t
            WHERE t.id::text = $1 OR t.spotify_id = $1
            LIMIT 1
            """

            row = await conn.fetchrow(query, normalized_id)

            if not row:
                raise HTTPException(status_code=404, detail=f"Track '{track_id}' not found in Gold layer")

            preview_url = row['preview_url']
            source = 'stored' if preview_url else None

            message: Optional[str] = None
            if not preview_url:
                message = (
                    "No cached preview available. Use the streaming IDs to request a 30s clip "
                    "from Spotify or Tidal, or trigger re-enrichment via metadata services."
                )

            return TrackPreviewResponse(
                track_id=row['song_id'],
                preview_url=preview_url,
                source=source,
                expires_at=None,
                message=message,
                streaming_options={
                    'spotify_id': row['spotify_id'],
                    'tidal_id': row['tidal_id'],
                    'apple_music_id': row['apple_music_id'],
                }
            )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to fetch preview for track {track_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch track preview")

@app.get("/api/v1/setlists", response_model=List[SetlistResponse])
async def get_setlists(dj_id: Optional[int] = None, limit: int = 100, offset: int = 0):
    """
    Get list of DJ setlists/playlists with comprehensive validation.

    Supports filtering by DJ. All setlists validated by Pydantic.
    """
    try:
        async with db_pool.acquire() as conn:
            where_clause = "WHERE dj_artist_id = $3" if dj_id else ""
            params = [limit, offset]
            if dj_id:
                params.append(dj_id)

            query = f"""
            SELECT
                p.playlist_id,
                p.name as setlist_name,
                NULL as normalized_name,
                NULL as description,
                COALESCE(a.name, 'Unknown DJ') as dj_artist_name,
                p.dj_artist_id::text as dj_artist_id,
                NULL::text[] as supporting_artists,
                p.event_name,
                NULL as event_type,
                NULL as venue_name,
                NULL as venue_location,
                NULL::integer as venue_capacity,
                p.event_date as set_date,
                NULL::timestamp as set_start_time,
                NULL::timestamp as set_end_time,
                p.duration_minutes,
                NULL::text[] as genre_tags,
                NULL::text[] as mood_tags,
                NULL::jsonb as bpm_range,
                p.tracklist_count as total_tracks,
                NULL as spotify_playlist_id,
                NULL as soundcloud_playlist_id,
                NULL as mixcloud_id,
                NULL as youtube_playlist_id,
                p.source as data_source,
                COALESCE(p.last_scrape_attempt, p.created_at) as scrape_timestamp,
                p.created_at,
                p.updated_at
            FROM playlists p
            LEFT JOIN artists a ON p.dj_artist_id = a.artist_id
            {where_clause}
            ORDER BY p.event_date DESC NULLS LAST, p.name
            LIMIT $1 OFFSET $2
            """

            rows = await conn.fetch(query, *params)

            setlists = []
            for row in rows:
                try:
                    setlist = SetlistResponse(**dict(row))
                    setlists.append(setlist)
                except ValidationError as ve:
                    logger.warning(f"Setlist {row['playlist_id']} failed validation: {ve}")
                    continue

            return setlists

    except Exception as e:
        logger.error(f"Failed to fetch setlists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/playlists", response_model=List[SetlistResponse])
async def get_playlists(
    source: Optional[str] = Query(None, description="Filter by source (mixesdb, 1001tracklists, etc)"),
    dj_id: Optional[str] = Query(None, description="Filter by DJ artist ID"),
    limit: int = Query(100, ge=1, le=500, description="Max playlists to return"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """
    Get playlists (DJ setlists/mixes) with filtering options.

    Alias endpoint for /api/v1/setlists - queries the same playlists table.
    Supports filtering by source platform and DJ artist.
    """
    try:
        async with db_pool.acquire() as conn:
            where_clauses = []
            params = [limit, offset]
            param_idx = 3

            if source:
                where_clauses.append(f"p.source = ${param_idx}")
                params.append(source)
                param_idx += 1

            if dj_id:
                where_clauses.append(f"p.dj_artist_id = ${param_idx}::uuid")
                params.append(dj_id)
                param_idx += 1

            where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

            query = f"""
            SELECT
                p.playlist_id,
                p.name as setlist_name,
                NULL as normalized_name,
                NULL as description,
                COALESCE(a.name, 'Unknown DJ') as dj_artist_name,
                p.dj_artist_id::text as dj_artist_id,
                NULL::text[] as supporting_artists,
                p.event_name,
                NULL as event_type,
                NULL as venue_name,
                NULL as venue_location,
                NULL::integer as venue_capacity,
                p.event_date as set_date,
                NULL::timestamp as set_start_time,
                NULL::timestamp as set_end_time,
                p.duration_minutes,
                NULL::text[] as genre_tags,
                NULL::text[] as mood_tags,
                NULL::jsonb as bpm_range,
                p.tracklist_count as total_tracks,
                NULL as spotify_playlist_id,
                NULL as soundcloud_playlist_id,
                NULL as mixcloud_id,
                NULL as youtube_playlist_id,
                p.source as data_source,
                COALESCE(p.last_scrape_attempt, p.created_at) as scrape_timestamp,
                p.created_at,
                p.updated_at
            FROM playlists p
            LEFT JOIN artists a ON p.dj_artist_id = a.artist_id
            {where_clause}
            ORDER BY p.event_date DESC NULLS LAST, p.created_at DESC
            LIMIT $1 OFFSET $2
            """

            rows = await conn.fetch(query, *params)

            playlists = []
            for row in rows:
                try:
                    playlist = SetlistResponse(**dict(row))
                    playlists.append(playlist)
                except ValidationError as ve:
                    logger.warning(f"Playlist {row['playlist_id']} failed validation: {ve}")
                    continue

            return playlists

    except Exception as e:
        logger.error(f"Failed to fetch playlists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/graph/nodes")
async def get_graph_nodes(limit: int = 500, min_weight: int = 1):
    """
    Get graph nodes with Gold-quality data and valid artist attribution.

    Uses Silver layer for transition data (currently being migrated to Gold).
    Only returns tracks with valid, non-generic artist names (Gold-ready).
    """
    try:
        async with db_pool.acquire() as conn:
            # Hybrid approach: Silver transitions + Gold-quality validation
            # As Silver-to-Gold ETL progresses, more tracks will be available
            query = """
            SELECT DISTINCT t.id as track_id, t.track_title as title,
                   t.artist_name,
                   t.bpm, t.key, EXTRACT(YEAR FROM t.release_date)::int as release_year,
                   false as is_remix,
                   COUNT(DISTINCT tr.*) as connection_count
            FROM silver_enriched_tracks t
            INNER JOIN (
                SELECT from_track_id as track_id FROM silver_track_transitions WHERE occurrence_count >= $1
                UNION
                SELECT to_track_id as track_id FROM silver_track_transitions WHERE occurrence_count >= $1
            ) connected ON t.id = connected.track_id
            LEFT JOIN silver_track_transitions tr ON (tr.from_track_id = t.id OR tr.to_track_id = t.id)
            WHERE t.artist_name IS NOT NULL
              AND t.artist_name != ''
              AND t.artist_name != 'Unknown Artist'
              AND t.artist_name != 'Various Artists'
            GROUP BY t.id, t.track_title, t.artist_name, t.bpm, t.key, EXTRACT(YEAR FROM t.release_date)
            LIMIT $2
            """
            rows = await conn.fetch(query, min_weight, limit)

            nodes = []
            for row in rows:
                artist = row['artist_name']
                title = row['title']
                year = row['release_year']
                is_remix = row['is_remix']
                nodes.append({
                    "id": f"song_{row['track_id']}",
                    "track_id": f"song_{row['track_id']}",
                    "artist": artist,
                    "title": title,
                    "year": year,  # Add year at top level for easy access
                    "position": {"x": 0.0, "y": 0.0},
                    "metadata": {
                        "title": title,
                        "artist": artist,
                        "node_type": "song",
                        "category": None,
                        "genre": None,
                        "release_year": year,  # Include in metadata too
                        "year": year,  # Alias for consistency
                        "is_remix": is_remix,
                        "appearance_count": row['connection_count'],
                        "label": f"{artist} - {title}" if artist else title,
                        "bpm": row['bpm'],
                        "key": row['key']
                    }
                })

            logger.info(f"Fetched {len(nodes)} graph nodes (Gold-quality, validated artist attribution)")
            return {"nodes": nodes, "total": len(nodes), "limit": limit, "offset": 0}
    except Exception as e:
        logger.error(f"Failed to fetch graph nodes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/graph/edges")
async def get_graph_edges(limit: int = 5000, min_weight: int = 1):
    """
    Get graph edges with Gold-quality validation.

    Uses Silver layer transitions with validated artist attribution.
    Only returns edges where both tracks have valid, non-generic artist names.
    """
    try:
        async with db_pool.acquire() as conn:
            # Hybrid approach: Silver transitions + Gold-quality validation
            query = """
            SELECT tr.from_track_id, tr.to_track_id, tr.occurrence_count as weight,
                   tr.transition_quality_score as quality,
                   tr.avg_bpm_difference as bpm_diff,
                   tr.avg_key_compatibility as key_compat,
                   tr.avg_energy_difference as energy_diff,
                   t1.track_title as source_title, t2.track_title as target_title
            FROM silver_track_transitions tr
            JOIN silver_enriched_tracks t1 ON tr.from_track_id = t1.id
            JOIN silver_enriched_tracks t2 ON tr.to_track_id = t2.id
            WHERE tr.occurrence_count >= $1
              AND t1.artist_name IS NOT NULL AND t1.artist_name != ''
              AND t1.artist_name != 'Unknown Artist' AND t1.artist_name != 'Various Artists'
              AND t2.artist_name IS NOT NULL AND t2.artist_name != ''
              AND t2.artist_name != 'Unknown Artist' AND t2.artist_name != 'Various Artists'
            ORDER BY tr.occurrence_count DESC
            LIMIT $2
            """
            rows = await conn.fetch(query, min_weight, limit)

            edges = []
            for row in rows:
                # Create IDs with song_ prefix to match node IDs
                source_id = f"song_{row['from_track_id']}"
                target_id = f"song_{row['to_track_id']}"
                edge_id = f"{source_id}__{target_id}"
                edges.append({
                    "id": edge_id,
                    "source": source_id,
                    "target": target_id,
                    "weight": row['weight'],
                    "type": "transition",
                    "edge_type": "transition",
                    "source_label": row['source_title'],
                    "target_label": row['target_title'],
                    "quality_score": float(row['quality']) if row['quality'] is not None else None,
                    "bpm_difference": float(row['bpm_diff']) if row['bpm_diff'] is not None else None,
                    "key_compatibility": float(row['key_compat']) if row['key_compat'] is not None else None,
                    "energy_difference": float(row['energy_diff']) if row['energy_diff'] is not None else None
                })

            logger.info(f"Fetched {len(edges)} graph edges (Gold-quality, validated both endpoints)")
            return {"edges": edges, "total": len(edges), "limit": limit, "offset": 0}
    except Exception as e:
        logger.error(f"Failed to fetch graph edges: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/scrape/trigger")
async def trigger_scrape(source: str = "1001tracklists"):
    """Trigger web scraping job"""
    try:
        return {
            "status": "initiated",
            "job_id": "scrape_12345",
            "source": source,
            "message": "Scraping job has been queued"
        }
    except Exception as e:
        logger.error(f"Failed to trigger scrape: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# PIPELINE OBSERVABILITY ENDPOINTS - 2025 Data Pipeline Best Practices
# =============================================================================

class ScrapingRunSummary(BaseModel):
    """Scraping run summary model"""
    run_id: str
    scraper_name: str
    start_time: datetime
    end_time: Optional[datetime]
    status: str
    tracks_searched: Optional[int]
    playlists_found: Optional[int]
    songs_added: Optional[int]
    artists_added: Optional[int]
    errors_count: Optional[int]
    avg_quality_score: Optional[float]
    quality_issues: Optional[int]
    playlists_validated: Optional[int]
    validation_failures: Optional[int]
    sources_attempted: Optional[int]
    sources_successful: Optional[int]
    avg_response_time_ms: Optional[float]
    critical_anomalies: Optional[int]
    warning_anomalies: Optional[int]

class PipelineHealthData(BaseModel):
    """Pipeline health dashboard data"""
    time_bucket: datetime
    total_runs: int
    successful_runs: int
    failed_runs: int
    avg_duration_seconds: Optional[float]
    total_songs_added: Optional[int]
    total_artists_added: Optional[int]
    avg_quality_score: Optional[float]
    total_critical_anomalies: Optional[int]

class SourceExtractionDetail(BaseModel):
    """Source extraction log detail"""
    extraction_id: str
    source_url: str
    website_domain: str
    scraper_used: str
    http_status_code: Optional[int]
    response_time_ms: Optional[int]
    success: bool
    error_message: Optional[str]
    extracted_elements: Optional[Dict[str, Any]]
    retry_count: int
    extraction_timestamp: datetime

class GraphValidationDetail(BaseModel):
    """Graph validation result detail"""
    validation_id: str
    playlist_id: str
    expected_nodes: int
    actual_nodes: int
    expected_edges: int
    actual_edges: int
    same_artist_exceptions: int
    validation_passed: bool
    validation_message: Optional[str]
    validation_timestamp: datetime

class QualityMetricDetail(BaseModel):
    """Data quality metric detail"""
    quality_id: str
    pillar: str  # freshness, volume, schema, distribution, lineage
    metric_name: str
    expected_value: Optional[float]
    actual_value: float
    quality_score: float
    threshold_min: Optional[float]
    threshold_max: Optional[float]
    status: str
    measured_at: datetime

class AnomalyDetail(BaseModel):
    """Anomaly detection detail"""
    anomaly_id: str
    anomaly_type: str
    severity: str
    metric_name: str
    expected_range_min: Optional[float]
    expected_range_max: Optional[float]
    actual_value: float
    confidence_score: float
    description: str
    suggested_actions: List[str]
    detection_timestamp: datetime
    acknowledged: bool

@app.get("/api/v1/observability/runs", response_model=List[ScrapingRunSummary])
async def get_scraping_runs(limit: int = 20, offset: int = 0, status: Optional[str] = None):
    """Get scraping runs history with comprehensive metrics"""
    try:
        async with db_pool.acquire() as conn:
            where_clause = ""
            params = [limit, offset]
            param_count = 2

            if status:
                where_clause = "WHERE status = $3"
                params.append(status)
                param_count += 1

            query = f"""
            SELECT * FROM scraping_run_summary
            {where_clause}
            ORDER BY start_time DESC
            LIMIT $1 OFFSET $2
            """

            rows = await conn.fetch(query, *params)

            runs = []
            for row in rows:
                runs.append(ScrapingRunSummary(**dict(row)))

            return runs

    except Exception as e:
        logger.error(f"Failed to fetch scraping runs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}", response_model=ScrapingRunSummary)
async def get_scraping_run_detail(run_id: str):
    """Get detailed information about a specific scraping run"""
    try:
        async with db_pool.acquire() as conn:
            query = "SELECT * FROM scraping_run_summary WHERE run_id = $1"
            row = await conn.fetchrow(query, run_id)

            if not row:
                raise HTTPException(status_code=404, detail="Scraping run not found")

            return ScrapingRunSummary(**dict(row))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch scraping run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}/sources", response_model=List[SourceExtractionDetail])
async def get_run_source_extractions(run_id: str):
    """Get source extraction details for a specific run"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT extraction_id, source_url, website_domain, scraper_used,
                   http_status_code, response_time_ms, success, error_message,
                   extracted_elements, retry_count, extraction_timestamp
            FROM source_extraction_log
            WHERE run_id = $1
            ORDER BY extraction_timestamp DESC
            """
            rows = await conn.fetch(query, run_id)

            extractions = []
            for row in rows:
                extractions.append(SourceExtractionDetail(**dict(row)))

            return extractions

    except Exception as e:
        logger.error(f"Failed to fetch source extractions for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}/validations", response_model=List[GraphValidationDetail])
async def get_run_graph_validations(run_id: str):
    """Get graph validation results for a specific run"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT validation_id, playlist_id, expected_nodes, actual_nodes,
                   expected_edges, actual_edges, same_artist_exceptions,
                   validation_passed, validation_message, validation_timestamp
            FROM graph_validation_results
            WHERE run_id = $1
            ORDER BY validation_timestamp DESC
            """
            rows = await conn.fetch(query, run_id)

            validations = []
            for row in rows:
                validations.append(GraphValidationDetail(**dict(row)))

            return validations

    except Exception as e:
        logger.error(f"Failed to fetch validations for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}/quality", response_model=List[QualityMetricDetail])
async def get_run_quality_metrics(run_id: str):
    """Get data quality metrics for a specific run"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT quality_id, pillar, metric_name, expected_value, actual_value,
                   quality_score, threshold_min, threshold_max, status, measured_at
            FROM data_quality_metrics
            WHERE run_id = $1
            ORDER BY measured_at DESC
            """
            rows = await conn.fetch(query, run_id)

            metrics = []
            for row in rows:
                metrics.append(QualityMetricDetail(**dict(row)))

            return metrics

    except Exception as e:
        logger.error(f"Failed to fetch quality metrics for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/runs/{run_id}/anomalies", response_model=List[AnomalyDetail])
async def get_run_anomalies(run_id: str):
    """Get anomaly detection results for a specific run"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT anomaly_id, anomaly_type, severity, metric_name,
                   expected_range_min, expected_range_max, actual_value,
                   confidence_score, description, suggested_actions,
                   detection_timestamp, acknowledged
            FROM anomaly_detection
            WHERE run_id = $1
            ORDER BY detection_timestamp DESC
            """
            rows = await conn.fetch(query, run_id)

            anomalies = []
            for row in rows:
                row_dict = dict(row)
                # Parse JSON array for suggested_actions
                if row_dict['suggested_actions']:
                    row_dict['suggested_actions'] = json.loads(row_dict['suggested_actions'])
                else:
                    row_dict['suggested_actions'] = []

                anomalies.append(AnomalyDetail(**row_dict))

            return anomalies

    except Exception as e:
        logger.error(f"Failed to fetch anomalies for run {run_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/health", response_model=List[PipelineHealthData])
async def get_pipeline_health(hours: int = 24):
    """Get pipeline health dashboard data"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT * FROM pipeline_health_dashboard
            WHERE time_bucket >= NOW() - INTERVAL '%d hours'
            ORDER BY time_bucket DESC
            """ % hours

            rows = await conn.fetch(query)

            health_data = []
            for row in rows:
                health_data.append(PipelineHealthData(**dict(row)))

            return health_data

    except Exception as e:
        logger.error(f"Failed to fetch pipeline health: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/metrics/summary")
async def get_metrics_summary():
    """Get overall pipeline metrics summary"""
    try:
        async with db_pool.acquire() as conn:
            # Get overall statistics
            summary_query = """
            SELECT
                COUNT(*) as total_runs,
                COUNT(*) FILTER (WHERE status = 'completed') as successful_runs,
                COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
                COUNT(*) FILTER (WHERE start_time >= NOW() - INTERVAL '24 hours') as runs_last_24h,
                AVG(songs_added) as avg_songs_per_run,
                SUM(songs_added) as total_songs_scraped,
                SUM(artists_added) as total_artists_scraped
            FROM scraping_runs
            WHERE start_time >= NOW() - INTERVAL '30 days'
            """

            summary_row = await conn.fetchrow(summary_query)

            # Get quality metrics summary
            quality_query = """
            SELECT
                pillar,
                AVG(quality_score) as avg_score,
                COUNT(*) FILTER (WHERE status = 'fail') as failures
            FROM data_quality_metrics
            WHERE measured_at >= NOW() - INTERVAL '7 days'
            GROUP BY pillar
            """

            quality_rows = await conn.fetch(quality_query)

            # Get recent anomalies
            anomaly_query = """
            SELECT severity, COUNT(*) as count
            FROM anomaly_detection
            WHERE detection_timestamp >= NOW() - INTERVAL '24 hours'
              AND NOT acknowledged
            GROUP BY severity
            """

            anomaly_rows = await conn.fetch(anomaly_query)

            return {
                "summary": dict(summary_row) if summary_row else {},
                "quality_by_pillar": [dict(row) for row in quality_rows],
                "recent_anomalies": [dict(row) for row in anomaly_rows]
            }

    except Exception as e:
        logger.error(f"Failed to fetch metrics summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/graph/impact")
async def get_graph_impact_analysis(run_id: Optional[str] = None, limit: int = 50):
    """Get graph impact analysis data"""
    try:
        async with db_pool.acquire() as conn:
            where_clause = ""
            params = [limit]

            if run_id:
                where_clause = "WHERE run_id = $2"
                params.append(run_id)

            query = f"""
            SELECT gia.*, sr.scraper_name, sr.start_time
            FROM graph_impact_analysis gia
            JOIN scraping_runs sr ON gia.run_id = sr.run_id
            {where_clause}
            ORDER BY gia.analysis_timestamp DESC
            LIMIT $1
            """

            rows = await conn.fetch(query, *params)

            impact_data = []
            for row in rows:
                impact_data.append(dict(row))

            return impact_data

    except Exception as e:
        logger.error(f"Failed to fetch graph impact analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/observability/anomalies/{anomaly_id}/acknowledge")
async def acknowledge_anomaly(anomaly_id: str, acknowledged_by: str = "user"):
    """Acknowledge an anomaly"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            UPDATE anomaly_detection
            SET acknowledged = true, acknowledged_by = $2, acknowledged_at = CURRENT_TIMESTAMP
            WHERE anomaly_id = $1
            RETURNING *
            """

            row = await conn.fetchrow(query, anomaly_id, acknowledged_by)

            if not row:
                raise HTTPException(status_code=404, detail="Anomaly not found")

            return {"status": "acknowledged", "anomaly_id": anomaly_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to acknowledge anomaly {anomaly_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/data-completeness")
async def get_data_completeness():
    """
    Get comprehensive data completeness and quality statistics.

    Returns dependency-ordered metadata showing:
    - Total tracks, artists, and playlists
    - Enrichment status (Spotify IDs, Tidal IDs, etc.)
    - Audio features (BPM, key, energy, etc.)
    - Missing data that blocks enrichment
    - Data quality metrics
    """
    try:
        async with db_pool.acquire() as conn:
            # Set search path to musicdb schema
            await conn.execute("SET search_path TO musicdb, public")

            # Get comprehensive track statistics with dependency tracking
            track_stats_query = """
            WITH track_stats AS (
                SELECT
                    COUNT(*) as total_tracks,
                    -- Artist attribution (required for enrichment)
                    COUNT(*) FILTER (WHERE EXISTS (
                        SELECT 1 FROM track_artists ta
                        WHERE ta.track_id = tracks.id AND ta.role = 'primary'
                    )) as tracks_with_artist,
                    -- External platform IDs
                    COUNT(*) FILTER (WHERE spotify_id IS NOT NULL) as tracks_with_spotify_id,
                    COUNT(*) FILTER (WHERE apple_music_id IS NOT NULL) as tracks_with_apple_music_id,
                    COUNT(*) FILTER (WHERE tidal_id IS NOT NULL) as tracks_with_tidal_id,
                    COUNT(*) FILTER (WHERE isrc IS NOT NULL) as tracks_with_isrc,
                    COUNT(*) FILTER (WHERE musicbrainz_id IS NOT NULL) as tracks_with_musicbrainz_id,
                    -- Audio features (enriched data)
                    COUNT(*) FILTER (WHERE bpm IS NOT NULL) as tracks_with_bpm,
                    COUNT(*) FILTER (WHERE key IS NOT NULL) as tracks_with_key,
                    COUNT(*) FILTER (WHERE energy IS NOT NULL) as tracks_with_energy,
                    COUNT(*) FILTER (WHERE danceability IS NOT NULL) as tracks_with_danceability,
                    COUNT(*) FILTER (WHERE valence IS NOT NULL) as tracks_with_valence,
                    -- Comprehensive audio analysis
                    COUNT(*) FILTER (WHERE
                        bpm IS NOT NULL AND
                        key IS NOT NULL AND
                        energy IS NOT NULL AND
                        danceability IS NOT NULL
                    ) as tracks_with_complete_audio_features,
                    -- Release metadata
                    COUNT(*) FILTER (WHERE release_date IS NOT NULL) as tracks_with_release_date,
                    COUNT(*) FILTER (WHERE genre IS NOT NULL) as tracks_with_genre,
                    -- Tracks ready for enrichment (have artist, no Spotify ID yet)
                    COUNT(*) FILTER (WHERE
                        EXISTS (
                            SELECT 1 FROM track_artists ta
                            WHERE ta.track_id = tracks.id AND ta.role = 'primary'
                        )
                        AND spotify_id IS NULL
                    ) as tracks_ready_for_spotify_enrichment,
                    -- Tracks blocking enrichment (no artist attribution)
                    COUNT(*) FILTER (WHERE NOT EXISTS (
                        SELECT 1 FROM track_artists ta
                        WHERE ta.track_id = tracks.id AND ta.role = 'primary'
                    )) as tracks_missing_artist_attribution
                FROM tracks
            )
            SELECT * FROM track_stats
            """

            track_stats = await conn.fetchrow(track_stats_query)

            # Get artist statistics
            artist_stats_query = """
            SELECT
                COUNT(*) as total_artists,
                COUNT(*) FILTER (WHERE spotify_id IS NOT NULL) as artists_with_spotify_id,
                COUNT(*) FILTER (WHERE apple_music_id IS NOT NULL) as artists_with_apple_music_id,
                COUNT(*) FILTER (WHERE musicbrainz_id IS NOT NULL) as artists_with_musicbrainz_id,
                COUNT(*) FILTER (WHERE beatport_id IS NOT NULL) as artists_with_beatport_id,
                COUNT(*) FILTER (WHERE tidal_id IS NOT NULL) as artists_with_tidal_id,
                COUNT(*) FILTER (WHERE metadata IS NOT NULL AND metadata != '{}') as artists_with_metadata,
                -- Artists with tracks (active artists)
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM track_artists ta WHERE ta.artist_id = artists.artist_id
                )) as artists_with_tracks
            FROM artists
            """

            artist_stats = await conn.fetchrow(artist_stats_query)

            # Get playlist statistics
            playlist_stats_query = """
            SELECT
                COUNT(*) as total_setlists,
                COUNT(*) FILTER (WHERE source IS NOT NULL) as setlists_with_source,
                COUNT(*) FILTER (WHERE tracklist_count > 0) as complete_setlists,
                COUNT(*) FILTER (WHERE dj_artist_id IS NOT NULL) as setlists_with_performer,
                COUNT(*) FILTER (WHERE event_date IS NOT NULL) as setlists_with_date,
                -- Playlists with tracks
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM playlist_tracks pt WHERE pt.playlist_id = playlists.playlist_id
                )) as setlists_with_tracks
            FROM playlists
            """

            playlist_stats = await conn.fetchrow(playlist_stats_query)

            # Get data quality metrics (last enrichment run)
            quality_metrics_query = """
            SELECT
                COUNT(*) as total_quality_checks,
                COUNT(*) FILTER (WHERE status = 'pass') as checks_passed,
                COUNT(*) FILTER (WHERE status = 'warn') as checks_warned,
                COUNT(*) FILTER (WHERE status = 'fail') as checks_failed,
                AVG(quality_score) as avg_quality_score
            FROM data_quality_metrics
            WHERE measured_at >= NOW() - INTERVAL '7 days'
            """

            try:
                quality_stats = await conn.fetchrow(quality_metrics_query)
            except Exception:
                # Table might not exist yet
                quality_stats = None

            # Calculate enrichment readiness and blockers
            total_tracks = track_stats['total_tracks'] if track_stats else 0

            # Build comprehensive response
            response = {
                "total_counts": {
                    "tracks": total_tracks,
                    "artists": artist_stats['total_artists'] if artist_stats else 0,
                    "setlists": playlist_stats['total_setlists'] if playlist_stats else 0
                },
                "track_completeness": {
                    "artist_attribution": {
                        "count": track_stats['tracks_with_artist'] if track_stats else 0,
                        "percentage": round((track_stats['tracks_with_artist'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                        "missing": track_stats['tracks_missing_artist_attribution'] if track_stats else 0,
                        "blocking_enrichment": True,
                        "dependency_level": 1,
                        "description": "Required for all external ID enrichment"
                    },
                    "platform_ids": {
                        "spotify_id": {
                            "count": track_stats['tracks_with_spotify_id'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_spotify_id'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 2,
                            "depends_on": "artist_attribution",
                            "ready_for_enrichment": track_stats['tracks_ready_for_spotify_enrichment'] if track_stats else 0
                        },
                        "tidal_id": {
                            "count": track_stats['tracks_with_tidal_id'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_tidal_id'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 2,
                            "depends_on": "artist_attribution"
                        },
                        "apple_music_id": {
                            "count": track_stats['tracks_with_apple_music_id'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_apple_music_id'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 2,
                            "depends_on": "artist_attribution"
                        },
                        "isrc": {
                            "count": track_stats['tracks_with_isrc'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_isrc'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 2,
                            "description": "Universal track identifier"
                        },
                        "musicbrainz_id": {
                            "count": track_stats['tracks_with_musicbrainz_id'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_musicbrainz_id'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 2
                        }
                    },
                    "audio_features": {
                        "bpm": {
                            "count": track_stats['tracks_with_bpm'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_bpm'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 3,
                            "depends_on": "spotify_id"
                        },
                        "musical_key": {
                            "count": track_stats['tracks_with_key'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_key'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 3,
                            "depends_on": "spotify_id"
                        },
                        "energy": {
                            "count": track_stats['tracks_with_energy'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_energy'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 3,
                            "depends_on": "spotify_id"
                        },
                        "danceability": {
                            "count": track_stats['tracks_with_danceability'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_danceability'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 3,
                            "depends_on": "spotify_id"
                        },
                        "valence": {
                            "count": track_stats['tracks_with_valence'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_valence'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 3,
                            "depends_on": "spotify_id"
                        },
                        "complete_analysis": {
                            "count": track_stats['tracks_with_complete_audio_features'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_complete_audio_features'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 3,
                            "description": "Tracks with BPM, key, energy, and danceability"
                        }
                    },
                    "metadata": {
                        "release_date": {
                            "count": track_stats['tracks_with_release_date'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_release_date'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 3
                        },
                        "genre": {
                            "count": track_stats['tracks_with_genre'] if track_stats else 0,
                            "percentage": round((track_stats['tracks_with_genre'] / total_tracks * 100) if total_tracks > 0 else 0, 1),
                            "dependency_level": 3
                        }
                    }
                },
                "artist_completeness": {
                    "total_artists": artist_stats['total_artists'] if artist_stats else 0,
                    "artists_with_tracks": artist_stats['artists_with_tracks'] if artist_stats else 0,
                    "platform_ids": {
                        "spotify_id": {
                            "count": artist_stats['artists_with_spotify_id'] if artist_stats else 0,
                            "percentage": round((artist_stats['artists_with_spotify_id'] / artist_stats['total_artists'] * 100) if artist_stats and artist_stats['total_artists'] > 0 else 0, 1)
                        },
                        "apple_music_id": {
                            "count": artist_stats['artists_with_apple_music_id'] if artist_stats else 0,
                            "percentage": round((artist_stats['artists_with_apple_music_id'] / artist_stats['total_artists'] * 100) if artist_stats and artist_stats['total_artists'] > 0 else 0, 1)
                        },
                        "musicbrainz_id": {
                            "count": artist_stats['artists_with_musicbrainz_id'] if artist_stats else 0,
                            "percentage": round((artist_stats['artists_with_musicbrainz_id'] / artist_stats['total_artists'] * 100) if artist_stats and artist_stats['total_artists'] > 0 else 0, 1)
                        }
                    }
                },
                "setlist_completeness": {
                    "total_setlists": playlist_stats['total_setlists'] if playlist_stats else 0,
                    "complete_setlists": playlist_stats['complete_setlists'] if playlist_stats else 0,
                    "setlists_with_tracks": playlist_stats['setlists_with_tracks'] if playlist_stats else 0,
                    "setlists_with_performer": playlist_stats['setlists_with_performer'] if playlist_stats else 0
                },
                "enrichment_pipeline_status": {
                    "tracks_ready_for_enrichment": track_stats['tracks_ready_for_spotify_enrichment'] if track_stats else 0,
                    "tracks_blocking_enrichment": track_stats['tracks_missing_artist_attribution'] if track_stats else 0,
                    "enrichment_readiness_rate": round(
                        (track_stats['tracks_ready_for_spotify_enrichment'] / total_tracks * 100) if total_tracks > 0 else 0, 1
                    )
                },
                "data_quality": {
                    "total_checks": quality_stats['total_quality_checks'] if quality_stats else 0,
                    "passed": quality_stats['checks_passed'] if quality_stats else 0,
                    "warned": quality_stats['checks_warned'] if quality_stats else 0,
                    "failed": quality_stats['checks_failed'] if quality_stats else 0,
                    "avg_score": round(float(quality_stats['avg_quality_score']) * 100, 1) if quality_stats and quality_stats['avg_quality_score'] else 0
                } if quality_stats else None
            }

            return response

    except Exception as e:
        logger.error(f"Failed to fetch data completeness: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/observability/sources/performance")
async def get_source_performance_analysis(domain: Optional[str] = None, hours: int = 24):
    """Get source performance analysis"""
    try:
        async with db_pool.acquire() as conn:
            where_clause = "WHERE sel.extraction_timestamp >= NOW() - INTERVAL '%d hours'" % hours
            params = []

            if domain:
                where_clause += " AND sel.website_domain = $1"
                params.append(domain)

            query = f"""
            SELECT
                sel.website_domain,
                COUNT(*) as total_attempts,
                COUNT(*) FILTER (WHERE sel.success) as successful_attempts,
                AVG(sel.response_time_ms) as avg_response_time,
                MAX(sel.response_time_ms) as max_response_time,
                COUNT(*) FILTER (WHERE sel.retry_count > 0) as retried_attempts,
                COUNT(DISTINCT sr.run_id) as runs_involved
            FROM source_extraction_log sel
            JOIN scraping_runs sr ON sel.run_id = sr.run_id
            {where_clause}
            GROUP BY sel.website_domain
            ORDER BY total_attempts DESC
            """

            rows = await conn.fetch(query, *params)

            performance_data = []
            for row in rows:
                row_dict = dict(row)
                # Calculate success rate
                row_dict['success_rate'] = (
                    row_dict['successful_attempts'] / row_dict['total_attempts']
                    if row_dict['total_attempts'] > 0 else 0
                )
                performance_data.append(row_dict)

            return performance_data

    except Exception as e:
        logger.error(f"Failed to fetch source performance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/target-tracks")
async def get_target_tracks():
    """Get list of target tracks from the database"""
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT track_id, title, artist, priority, genres, is_active,
                       last_searched, playlists_found, adjacencies_found, added_at, updated_at
                FROM target_tracks
                WHERE is_active = true
                ORDER BY priority DESC, added_at DESC
            """)
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Failed to fetch target tracks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/target-tracks", status_code=201)
async def create_target_track(
    title: str,
    artist: str,
    priority: str = "medium",
    genres: List[str] = None,
    is_active: bool = True
):
    """Add a new target track"""
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO target_tracks (title, artist, priority, genres, is_active)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING track_id, title, artist, priority, genres, is_active, added_at
            """, title, artist, priority, genres or [], is_active)
            return dict(row)
    except Exception as e:
        logger.error(f"Failed to create target track: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/music-search/{service}")
async def music_search(service: str, q: str, limit: int = 20):
    """
    Search for tracks on Spotify or Tidal

    Args:
        service: 'spotify' or 'tidal'
        q: search query (track name, artist, etc.)
        limit: maximum number of results (default: 20)

    Returns:
        List of tracks with metadata from the music service
    """
    if service not in ['spotify', 'tidal']:
        raise HTTPException(status_code=400, detail="Service must be 'spotify' or 'tidal'")

    try:
        # For now, we'll make a direct HTTP request to the metadata-enrichment service
        # In production, this should use proper service discovery
        import aiohttp

        metadata_service_url = os.getenv('METADATA_ENRICHMENT_URL', 'http://metadata-enrichment:8086')

        async with aiohttp.ClientSession() as session:
            url = f"{metadata_service_url}/api/v1/search/{service}"
            params = {'q': q, 'limit': limit}

            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                elif response.status == 404:
                    # Service doesn't exist yet, return mock data for development
                    logger.warning(f"Metadata enrichment service not available, returning mock data")
                    return {
                        "tracks": [
                            {
                                "id": f"{service}_mock_1",
                                "name": "Sample Track 1",
                                "title": "Sample Track 1",
                                "artist": "Sample Artist",
                                "artists": [{"name": "Sample Artist"}],
                                "album": {"name": "Sample Album", "images": [{"url": "https://via.placeholder.com/300"}]},
                                "duration_ms": 180000,
                                "preview_url": None,
                                "image": "https://via.placeholder.com/300"
                            }
                        ]
                    }
                else:
                    raise HTTPException(status_code=response.status, detail=f"Music service error: {await response.text()}")

    except aiohttp.ClientConnectorError:
        logger.warning(f"Cannot connect to metadata enrichment service")
        # Return mock data for development
        return {
            "tracks": [
                {
                    "id": f"{service}_mock_1",
                    "name": q,
                    "title": q,
                    "artist": "Mock Artist",
                    "artists": [{"name": "Mock Artist"}],
                    "album": {"name": "Mock Album", "images": [{"url": "https://via.placeholder.com/300"}]},
                    "duration_ms": 180000,
                    "preview_url": None,
                    "image": "https://via.placeholder.com/300"
                }
            ]
        }
    except Exception as e:
        logger.error(f"Music search failed for {service}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    # Update pool connection metrics if available
    if db_pool:
        try:
            pool_size = db_pool.get_size()
            free_size = db_pool.get_idle_size()
            DB_POOL_CONNECTIONS.labels(state='active').set(pool_size - free_size)
            DB_POOL_CONNECTIONS.labels(state='idle').set(free_size)
        except Exception as e:
            logger.warning(f"Failed to get pool metrics: {e}")

    from fastapi.responses import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    import sys

    # Validate secrets before starting service
    if not validate_secrets():
        logger.error("❌ Required secrets missing - exiting")
        sys.exit(1)

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)
