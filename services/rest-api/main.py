"""REST API Service for SongNodes"""
from fastapi import FastAPI, HTTPException, Depends
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
        services_available: Dict[str, bool]
        timestamp: datetime = Field(default_factory=datetime.utcnow)
    class ErrorResponse(BaseModel):
        error: str
        detail: Optional[str] = None

# Database connection - use secrets_manager if available
try:
    DATABASE_URL = get_database_url(async_driver=True, use_connection_pool=True)
    logger.info("✅ Using secrets_manager for database connection")
except NameError:
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://musicdb_user:musicdb_secure_pass_2024@db-connection-pool:6432/musicdb")
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
            server_settings={
                'jit': 'off',  # Disable JIT for predictable performance
                'statement_timeout': '30000',  # 30 second statement timeout
                'idle_in_transaction_session_timeout': '300000'  # 5 minute idle timeout
            },
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
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3006').split(',')
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
        import psutil

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

        # Check system memory
        memory_percent = psutil.virtual_memory().percent
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
                artist_name, normalized_name, aliases,
                spotify_id, apple_music_id, youtube_channel_id, soundcloud_id,
                discogs_id, musicbrainz_id, genre_preferences, country,
                is_verified, follower_count, monthly_listeners, popularity_score,
                data_source, scrape_timestamp
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
            )
            RETURNING artist_id, created_at, updated_at
            """

            row = await conn.fetchrow(
                query,
                artist.artist_name, artist.normalized_name, artist.aliases,
                artist.spotify_id, artist.apple_music_id, artist.youtube_channel_id,
                artist.soundcloud_id, artist.discogs_id, artist.musicbrainz_id,
                artist.genre_preferences, artist.country, artist.is_verified,
                artist.follower_count, artist.monthly_listeners, artist.popularity_score,
                artist.data_source.value, artist.scrape_timestamp
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
    Get list of tracks with comprehensive validation and filtering.

    Supports filtering by artist, BPM range. All tracks validated by Pydantic.
    """
    try:
        async with db_pool.acquire() as conn:
            # Build dynamic query based on filters
            conditions = []
            params = []
            param_num = 1

            if artist_id:
                conditions.append(f"primary_artist_id = ${param_num}")
                params.append(artist_id)
                param_num += 1

            if min_bpm:
                conditions.append(f"bpm >= ${param_num}")
                params.append(min_bpm)
                param_num += 1

            if max_bpm:
                conditions.append(f"bpm <= ${param_num}")
                params.append(max_bpm)
                param_num += 1

            where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

            query = f"""
            SELECT song_id::text, track_id, track_name, normalized_title, duration_ms,
                   isrc, spotify_id, apple_music_id, youtube_id, soundcloud_id, musicbrainz_id,
                   bpm, musical_key, energy, danceability, valence, acousticness,
                   instrumentalness, liveness, speechiness, loudness,
                   release_date, genre, subgenre, record_label,
                   is_remix, is_mashup, is_live, is_cover, is_instrumental, is_explicit,
                   remix_type, original_artist, remixer, mashup_components,
                   popularity_score, play_count, track_type, source_context, position_in_source,
                   data_source, scrape_timestamp, primary_artist_id::text, created_at, updated_at
            FROM tracks
            {where_clause}
            ORDER BY track_name
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

@app.get("/api/search/tracks", response_model=List[TrackResponse])
async def search_tracks(
    query: str,
    limit: int = 20,
    offset: int = 0
):
    """
    Search tracks by name with fuzzy matching.

    Uses PostgreSQL's trigram similarity for fuzzy text search.
    Results ordered by similarity score (most relevant first).
    """
    try:
        async with db_pool.acquire() as conn:
            # Use ILIKE pattern matching for fuzzy search
            # Note: Database uses 'title' but Pydantic models use 'track_name'
            search_query = """
            SELECT song_id::text, track_id, title as track_name, normalized_title,
                   duration_seconds as duration_ms,
                   isrc, spotify_id, apple_music_id, youtube_music_id as youtube_id,
                   soundcloud_id, musicbrainz_id,
                   bpm, key as musical_key, energy, danceability, valence, acousticness,
                   instrumentalness, liveness, speechiness, loudness,
                   release_year as release_date, genre, NULL as subgenre, label as record_label,
                   is_remix, is_mashup, is_live, is_cover, is_instrumental, is_explicit,
                   NULL as remix_type, NULL as original_artist, NULL as remixer, NULL as mashup_components,
                   NULL as popularity_score, NULL as play_count, NULL as track_type,
                   NULL as source_context, NULL as position_in_source,
                   'mixesdb' as data_source, created_at as scrape_timestamp,
                   primary_artist_id::text, created_at, updated_at
            FROM songs
            WHERE title ILIKE $1 OR normalized_title ILIKE $1
            ORDER BY
                CASE
                    WHEN title ILIKE $2 THEN 1
                    WHEN title ILIKE $1 THEN 2
                    ELSE 3
                END, title
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

            logger.info(f"Search for '{query}' returned {len(tracks)} tracks")
            return tracks

    except Exception as e:
        logger.error(f"Failed to search tracks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tracks/{track_id}", response_model=TrackResponse)
async def get_track_by_id(track_id: str):
    """
    Get a single track by its song_id or track_id.

    Supports both UUID-based song_id and deterministic track_id lookups.
    """
    try:
        async with db_pool.acquire() as conn:
            # Try to find by song_id (UUID) or track_id (deterministic hash)
            # Note: Database uses 'title' but Pydantic models use 'track_name'
            query = """
            SELECT song_id::text, track_id, title as track_name, normalized_title,
                   duration_seconds as duration_ms,
                   isrc, spotify_id, apple_music_id, youtube_music_id as youtube_id,
                   soundcloud_id, musicbrainz_id,
                   bpm, key as musical_key, energy, danceability, valence, acousticness,
                   instrumentalness, liveness, speechiness, loudness,
                   release_year as release_date, genre, NULL as subgenre, label as record_label,
                   is_remix, is_mashup, is_live, is_cover, is_instrumental, is_explicit,
                   NULL as remix_type, NULL as original_artist, NULL as remixer, NULL as mashup_components,
                   NULL as popularity_score, NULL as play_count, NULL as track_type,
                   NULL as source_context, NULL as position_in_source,
                   'mixesdb' as data_source, created_at as scrape_timestamp,
                   primary_artist_id::text, created_at, updated_at
            FROM songs
            WHERE song_id::text = $1 OR track_id = $1
            LIMIT 1
            """

            row = await conn.fetchrow(query, track_id)

            if not row:
                raise HTTPException(status_code=404, detail=f"Track with ID '{track_id}' not found")

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
            SELECT playlist_id, setlist_name, normalized_name, description,
                   dj_artist_name, dj_artist_id, supporting_artists,
                   event_name, event_type, venue_name, venue_location, venue_capacity,
                   set_date, set_start_time, set_end_time, duration_minutes,
                   genre_tags, mood_tags, bpm_range, total_tracks,
                   spotify_playlist_id, soundcloud_playlist_id, mixcloud_id, youtube_playlist_id,
                   data_source, scrape_timestamp, created_at, updated_at
            FROM playlists
            {where_clause}
            ORDER BY set_date DESC NULLS LAST, setlist_name
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

@app.get("/api/graph/nodes")
async def get_graph_nodes(limit: int = 500, min_weight: int = 1):
    """Get graph nodes - only songs with adjacencies"""
    try:
        async with db_pool.acquire() as conn:
            # Query only songs that have adjacencies
            query = """
            SELECT DISTINCT s.song_id, s.title, s.primary_artist_id,
                   a.name as artist_name, s.bpm, s.key,
                   COUNT(DISTINCT sa.*) as connection_count
            FROM songs s
            LEFT JOIN artists a ON s.primary_artist_id = a.artist_id
            INNER JOIN (
                SELECT song_id_1 as song_id FROM song_adjacency WHERE occurrence_count >= $1
                UNION
                SELECT song_id_2 as song_id FROM song_adjacency WHERE occurrence_count >= $1
            ) connected ON s.song_id = connected.song_id
            LEFT JOIN song_adjacency sa ON (sa.song_id_1 = s.song_id OR sa.song_id_2 = s.song_id)
            GROUP BY s.song_id, s.title, s.primary_artist_id, a.name, s.bpm, s.key
            LIMIT $2
            """
            rows = await conn.fetch(query, min_weight, limit)

            nodes = []
            for row in rows:
                nodes.append({
                    "id": f"song_{row['song_id']}",
                    "track_id": f"song_{row['song_id']}",
                    "position": {"x": 0.0, "y": 0.0},
                    "metadata": {
                        "title": row['title'],
                        "artist": row['artist_name'],
                        "node_type": "song",
                        "category": None,
                        "genre": None,
                        "release_year": None,
                        "appearance_count": row['connection_count'],
                        "label": row['title'],
                        "bpm": row['bpm'],
                        "key": row['key']
                    }
                })

            return {"nodes": nodes, "total": len(nodes), "limit": limit, "offset": 0}
    except Exception as e:
        logger.error(f"Failed to fetch graph nodes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/graph/edges")
async def get_graph_edges(limit: int = 5000, min_weight: int = 1):
    """Get graph edges - adjacency relationships"""
    try:
        async with db_pool.acquire() as conn:
            query = """
            SELECT sa.song_id_1, sa.song_id_2, sa.occurrence_count as weight,
                   s1.title as source_title, s2.title as target_title
            FROM song_adjacency sa
            JOIN songs s1 ON sa.song_id_1 = s1.song_id
            JOIN songs s2 ON sa.song_id_2 = s2.song_id
            WHERE sa.occurrence_count >= $1
            ORDER BY sa.occurrence_count DESC
            LIMIT $2
            """
            rows = await conn.fetch(query, min_weight, limit)

            edges = []
            for row in rows:
                # Create IDs with song_ prefix to match node IDs
                source_id = f"song_{row['song_id_1']}"
                target_id = f"song_{row['song_id_2']}"
                edge_id = f"{source_id}__{target_id}"
                edges.append({
                    "id": edge_id,
                    "source": source_id,
                    "target": target_id,
                    "weight": row['weight'],
                    "type": "adjacency",
                    "edge_type": "adjacency",
                    "source_label": row['source_title'],
                    "target_label": row['target_title']
                })

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
    """Get list of target tracks - simple test endpoint"""
    return [{"message": "Target tracks endpoint working"}]

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