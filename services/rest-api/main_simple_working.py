"""Simple Working REST API Service for SongNodes - Target Tracks Testing"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging
from datetime import datetime
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SongNodes REST API - Working Test Version",
    description="Working test version for target tracks functionality",
    version="2.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class TargetTrack(BaseModel):
    track_id: Optional[str] = None
    title: str
    artist: str
    priority: str = "medium"
    search_terms: Optional[List[str]] = []
    genres: Optional[List[str]] = []
    is_active: bool = True
    last_searched: Optional[str] = None
    playlists_found: Optional[int] = 0
    adjacencies_found: Optional[int] = 0

# In-memory storage (mock database)
mock_target_tracks = [
    {
        "track_id": "1",
        "title": "FISHER - Losing It",
        "artist": "FISHER",
        "priority": "high",
        "search_terms": ["losing it", "fisher", "tech house"],
        "genres": ["Tech House", "Electronic"],
        "is_active": True,
        "last_searched": "2025-09-27T10:30:00",
        "playlists_found": 15,
        "adjacencies_found": 45
    },
    {
        "track_id": "2",
        "title": "Intec",
        "artist": "Carl Cox",
        "priority": "high",
        "search_terms": ["intec", "carl cox", "techno"],
        "genres": ["Techno", "Electronic"],
        "is_active": True,
        "last_searched": "2025-09-26T14:20:00",
        "playlists_found": 8,
        "adjacencies_found": 23
    },
    {
        "track_id": "3",
        "title": "One More Time",
        "artist": "Daft Punk",
        "priority": "medium",
        "search_terms": ["one more time", "daft punk", "french house"],
        "genres": ["French House", "Electronic"],
        "is_active": True,
        "last_searched": None,
        "playlists_found": 0,
        "adjacencies_found": 0
    }
]

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "rest-api-simple-working",
        "version": "2.1.0",
        "database": "mock_storage"
    }

@app.get("/api/v1/target-tracks", response_model=List[TargetTrack])
async def get_target_tracks():
    """Get all target tracks"""
    logger.info("Fetching target tracks from mock storage")
    return mock_target_tracks

@app.post("/api/v1/target-tracks", response_model=TargetTrack)
async def create_target_track(track: TargetTrack):
    """Add a new target track"""
    logger.info(f"Creating target track: {track.title} by {track.artist}")

    # Generate new track ID
    new_track = track.dict()
    new_track["track_id"] = str(len(mock_target_tracks) + 1)

    # Add to mock storage
    mock_target_tracks.append(new_track)

    logger.info(f"Created track with ID: {new_track['track_id']}")
    return new_track

@app.put("/api/v1/target-tracks/{track_id}", response_model=TargetTrack)
async def update_target_track(track_id: str, track: TargetTrack):
    """Update an existing target track"""
    logger.info(f"Updating target track ID: {track_id}")

    # Find track in mock storage
    for i, existing_track in enumerate(mock_target_tracks):
        if existing_track["track_id"] == track_id:
            updated_track = track.dict()
            updated_track["track_id"] = track_id
            mock_target_tracks[i] = updated_track
            logger.info(f"Updated track: {track.title} by {track.artist}")
            return updated_track

    raise HTTPException(status_code=404, detail="Target track not found")

@app.delete("/api/v1/target-tracks/{track_id}")
async def delete_target_track(track_id: str):
    """Delete a target track"""
    logger.info(f"Deleting target track ID: {track_id}")

    # Find and remove track from mock storage
    for i, track in enumerate(mock_target_tracks):
        if track["track_id"] == track_id:
            deleted_track = mock_target_tracks.pop(i)
            logger.info(f"Deleted track: {deleted_track['title']} by {deleted_track['artist']}")
            return {"message": "Target track deleted successfully"}

    raise HTTPException(status_code=404, detail="Target track not found")

@app.post("/api/v1/target-tracks/{track_id}/search")
async def trigger_search(track_id: str):
    """Trigger search for a specific target track"""
    logger.info(f"Triggering search for target track ID: {track_id}")

    # Find track and update search timestamp
    for track in mock_target_tracks:
        if track["track_id"] == track_id:
            track["last_searched"] = datetime.now().isoformat()
            # Simulate finding some playlists and adjacencies
            track["playlists_found"] = track.get("playlists_found", 0) + 2
            track["adjacencies_found"] = track.get("adjacencies_found", 0) + 5
            logger.info(f"Search triggered for: {track['title']} by {track['artist']}")
            return {"message": "Search triggered successfully", "track": track}

    raise HTTPException(status_code=404, detail="Target track not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)