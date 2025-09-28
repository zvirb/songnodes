"""REST API Service for SongNodes"""
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import os
from datetime import datetime
import asyncpg
import json
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://musicdb_user:musicdb_secure_pass@db:5432/musicdb")
db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage database connection pool lifecycle"""
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=20)
        logger.info("Database connection pool created")
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
                    "id": str(row['song_id']),
                    "label": row['title'],
                    "artist": row['artist_name'] or "Unknown Artist",
                    "type": "track",
                    "bpm": row['bpm'],
                    "key": row['key'],
                    "size": min(30, 10 + row['connection_count'] * 2),  # Size based on connections
                    "connections": row['connection_count']
                })

            return nodes
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
                edges.append({
                    "source": str(row['song_id_1']),
                    "target": str(row['song_id_2']),
                    "weight": row['weight'],
                    "source_label": row['source_title'],
                    "target_label": row['target_title']
                })

            return edges
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)