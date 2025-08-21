"""REST API Service for SongNodes"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import os
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SongNodes REST API",
    description="Main REST API for music data operations",
    version="1.0.0"
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
class Artist(BaseModel):
    id: Optional[int] = None
    name: str
    genre: Optional[str] = None
    popularity: Optional[float] = None
    created_at: Optional[datetime] = None

class Track(BaseModel):
    id: Optional[int] = None
    title: str
    artist_id: int
    duration: Optional[int] = None
    bpm: Optional[float] = None
    key: Optional[str] = None

class Mix(BaseModel):
    id: Optional[int] = None
    name: str
    dj_id: int
    date: Optional[datetime] = None
    venue: Optional[str] = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "rest-api",
        "version": "1.0.0",
        "database": "connected"  # Placeholder
    }

@app.get("/api/v1/artists", response_model=List[Artist])
async def get_artists(limit: int = 100, offset: int = 0):
    """Get list of artists"""
    try:
        # Placeholder data
        return [
            Artist(id=1, name="Example Artist 1", genre="Electronic"),
            Artist(id=2, name="Example Artist 2", genre="House")
        ]
    except Exception as e:
        logger.error(f"Failed to fetch artists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/artists/{artist_id}", response_model=Artist)
async def get_artist(artist_id: int):
    """Get specific artist by ID"""
    try:
        return Artist(
            id=artist_id,
            name=f"Artist {artist_id}",
            genre="Electronic",
            popularity=0.85
        )
    except Exception as e:
        logger.error(f"Failed to fetch artist {artist_id}: {str(e)}")
        raise HTTPException(status_code=404, detail="Artist not found")

@app.get("/api/v1/tracks", response_model=List[Track])
async def get_tracks(artist_id: Optional[int] = None, limit: int = 100):
    """Get list of tracks"""
    try:
        tracks = [
            Track(id=1, title="Track 1", artist_id=1, bpm=128),
            Track(id=2, title="Track 2", artist_id=1, bpm=125)
        ]
        if artist_id:
            tracks = [t for t in tracks if t.artist_id == artist_id]
        return tracks
    except Exception as e:
        logger.error(f"Failed to fetch tracks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/mixes", response_model=List[Mix])
async def get_mixes(dj_id: Optional[int] = None, limit: int = 100):
    """Get list of DJ mixes"""
    try:
        return [
            Mix(id=1, name="Summer Mix 2024", dj_id=1, venue="Club XYZ"),
            Mix(id=2, name="Festival Set", dj_id=2, venue="Festival ABC")
        ]
    except Exception as e:
        logger.error(f"Failed to fetch mixes: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/graph/nodes")
async def get_graph_nodes():
    """Get graph visualization nodes"""
    try:
        return {
            "nodes": [
                {"id": "artist1", "label": "Artist 1", "type": "artist", "size": 30},
                {"id": "artist2", "label": "Artist 2", "type": "artist", "size": 25},
                {"id": "track1", "label": "Track 1", "type": "track", "size": 15}
            ],
            "links": [
                {"source": "artist1", "target": "track1", "type": "performed"},
                {"source": "artist1", "target": "artist2", "type": "collaborated"}
            ]
        }
    except Exception as e:
        logger.error(f"Failed to fetch graph data: {str(e)}")
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)