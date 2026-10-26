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
    dj_artist: Optional[str] = None  # When given, also records a silver set with ordered positions
    name: Optional[str] = None


class TracklistImportResponse(BaseModel):
    """Response payload for tracklist import operation"""
    created: int = 0
    updated: int = 0
    failed: int = 0
    total: int = 0
    details: List[Dict[str, Any]] = Field(default_factory=list)
    transitions_created: int = 0
    replayed: bool = False  # Identical ordered list already imported; nothing was changed


# Database connection - use secrets_manager if available
try:
    DATABASE_URL = get_database_url(async_driver=True, use_connection_pool=True)
    # asyncpg doesn't accept SQLAlchemy-style DSN format (postgresql+asyncpg)
    # Strip the driver suffix for direct asyncpg usage
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

    # Kubernetes: Disable SSL for asyncpg if not already specified
    # PostgreSQL in k8s cluster doesn't have SSL enabled by default
    if "sslmode=" not in DATABASE_URL:
        separator = "&" if "?" in DATABASE_URL else "?"
        DATABASE_URL = f"{DATABASE_URL}{separator}sslmode=disable"

    logger.info("✅ Using secrets_manager for database connection")
except NameError:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://musicdb_user:musicdb_secure_pass_2024@db-connection-pool:6432/musicdb")
    # Ensure SSL is disabled for fallback URL too
    if "sslmode=" not in DATABASE_URL:
        separator = "&" if "?" in DATABASE_URL else "?"
        DATABASE_URL = f"{DATABASE_URL}{separator}sslmode=disable"
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

# Artist and track writes (create/rename/merge/delete/assign, tracklist import) live in
# routers/catalog_writes.py and operate on the silver tables.

class TrackUpdateRequest(BaseModel):
    """Manual silver-catalog corrections; energy calibration is a later milestone."""
    artist_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    track_title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    bpm: Optional[float] = Field(default=None, ge=20, le=300)
    key: Optional[str] = Field(default=None, max_length=20)
    genre: Optional[str] = Field(default=None, max_length=100)


@app.patch("/api/tracks/{track_id}")
async def update_track_metadata(track_id: str, update_data: TrackUpdateRequest):
    """Correct silver metadata, preserving SQL array types and omitted/null semantics."""
    from uuid import UUID
    try:
        identifier = UUID(track_id.removeprefix('song_'))
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid track ID")
    updates = update_data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="At least one field must be updated")
    for name in ('artist_name', 'track_title'):
        if name in updates:
            if updates[name] is None or not updates[name].strip():
                raise HTTPException(status_code=422, detail=f"{name} must contain text")
            updates[name] = updates[name].strip()
    if 'genre' in updates and updates['genre'] is not None:
        updates['genre'] = [updates['genre']]
    from common.datalayer import evidence, outbox
    from common.metadata.camelot import to_camelot
    changed = list(updates)
    if 'key' in updates:
        updates['camelot_key'] = to_camelot(updates['key']) if updates['key'] else None
    assignments = ', '.join(f'{name} = ${i}' for i, name in enumerate(updates, start=2))
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(f"""
                UPDATE silver_enriched_tracks SET {assignments}, updated_at = NOW()
                WHERE id = $1 RETURNING id, track_title, artist_name, bpm, key, genre, updated_at
            """, identifier, *updates.values())
            if row is not None:
                # A manual correction is the strongest evidence; clearing a value withdraws it.
                for field in ('bpm', 'key'):
                    if field in updates:
                        await conn.execute("DELETE FROM silver_track_metadata_evidence WHERE track_id = $1 AND field = $2 "
                                           "AND source = 'manual'", identifier, field)
                        await evidence.record(conn, identifier, field, updates[field], 'manual', method='rest_api_patch')
                await outbox.append(conn, 'track', identifier, 'updated', {'fields': changed, 'by': 'manual_patch'})
    if row is None:
        raise HTTPException(status_code=404, detail="Track not found in Silver layer")
    return {**dict(row), 'id': str(row['id']), 'track_id': f"song_{row['id']}"}

@app.get("/api/v1/tracks/{track_id}/preview", response_model=TrackPreviewResponse)
async def get_track_preview(track_id: str):
    """Return preview metadata from the silver catalog; no audio is stored, so only streaming IDs are exposed."""

    if not db_pool:
        raise HTTPException(status_code=503, detail="Database connection not ready")

    normalized_id = track_id.removeprefix('song_')

    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM silver_enriched_tracks WHERE id::text = $1 OR spotify_id = $1 ORDER BY created_at LIMIT 1",
                normalized_id)

        if not row:
            raise HTTPException(status_code=404, detail=f"Track '{track_id}' not found in silver catalog")

        from common.track_metadata import stored_metadata
        stored = stored_metadata(dict(row))
        return TrackPreviewResponse(
            track_id=str(row['id']),
            preview_url=None,
            source=None,
            expires_at=None,
            message=(
                "No cached preview available. Use the streaming IDs to request a 30s clip "
                "from Spotify or Tidal, or trigger re-enrichment via metadata services."
            ),
            streaming_options={key: stored[key] for key in ('spotify_id', 'tidal_id', 'apple_music_id')},
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Failed to fetch preview for track {track_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch track preview")



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

# Scrape submission and job status live in routers/jobs.py (durable ingestion_jobs records).

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

# Queue management uses one JSON contract shared with the frontend.
from routers.target_tracks import router as target_tracks_router
app.include_router(target_tracks_router)

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


# Writes register first so static paths (/artists/dirty, /tracks/missing-artist) win over the
# parameterised read routes below.
from routers.catalog_writes import router as catalog_writes_router
app.include_router(catalog_writes_router)
from routers.jobs import router as jobs_router
app.include_router(jobs_router)
from routers.datalayer import router as datalayer_router
app.include_router(datalayer_router)

# Read contracts are separate from scraper submission validators.
from routers.catalog_reads import router as catalog_reads_router
from routers.library_search import register as register_library_search
register_library_search(app)

app.include_router(catalog_reads_router)
from routers.library_ingest import register as register_library
register_library(app)

import router_registry
router_registry.register_all(app)

if __name__ == "__main__":
    import sys

    # Validate secrets before starting service
    if not validate_secrets():
        logger.error("❌ Required secrets missing - exiting")
        sys.exit(1)

    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)
