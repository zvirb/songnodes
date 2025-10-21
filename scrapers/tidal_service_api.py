"""
FastAPI service for Tidal music integration
Provides endpoints for authentication, playlist creation, and track availability checking

This file uses the modern pipelines.persistence_pipeline.PersistencePipeline architecture.
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
import asyncio
import logging
import os
import json
from contextlib import asynccontextmanager

from tidal_api_client import (
    TidalAPIClient,
    TidalCredentials,
    TidalTrack,
    TidalPlaylist,
    create_tidal_client,
    test_tidal_oauth
)
from pipelines.persistence_pipeline import PersistencePipeline

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global client instance
tidal_client: Optional[TidalAPIClient] = None
db_pipeline: Optional[PersistencePipeline] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global tidal_client, db_pipeline

    # Startup
    try:
        db_pipeline = PersistencePipeline()
        tidal_client = create_tidal_client(db_pipeline)
        logger.info("Tidal service initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Tidal service: {e}")

    yield

    # Shutdown
    if db_pipeline:
        await db_pipeline.close()
    logger.info("Tidal service shutdown")

app = FastAPI(
    title="Tidal Music Service",
    description="SongNodes integration with Tidal music streaming service",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8088"],  # Common dev server ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for API requests/responses

class TidalAuthRequest(BaseModel):
    """Request to start OAuth flow"""
    pass

class TidalOAuthStartResponse(BaseModel):
    success: bool
    authenticated: bool = False
    auth_url: Optional[str] = None
    user_code: Optional[str] = None
    device_code: Optional[str] = None
    expires_in: Optional[int] = None
    message: str
    instructions: Optional[str] = None

class TidalAuthResponse(BaseModel):
    success: bool
    message: str
    user_id: Optional[str] = None
    expires_at: Optional[datetime] = None

class TrackSearchRequest(BaseModel):
    query: str = Field(..., description="Search query (artist - track, ISRC, etc.)")
    limit: int = Field(50, ge=1, le=100, description="Maximum number of results")

class TrackAvailabilityRequest(BaseModel):
    song_id: str = Field(..., description="Song ID from SongNodes database")
    artist: str = Field(..., description="Artist name")
    title: str = Field(..., description="Track title")
    isrc: Optional[str] = Field(None, description="ISRC code if available")

class PlaylistCreateRequest(BaseModel):
    name: str = Field(..., description="Playlist name")
    description: str = Field("", description="Playlist description")
    public: bool = Field(False, description="Whether playlist should be public")

class PlaylistFromSetlistRequest(BaseModel):
    setlist_id: str = Field(..., description="SongNodes setlist ID")
    playlist_name: str = Field(..., description="Name for the new Tidal playlist")
    track_ids: List[str] = Field(..., description="List of track IDs from setlist")

class BulkAvailabilityRequest(BaseModel):
    limit: int = Field(100, ge=1, le=500, description="Maximum number of tracks to check")

class TidalTrackResponse(BaseModel):
    id: int
    name: str
    artist: str
    album: str
    duration: int
    isrc: Optional[str] = None
    explicit: bool = False
    available: bool = True
    url: Optional[str] = None

class TidalPlaylistResponse(BaseModel):
    id: str
    name: str
    description: str
    track_count: int
    duration: int
    public: bool = False
    url: Optional[str] = None
    created_at: Optional[datetime] = None

class OperationResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None

# API Endpoints

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    global tidal_client

    status = "healthy"
    details = {
        "service": "tidal",
        "authenticated": tidal_client._authenticated if tidal_client else False,
        "timestamp": datetime.now().isoformat()
    }

    return {
        "status": status,
        "details": details
    }

@app.post("/auth/start-oauth", response_model=TidalOAuthStartResponse)
async def start_tidal_oauth():
    """
    Start OAuth authentication flow with Tidal
    """
    if not tidal_client:
        raise HTTPException(status_code=503, detail="Tidal service not initialized")

    try:
        result = await tidal_client.start_oauth_flow()

        if result.get("success"):
            return TidalOAuthStartResponse(
                success=True,
                authenticated=result.get("authenticated", False),
                auth_url=result.get("auth_url"),
                user_code=result.get("user_code"),
                device_code=result.get("device_code"),
                expires_in=result.get("expires_in"),
                message=result.get("message", ""),
                instructions=result.get("instructions")
            )
        else:
            return TidalOAuthStartResponse(
                success=False,
                message=result.get("message", "Failed to start OAuth flow")
            )

    except Exception as e:
        logger.error(f"OAuth start error: {e}")
        raise HTTPException(status_code=500, detail=f"OAuth error: {str(e)}")

@app.post("/auth/check-oauth", response_model=TidalAuthResponse)
async def check_oauth_completion():
    """
    Check if OAuth authentication has been completed
    """
    if not tidal_client:
        raise HTTPException(status_code=503, detail="Tidal service not initialized")

    try:
        result = await tidal_client.check_oauth_completion()

        return TidalAuthResponse(
            success=result.get("success", False),
            message=result.get("message", ""),
            user_id=result.get("user_id"),
            expires_at=None  # OAuth tokens have their own expiration handling
        )

    except Exception as e:
        logger.error(f"OAuth check error: {e}")
        raise HTTPException(status_code=500, detail=f"OAuth check error: {str(e)}")

@app.post("/auth/test-oauth")
async def test_oauth_capability():
    """
    Test OAuth capability without full authentication
    """
    try:
        # Just test that we can initialize a session
        result = await test_tidal_oauth()

        return {
            "oauth_available": True,
            "message": "OAuth authentication is available"
        }
    except Exception as e:
        logger.error(f"OAuth test error: {e}")
        return {
            "oauth_available": False,
            "message": f"OAuth not available: {str(e)}"
        }

@app.get("/auth/status")
async def auth_status():
    """
    Check current authentication status
    """
    if not tidal_client:
        return {"authenticated": False, "message": "Service not initialized"}

    try:
        status = await tidal_client.get_auth_status()
        return status
    except Exception as e:
        logger.error(f"Error checking auth status: {e}")
        return {"authenticated": False, "message": f"Error checking status: {str(e)}"}

@app.post("/tracks/search", response_model=List[TidalTrackResponse])
async def search_tracks(request: TrackSearchRequest):
    """
    Search for tracks on Tidal
    """
    if not tidal_client or not tidal_client._authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated with Tidal")

    try:
        tracks = await tidal_client.search_tracks(request.query, request.limit)

        return [
            TidalTrackResponse(
                id=track.id,
                name=track.name,
                artist=track.artist,
                album=track.album,
                duration=track.duration,
                isrc=track.isrc,
                explicit=track.explicit,
                available=track.available,
                url=track.url
            )
            for track in tracks
        ]
    except Exception as e:
        logger.error(f"Track search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

@app.post("/tracks/check-availability", response_model=Optional[TidalTrackResponse])
async def check_track_availability(request: TrackAvailabilityRequest):
    """
    Check if a specific track is available on Tidal
    """
    if not tidal_client or not tidal_client._authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated with Tidal")

    try:
        song_data = {
            "id": request.song_id,
            "artist": request.artist,
            "title": request.title,
            "isrc": request.isrc
        }

        tidal_track = await tidal_client.check_track_availability(song_data)

        if tidal_track:
            return TidalTrackResponse(
                id=tidal_track.id,
                name=tidal_track.name,
                artist=tidal_track.artist,
                album=tidal_track.album,
                duration=tidal_track.duration,
                isrc=tidal_track.isrc,
                explicit=tidal_track.explicit,
                available=tidal_track.available,
                url=tidal_track.url
            )
        else:
            return None

    except Exception as e:
        logger.error(f"Availability check error: {e}")
        raise HTTPException(status_code=500, detail=f"Availability check error: {str(e)}")

@app.post("/tracks/bulk-availability-check")
async def bulk_availability_check(background_tasks: BackgroundTasks, request: BulkAvailabilityRequest):
    """
    Start bulk availability check for tracks in database
    """
    if not tidal_client or not tidal_client._authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated with Tidal")

    async def run_bulk_check():
        try:
            result = await tidal_client.bulk_check_availability(request.limit)
            logger.info(f"Bulk availability check completed: {result}")
        except Exception as e:
            logger.error(f"Bulk availability check error: {e}")

    background_tasks.add_task(run_bulk_check)

    return {
        "message": f"Started bulk availability check for {request.limit} tracks",
        "status": "running"
    }

@app.get("/tracks/bulk-availability-status")
async def get_bulk_availability_status():
    """
    Get status of the most recent bulk availability check
    """
    # This would typically query a background task status
    # For now, return basic info
    return {
        "status": "completed",
        "message": "Check individual track endpoints for detailed availability"
    }

@app.post("/playlists/create", response_model=TidalPlaylistResponse)
async def create_playlist(request: PlaylistCreateRequest):
    """
    Create a new playlist on Tidal
    """
    if not tidal_client or not tidal_client._authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated with Tidal")

    try:
        playlist = await tidal_client.create_playlist(
            request.name,
            request.description,
            request.public
        )

        if playlist:
            return TidalPlaylistResponse(
                id=playlist.id,
                name=playlist.name,
                description=playlist.description,
                track_count=playlist.track_count,
                duration=playlist.duration,
                public=playlist.public,
                url=playlist.url,
                created_at=playlist.created_at
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to create playlist")

    except Exception as e:
        logger.error(f"Playlist creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Playlist creation error: {str(e)}")

@app.get("/playlists/list", response_model=List[TidalPlaylistResponse])
async def list_user_playlists():
    """
    Get user's playlists from Tidal
    """
    if not tidal_client or not tidal_client._authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated with Tidal")

    try:
        playlists = await tidal_client.get_user_playlists()

        return [
            TidalPlaylistResponse(
                id=playlist.id,
                name=playlist.name,
                description=playlist.description,
                track_count=playlist.track_count,
                duration=playlist.duration,
                public=playlist.public,
                url=playlist.url,
                created_at=playlist.created_at
            )
            for playlist in playlists
        ]
    except Exception as e:
        logger.error(f"Playlist list error: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting playlists: {str(e)}")

@app.post("/playlists/from-setlist", response_model=TidalPlaylistResponse)
async def create_playlist_from_setlist(request: PlaylistFromSetlistRequest):
    """
    Create a Tidal playlist from a SongNodes setlist
    """
    if not tidal_client or not tidal_client._authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated with Tidal")

    try:
        # Get setlist tracks from database
        if not db_pipeline:
            raise HTTPException(status_code=503, detail="Database not available")

        # Query to get track details for the setlist
        from sqlalchemy import text
        query = text("""
            SELECT s.id, s.artist, s.title, s.isrc, st.position
            FROM songs s
            JOIN setlist_tracks st ON s.id = st.track_id
            WHERE st.setlist_id = :setlist_id
            ORDER BY st.position
        """)

        tracks_data = await db_pipeline.fetch_all(query, {'setlist_id': request.setlist_id})

        if not tracks_data:
            raise HTTPException(status_code=404, detail="Setlist not found or empty")

        # Convert to format expected by tidal client
        setlist_tracks = [
            {
                "id": track["id"],
                "artist": track["artist"],
                "title": track["title"],
                "isrc": track["isrc"]
            }
            for track in tracks_data
        ]

        playlist = await tidal_client.create_setlist_playlist(setlist_tracks, request.playlist_name)

        if playlist:
            return TidalPlaylistResponse(
                id=playlist.id,
                name=playlist.name,
                description=playlist.description,
                track_count=playlist.track_count,
                duration=playlist.duration,
                public=playlist.public,
                url=playlist.url,
                created_at=playlist.created_at
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to create playlist from setlist")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Setlist playlist creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating playlist from setlist: {str(e)}")

@app.post("/playlists/{playlist_id}/add-tracks")
async def add_tracks_to_playlist(playlist_id: str, track_ids: List[int]):
    """
    Add tracks to an existing Tidal playlist
    """
    if not tidal_client or not tidal_client._authenticated:
        raise HTTPException(status_code=401, detail="Not authenticated with Tidal")

    try:
        success = await tidal_client.add_tracks_to_playlist(playlist_id, track_ids)

        if success:
            return OperationResponse(
                success=True,
                message=f"Added {len(track_ids)} tracks to playlist",
                data={"playlist_id": playlist_id, "tracks_added": len(track_ids)}
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to add tracks to playlist")

    except Exception as e:
        logger.error(f"Add tracks error: {e}")
        raise HTTPException(status_code=500, detail=f"Error adding tracks: {str(e)}")

@app.get("/stats/availability")
async def get_availability_stats():
    """
    Get statistics about track availability on Tidal
    """
    try:
        if not db_pipeline:
            raise HTTPException(status_code=503, detail="Database not available")

        from sqlalchemy import text

        # Get total songs and those with Tidal IDs
        stats_query = text("""
            SELECT
                COUNT(*) as total_songs,
                COUNT(tidal_id) as songs_on_tidal,
                COUNT(*) - COUNT(tidal_id) as songs_not_on_tidal
            FROM songs
        """)

        result = await db_pipeline.fetch_one(stats_query)

        if result:
            total = result["total_songs"]
            on_tidal = result["songs_on_tidal"]
            not_on_tidal = result["songs_not_on_tidal"]

            return {
                "total_songs": total,
                "available_on_tidal": on_tidal,
                "not_available": not_on_tidal,
                "availability_percentage": (on_tidal / total * 100) if total > 0 else 0
            }
        else:
            return {"error": "No data available"}

    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")

# Error handlers
@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}")
    return {
        "error": "Internal server error",
        "detail": str(exc) if os.getenv("DEBUG") == "true" else "An unexpected error occurred"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8085)
