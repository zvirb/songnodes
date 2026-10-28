"""
Tidal Playlist Management Router
Handles playlist operations using Tidal API v2 with OAuth access tokens
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging

from utils.tidal_user_api import TidalUserApi

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tidal", tags=["Tidal Playlists"])

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

        logger.info(f"Creating Tidal playlist: {request.name}")
        # Note: parent_folder_id is ignored because Tidal API v2 POST /v2/playlists does not accept a folderId

        client = TidalUserApi(access_token=access_token)
        # Using a new client object per request

        try:
            playlist_id = await client.create_playlist(request.name, request.description)

            # Since create_playlist in v2 might only return ID (or a subset of properties in the response,
            # but we just grabbed ID to stay minimal), we'll return a stubbed/partial response
            # that satisfies the frontend, as we only definitively have the ID and Name.
            return PlaylistResponse(
                id=str(playlist_id),
                name=request.name,
                description=request.description,
                track_count=0,
                duration=0,
                public=False,
                url=None,
                created_at=None
            )
        finally:
            await client.close()

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
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")

        logger.info(f"Fetching playlists")

        client = TidalUserApi(access_token=access_token)
        # Using a new client object per request

        try:
            playlists_data = await client.list_playlists(limit=limit, offset=offset)

            playlists = []
            for item in playlists_data:
                playlists.append(PlaylistResponse(
                    id=str(item.get("id", "")),
                    name=item.get("name", "Unnamed Playlist"),
                    description=item.get("description"),
                    track_count=item.get("track_count", 0),
                    duration=item.get("duration", 0),
                    public=item.get("public", False),
                    url=item.get("url"),
                    created_at=item.get("created_at")
                ))

            return playlists
        finally:
            await client.close()

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
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")

        logger.info(f"Adding {len(request.track_ids)} tracks to playlist {playlist_id}")

        client = TidalUserApi(access_token=access_token)
        # Using a new client object per request

        try:
            await client.add_tracks_in_order(playlist_id, request.track_ids, request.allow_duplicates)
            return {"success": True, "message": f"Added {len(request.track_ids)} tracks to playlist"}
        finally:
            await client.close()

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
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header format")

        access_token = authorization.replace("Bearer ", "")

        logger.info(f"Searching for track: {request.title} {request.artist} (ISRC: {request.isrc})")

        client = TidalUserApi(access_token=access_token)
        # Using a new client object per request

        try:
            track = await client.search_track(request.artist, request.title, request.isrc)

            if track:
                return TrackResponse(
                    id=track.get("id"),
                    name=track.get("name"),
                    artist=track.get("artist"),
                    album=track.get("album"),
                    duration=track.get("duration", 0),
                    isrc=track.get("isrc"),
                    explicit=track.get("explicit", False),
                    available=track.get("available", True),
                    url=track.get("url")
                )

            return None  # No tracks found

        finally:
            await client.close()

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

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking track availability: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Availability check failed: {str(e)}")


# ===========================================
# Send a whole set to TIDAL (TX1)
# ===========================================

class SendSetTrack(BaseModel):
    """One set track, in play order"""
    artist: str = ""
    title: str = ""
    tidal: Optional[str] = Field(default=None, description="TIDAL track id or URL, if already known")


class SendSetRequest(BaseModel):
    """A set to send to TIDAL as a new playlist"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default="", max_length=1000)
    tracks: List[SendSetTrack] = Field(..., min_length=1, max_length=500)


class UnmatchedTrack(BaseModel):
    position: int
    artist: str
    title: str


class SendSetResponse(BaseModel):
    playlist_id: str
    url: str
    added: int
    unmatched: List[UnmatchedTrack]


def tidal_track_id(value: Optional[str]) -> Optional[str]:
    """A TIDAL track id from a bare id or a tidal.com track URL; None otherwise."""
    if not value:
        return None
    value = str(value).strip()
    if value.isdigit():
        return value
    import re
    match = re.search(r"/track/(\d+)", value)
    return match.group(1) if match else None


@router.post("/sets/send", response_model=SendSetResponse)
async def send_set(
    request: SendSetRequest,
    authorization: Optional[str] = Header(default=None, description="Bearer token from TIDAL OAuth")
):
    """
    Create a new TIDAL playlist holding the set's tracks in play order.

    Tracks with a known TIDAL id are used as they are; the rest are searched by artist and
    title. Tracks TIDAL cannot find are returned in `unmatched` with their set position.
    """
    if not authorization or not authorization.startswith("Bearer ") or not authorization[7:].strip():
        raise HTTPException(status_code=401, detail="TIDAL is not connected. Connect it in Settings, then try again.")
    access_token = authorization[7:].strip()

    track_ids: List[str] = []
    unmatched: List[UnmatchedTrack] = []
    try:
        async with TidalUserApi(access_token=access_token) as client:
            for position, track in enumerate(request.tracks, start=1):
                tid = tidal_track_id(track.tidal)
                if tid is None and track.artist and track.title:
                    found = await client.search_track(track.artist, track.title)
                    if found and found.get("id") is not None:
                        tid = str(found["id"])
                if tid is None:
                    unmatched.append(UnmatchedTrack(position=position, artist=track.artist, title=track.title))
                else:
                    track_ids.append(tid)

            if not track_ids:
                raise HTTPException(status_code=422, detail="TIDAL found none of this set's tracks, so no playlist was made.")

            playlist_id = str(await client.create_playlist(request.name, request.description or ""))
            await client.add_tracks_in_order(playlist_id, track_ids, allow_duplicates=True)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sending set to TIDAL failed: {e.__class__.__name__}")
        raise HTTPException(status_code=502, detail="TIDAL did not accept the playlist. Try again in a minute.")

    return SendSetResponse(
        playlist_id=playlist_id,
        url=f"https://tidal.com/browse/playlist/{playlist_id}",
        added=len(track_ids),
        unmatched=unmatched,
    )
