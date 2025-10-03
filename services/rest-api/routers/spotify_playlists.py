"""
Spotify Playlist Management Router
Handles playlist operations using Spotify Web API with OAuth access tokens
"""

from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import aiohttp
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/spotify", tags=["Spotify Playlists"])

# Spotify API base URL
SPOTIFY_API_BASE = "https://api.spotify.com/v1"

# ===========================================
# Request/Response Models
# ===========================================

class CreatePlaylistRequest(BaseModel):
    """Request to create a new Spotify playlist"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default="", max_length=1000)
    public: bool = Field(default=True)
    collaborative: bool = Field(default=False)

class AddTracksRequest(BaseModel):
    """Request to add tracks to a playlist"""
    track_ids: List[str] = Field(..., min_items=1, max_items=100, description="List of Spotify track IDs (max 100)")
    position: Optional[int] = Field(default=None, description="Position to insert tracks (None = append)")

class SearchTrackRequest(BaseModel):
    """Request to search for a track on Spotify"""
    artist: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    isrc: Optional[str] = None

class PlaylistResponse(BaseModel):
    """Spotify playlist details"""
    id: str
    name: str
    description: Optional[str]
    track_count: int
    public: bool
    collaborative: bool
    url: Optional[str]
    snapshot_id: Optional[str]

class TrackResponse(BaseModel):
    """Spotify track details"""
    id: str
    name: str
    artist: str
    album: str
    duration_ms: int
    isrc: Optional[str]
    explicit: bool
    uri: str
    url: Optional[str]

# ===========================================
# Helper Functions
# ===========================================

def get_auth_headers(access_token: str) -> Dict[str, str]:
    """Generate authentication headers for Spotify API requests"""
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

async def get_current_user(access_token: str) -> Dict[str, Any]:
    """Get the current user's Spotify profile including user ID"""
    try:
        headers = get_auth_headers(access_token)
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{SPOTIFY_API_BASE}/me",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    user_data = await response.json()
                    return user_data
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to get user profile: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to authenticate with Spotify: {error_text[:200]}"
                    )
    except aiohttp.ClientError as e:
        logger.error(f"Network error getting user profile: {str(e)}")
        raise HTTPException(status_code=503, detail="Unable to connect to Spotify API")

# ===========================================
# Playlist Management Endpoints
# ===========================================

@router.post("/playlists/create", response_model=PlaylistResponse)
async def create_playlist(
    request: CreatePlaylistRequest,
    authorization: str = Header(..., description="Bearer token from Spotify OAuth")
):
    """
    Create a new Spotify playlist

    Requires: Bearer token in Authorization header
    Scopes: playlist-modify-public or playlist-modify-private
    """
    try:
        # Extract access token from Authorization header
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")

        # Get current user to obtain user ID
        user = await get_current_user(access_token)
        user_id = user.get("id")

        if not user_id:
            raise HTTPException(status_code=500, detail="Could not retrieve user ID from Spotify")

        headers = get_auth_headers(access_token)

        # Prepare request body for Spotify API
        playlist_data = {
            "name": request.name,
            "description": request.description,
            "public": request.public,
            "collaborative": request.collaborative
        }

        logger.info(f"Creating Spotify playlist: {request.name} for user {user_id}")

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{SPOTIFY_API_BASE}/users/{user_id}/playlists",
                json=playlist_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status in [200, 201]:
                    data = await response.json()

                    return PlaylistResponse(
                        id=data.get("id"),
                        name=data.get("name", request.name),
                        description=data.get("description"),
                        track_count=data.get("tracks", {}).get("total", 0),
                        public=data.get("public", request.public),
                        collaborative=data.get("collaborative", request.collaborative),
                        url=data.get("external_urls", {}).get("spotify"),
                        snapshot_id=data.get("snapshot_id")
                    )
                else:
                    error_text = await response.text()
                    logger.error(f"Spotify playlist creation failed: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to create playlist: {error_text[:200]}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Spotify playlist: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Playlist creation failed: {str(e)}")

@router.get("/playlists/list", response_model=List[PlaylistResponse])
async def list_playlists(
    authorization: str = Header(..., description="Bearer token from Spotify OAuth"),
    limit: int = 50,
    offset: int = 0
):
    """
    List current user's Spotify playlists

    Requires: Bearer token in Authorization header
    Scopes: playlist-read-private, playlist-read-collaborative
    """
    try:
        # Extract access token
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")
        headers = get_auth_headers(access_token)

        logger.info(f"Fetching Spotify playlists (limit: {limit}, offset: {offset})")

        async with aiohttp.ClientSession() as session:
            # Use /me/playlists endpoint
            async with session.get(
                f"{SPOTIFY_API_BASE}/me/playlists",
                headers=headers,
                params={"limit": min(limit, 50), "offset": offset},
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    items = data.get("items", [])

                    playlists = []
                    for item in items:
                        playlists.append(PlaylistResponse(
                            id=item.get("id", ""),
                            name=item.get("name", "Unnamed Playlist"),
                            description=item.get("description"),
                            track_count=item.get("tracks", {}).get("total", 0),
                            public=item.get("public", True),
                            collaborative=item.get("collaborative", False),
                            url=item.get("external_urls", {}).get("spotify"),
                            snapshot_id=item.get("snapshot_id")
                        ))

                    return playlists
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to fetch playlists: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to fetch playlists: {error_text[:200]}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching playlists: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch playlists: {str(e)}")

@router.post("/playlists/{playlist_id}/tracks")
async def add_tracks_to_playlist(
    playlist_id: str,
    request: AddTracksRequest,
    authorization: str = Header(..., description="Bearer token from Spotify OAuth")
):
    """
    Add tracks to a Spotify playlist

    Requires: Bearer token in Authorization header
    Scopes: playlist-modify-public or playlist-modify-private
    Note: Maximum 100 tracks per request
    """
    try:
        # Extract access token
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")
        headers = get_auth_headers(access_token)

        # Convert track IDs to Spotify URIs
        track_uris = [f"spotify:track:{track_id}" for track_id in request.track_ids]

        # Prepare request body
        tracks_data = {
            "uris": track_uris
        }

        # Add position if specified
        if request.position is not None:
            tracks_data["position"] = request.position

        logger.info(f"Adding {len(track_uris)} tracks to Spotify playlist {playlist_id}")

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks",
                json=tracks_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status in [200, 201]:
                    data = await response.json()
                    return {
                        "success": True,
                        "message": f"Added {len(track_uris)} tracks to playlist",
                        "snapshot_id": data.get("snapshot_id")
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to add tracks: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to add tracks: {error_text[:200]}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding tracks to playlist: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add tracks: {str(e)}")

@router.post("/tracks/search", response_model=Optional[TrackResponse])
async def search_track(
    request: SearchTrackRequest,
    authorization: str = Header(..., description="Bearer token from Spotify OAuth")
):
    """
    Search for a track on Spotify by artist, title, and optionally ISRC

    Requires: Bearer token in Authorization header
    """
    try:
        # Extract access token
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")
        headers = get_auth_headers(access_token)

        # Build search query - try ISRC first if available (most accurate)
        if request.isrc:
            query = f"isrc:{request.isrc}"
        else:
            # Clean and format the search query
            query = f"track:{request.title} artist:{request.artist}"

        logger.info(f"Searching Spotify for track: {query}")

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{SPOTIFY_API_BASE}/search",
                headers=headers,
                params={
                    "q": query,
                    "type": "track",
                    "limit": 10
                },
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    tracks = data.get("tracks", {}).get("items", [])

                    if tracks:
                        track = tracks[0]  # Return the best match

                        # Get artist name (first artist)
                        artists = track.get("artists", [])
                        artist_name = artists[0].get("name", "Unknown") if artists else "Unknown"

                        return TrackResponse(
                            id=track.get("id"),
                            name=track.get("name"),
                            artist=artist_name,
                            album=track.get("album", {}).get("name", "Unknown"),
                            duration_ms=track.get("duration_ms", 0),
                            isrc=track.get("external_ids", {}).get("isrc"),
                            explicit=track.get("explicit", False),
                            uri=track.get("uri", ""),
                            url=track.get("external_urls", {}).get("spotify")
                        )

                    return None  # No tracks found

                else:
                    error_text = await response.text()
                    logger.error(f"Track search failed: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Track search failed: {error_text[:200]}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching for track: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Track search failed: {str(e)}")

@router.post("/tracks/check-availability")
async def check_track_availability(
    request: SearchTrackRequest,
    authorization: str = Header(..., description="Bearer token from Spotify OAuth")
):
    """
    Check if a track is available on Spotify

    Requires: Bearer token in Authorization header
    """
    try:
        track = await search_track(request, authorization)

        if track:
            return {
                "available": True,
                "track": track
            }
        else:
            return {
                "available": False,
                "track": None
            }

    except Exception as e:
        logger.error(f"Error checking track availability: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Availability check failed: {str(e)}")
