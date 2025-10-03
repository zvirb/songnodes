"""
Tidal Playlist Management Router
Handles playlist operations using Tidal API v1/v2 with OAuth access tokens
"""

from fastapi import APIRouter, HTTPException, Header, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import aiohttp
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tidal", tags=["Tidal Playlists"])

# Tidal API base URLs
TIDAL_API_V1 = "https://api.tidal.com/v1"
TIDAL_API_V2 = "https://api.tidal.com/v2"

# ===========================================
# Request/Response Models
# ===========================================

class CreatePlaylistRequest(BaseModel):
    """Request to create a new Tidal playlist"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default="", max_length=1000)
    parent_folder_id: Optional[str] = Field(default="root", description="Folder ID where playlist will be created")

class AddTracksRequest(BaseModel):
    """Request to add tracks to a playlist"""
    track_ids: List[str] = Field(..., min_items=1, description="List of Tidal track IDs")
    position: Optional[int] = Field(default=0, description="Position to insert tracks (0 = end)")
    allow_duplicates: bool = Field(default=False)

class SearchTrackRequest(BaseModel):
    """Request to search for a track on Tidal"""
    artist: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    isrc: Optional[str] = None

class PlaylistResponse(BaseModel):
    """Tidal playlist details"""
    id: str
    name: str
    description: Optional[str]
    track_count: int
    duration: int
    public: bool
    url: Optional[str]
    created_at: Optional[str]

class TrackResponse(BaseModel):
    """Tidal track details"""
    id: int
    name: str
    artist: str
    album: str
    duration: int
    isrc: Optional[str]
    explicit: bool
    available: bool
    url: Optional[str]

# ===========================================
# Helper Functions
# ===========================================

def get_auth_headers(access_token: str) -> Dict[str, str]:
    """Generate authentication headers for Tidal API requests"""
    return {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

async def get_user_id(access_token: str) -> str:
    """Get the current user's Tidal ID from their access token"""
    try:
        headers = get_auth_headers(access_token)
        async with aiohttp.ClientSession() as session:
            # Use the sessions endpoint to get current user info
            async with session.get(
                f"{TIDAL_API_V1}/sessions",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    user_id = data.get("userId")
                    if not user_id:
                        raise HTTPException(status_code=500, detail="Unable to retrieve user ID from Tidal")
                    return str(user_id)
                else:
                    error_text = await response.text()
                    logger.error(f"Failed to get user ID: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to authenticate with Tidal: {error_text[:200]}"
                    )
    except aiohttp.ClientError as e:
        logger.error(f"Network error getting user ID: {str(e)}")
        raise HTTPException(status_code=503, detail="Unable to connect to Tidal API")

# ===========================================
# Playlist Management Endpoints
# ===========================================

@router.post("/playlists/create", response_model=PlaylistResponse)
async def create_playlist(
    request: CreatePlaylistRequest,
    authorization: str = Header(..., description="Bearer token from Tidal OAuth")
):
    """
    Create a new Tidal playlist

    Requires: Bearer token in Authorization header
    """
    try:
        # Extract access token from Authorization header
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")
        headers = get_auth_headers(access_token)

        # Prepare request body for Tidal API v2
        playlist_data = {
            "name": request.name,
            "description": request.description,
            "folderId": request.parent_folder_id
        }

        logger.info(f"Creating Tidal playlist: {request.name}")

        async with aiohttp.ClientSession() as session:
            # Use v2 endpoint for playlist creation
            async with session.put(
                f"{TIDAL_API_V2}/my-collection/playlists/folders/create-playlist",
                json=playlist_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status in [200, 201]:
                    data = await response.json()

                    # Extract playlist details from response
                    playlist_id = data.get("data", {}).get("id") or data.get("id")
                    attributes = data.get("data", {}).get("attributes", {})

                    return PlaylistResponse(
                        id=str(playlist_id),
                        name=attributes.get("name", request.name),
                        description=attributes.get("description"),
                        track_count=attributes.get("numberOfTracks", 0),
                        duration=attributes.get("duration", 0),
                        public=attributes.get("publicPlaylist", False),
                        url=attributes.get("url"),
                        created_at=attributes.get("created")
                    )
                else:
                    error_text = await response.text()
                    logger.error(f"Tidal playlist creation failed: {error_text}")
                    raise HTTPException(
                        status_code=response.status,
                        detail=f"Failed to create playlist: {error_text[:200]}"
                    )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating Tidal playlist: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Playlist creation failed: {str(e)}")

@router.get("/playlists/list", response_model=List[PlaylistResponse])
async def list_playlists(
    authorization: str = Header(..., description="Bearer token from Tidal OAuth"),
    limit: int = 50,
    offset: int = 0
):
    """
    List user's Tidal playlists

    Requires: Bearer token in Authorization header
    """
    try:
        # Extract access token
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")

        # Get user ID first
        user_id = await get_user_id(access_token)
        headers = get_auth_headers(access_token)

        logger.info(f"Fetching playlists for user {user_id}")

        async with aiohttp.ClientSession() as session:
            # Use v1 endpoint for getting playlists
            async with session.get(
                f"{TIDAL_API_V1}/users/{user_id}/playlists",
                headers=headers,
                params={"limit": limit, "offset": offset},
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    items = data.get("items", [])

                    playlists = []
                    for item in items:
                        playlists.append(PlaylistResponse(
                            id=str(item.get("uuid", item.get("id", ""))),
                            name=item.get("title", "Unnamed Playlist"),
                            description=item.get("description"),
                            track_count=item.get("numberOfTracks", 0),
                            duration=item.get("duration", 0),
                            public=item.get("publicPlaylist", False),
                            url=item.get("url"),
                            created_at=item.get("created")
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
    authorization: str = Header(..., description="Bearer token from Tidal OAuth")
):
    """
    Add tracks to a Tidal playlist

    Requires: Bearer token in Authorization header
    """
    try:
        # Extract access token
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")
        headers = get_auth_headers(access_token)

        # Prepare request body
        tracks_data = {
            "onArtifactNotFound": "SKIP",
            "trackIds": ",".join(request.track_ids),
            "toIndex": request.position,
            "onDupes": "ADD" if request.allow_duplicates else "SKIP"
        }

        logger.info(f"Adding {len(request.track_ids)} tracks to playlist {playlist_id}")

        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{TIDAL_API_V1}/playlists/{playlist_id}/items",
                json=tracks_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status in [200, 201, 204]:
                    return {"success": True, "message": f"Added {len(request.track_ids)} tracks to playlist"}
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
    authorization: str = Header(..., description="Bearer token from Tidal OAuth")
):
    """
    Search for a track on Tidal by artist, title, and optionally ISRC

    Requires: Bearer token in Authorization header
    """
    try:
        # Extract access token
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")
        headers = get_auth_headers(access_token)

        # Build search query - try ISRC first if available
        if request.isrc:
            query = request.isrc
        else:
            query = f"{request.title} {request.artist}"

        logger.info(f"Searching for track: {query}")

        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{TIDAL_API_V1}/search/tracks",
                headers=headers,
                params={"query": query, "limit": 10},
                timeout=aiohttp.ClientTimeout(total=15)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    tracks = data.get("items", [])

                    # If searching by ISRC, find exact match
                    if request.isrc:
                        for track in tracks:
                            if track.get("isrc") == request.isrc:
                                return TrackResponse(
                                    id=track.get("id"),
                                    name=track.get("title"),
                                    artist=track.get("artist", {}).get("name", "Unknown"),
                                    album=track.get("album", {}).get("title", "Unknown"),
                                    duration=track.get("duration", 0),
                                    isrc=track.get("isrc"),
                                    explicit=track.get("explicit", False),
                                    available=track.get("streamReady", True),
                                    url=track.get("url")
                                )

                    # Return first result if no ISRC match
                    if tracks:
                        track = tracks[0]
                        return TrackResponse(
                            id=track.get("id"),
                            name=track.get("title"),
                            artist=track.get("artist", {}).get("name", "Unknown"),
                            album=track.get("album", {}).get("title", "Unknown"),
                            duration=track.get("duration", 0),
                            isrc=track.get("isrc"),
                            explicit=track.get("explicit", False),
                            available=track.get("streamReady", True),
                            url=track.get("url")
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
    authorization: str = Header(..., description="Bearer token from Tidal OAuth")
):
    """
    Check if a track is available on Tidal

    Requires: Bearer token in Authorization header
    """
    try:
        track = await search_track(request, authorization)

        if track:
            return {
                "available": track.available,
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
