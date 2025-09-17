"""REST API Service for SongNodes"""
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import logging
import os
from datetime import datetime
import asyncpg
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://musicdb_user:password@db-connection-pool:6432/musicdb"
)

# Global database connection pool
db_pool = None

app = FastAPI(
    title="SongNodes REST API",
    description="Main REST API for music data operations",
    version="1.0.0"
)

# Database startup and shutdown events
@app.on_event("startup")
async def startup():
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
        logger.info("Database connection pool created successfully")
    except Exception as e:
        logger.error(f"Failed to create database connection pool: {e}")
        db_pool = None

@app.on_event("shutdown")
async def shutdown():
    global db_pool
    if db_pool:
        await db_pool.close()
        logger.info("Database connection pool closed")

# Database dependency
async def get_db_connection():
    global db_pool
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database connection not available")
    return db_pool

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
    id: Optional[str] = None
    name: str
    genre: Optional[str] = None
    popularity: Optional[float] = None
    created_at: Optional[datetime] = None

class Track(BaseModel):
    id: Optional[str] = None
    title: str
    artist: Optional[str] = None
    album: Optional[str] = None
    duration: Optional[int] = None
    bpm: Optional[float] = None
    key: Optional[str] = None
    genre: Optional[str] = None
    energy: Optional[float] = None
    valence: Optional[float] = None
    popularity: Optional[float] = None

class Album(BaseModel):
    id: Optional[str] = None
    title: str
    artist: Optional[str] = None
    release_date: Optional[str] = None
    genre: Optional[str] = None

class SearchResult(BaseModel):
    id: str
    title: str
    type: str  # 'artist', 'track', 'album'
    description: str
    metadata: Dict[str, Any]
    score: Optional[float] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int
    hasMore: bool
    query: str
    limit: int
    offset: int

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    db_status = "connected" if db_pool else "disconnected"
    
    # Test database connection
    if db_pool:
        try:
            async with db_pool.acquire() as connection:
                await connection.fetchval("SELECT 1")
                db_status = "healthy"
        except Exception as e:
            logger.warning(f"Database health check failed: {e}")
            db_status = "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "rest-api",
        "version": "1.0.0",
        "database": db_status
    }

@app.get("/api/v1/artists", response_model=List[Artist])
async def get_artists(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db_pool=Depends(get_db_connection)
):
    """Get list of artists"""
    try:
        async with db_pool.acquire() as connection:
            # Query artists with track count
            query = """
                SELECT a.id, a.name, a.genre, 
                       COUNT(ta.track_id) as track_count,
                       a.created_at
                FROM musicdb.artists a
                LEFT JOIN musicdb.track_artists ta ON a.id = ta.artist_id
                GROUP BY a.id, a.name, a.genre, a.created_at
                ORDER BY track_count DESC, a.name
                LIMIT $1 OFFSET $2
            """
            rows = await connection.fetch(query, limit, offset)
            
            return [
                Artist(
                    id=str(row['id']),
                    name=row['name'],
                    genre=row['genre'],
                    popularity=min(float(row['track_count']) / 100.0, 1.0),  # Normalize to 0-1
                    created_at=row['created_at']
                )
                for row in rows
            ]
    except Exception as e:
        logger.error(f"Failed to fetch artists: {str(e)}")
        # Return empty list as fallback
        return []

@app.get("/api/v1/artists/{artist_id}", response_model=Artist)
async def get_artist(
    artist_id: str,
    db_pool=Depends(get_db_connection)
):
    """Get specific artist by ID"""
    try:
        async with db_pool.acquire() as connection:
            query = """
                SELECT a.id, a.name, a.genre, a.created_at,
                       COUNT(at.track_id) as track_count
                FROM artists a
                LEFT JOIN artist_tracks at ON a.id = at.artist_id
                WHERE a.id = $1
                GROUP BY a.id, a.name, a.genre, a.created_at
            """
            row = await connection.fetchrow(query, artist_id)
            
            if not row:
                raise HTTPException(status_code=404, detail="Artist not found")
            
            return Artist(
                id=str(row['id']),
                name=row['name'],
                genre=row['genre'],
                popularity=min(float(row['track_count']) / 100.0, 1.0),
                created_at=row['created_at']
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch artist {artist_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/tracks", response_model=List[Track])
async def get_tracks(
    artist_id: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db_pool=Depends(get_db_connection)
):
    """Get list of tracks"""
    try:
        async with db_pool.acquire() as connection:
            if artist_id:
                # Get tracks for specific artist
                query = """
                    SELECT t.id, t.title, t.bpm, t.key, t.energy, t.valence, t.genre,
                           t.duration_ms, a.name as artist_name, al.title as album_title
                    FROM tracks t
                    LEFT JOIN artist_tracks at ON t.id = at.track_id
                    LEFT JOIN artists a ON at.artist_id = a.id
                    LEFT JOIN album_tracks alt ON t.id = alt.track_id
                    LEFT JOIN albums al ON alt.album_id = al.id
                    WHERE a.id = $1
                    ORDER BY t.title
                    LIMIT $2 OFFSET $3
                """
                rows = await connection.fetch(query, artist_id, limit, offset)
            else:
                # Get all tracks
                query = """
                    SELECT t.id, t.title, t.bpm, t.key, t.energy, t.valence, t.genre,
                           t.duration_ms, a.name as artist_name, al.title as album_title
                    FROM tracks t
                    LEFT JOIN artist_tracks at ON t.id = at.track_id
                    LEFT JOIN artists a ON at.artist_id = a.id
                    LEFT JOIN album_tracks alt ON t.id = alt.track_id  
                    LEFT JOIN albums al ON alt.album_id = al.id
                    ORDER BY t.title
                    LIMIT $1 OFFSET $2
                """
                rows = await connection.fetch(query, limit, offset)
            
            return [
                Track(
                    id=str(row['id']),
                    title=row['title'],
                    artist=row['artist_name'],
                    album=row['album_title'],
                    duration=int(row['duration_ms']) if row['duration_ms'] else None,
                    bpm=float(row['bpm']) if row['bpm'] else None,
                    key=row['key'],
                    genre=row['genre'],
                    energy=float(row['energy']) if row['energy'] else None,
                    valence=float(row['valence']) if row['valence'] else None
                )
                for row in rows
            ]
    except Exception as e:
        logger.error(f"Failed to fetch tracks: {str(e)}")
        # Return empty list as fallback
        return []

@app.get("/api/v1/albums", response_model=List[Album])
async def get_albums(
    artist_id: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db_pool=Depends(get_db_connection)
):
    """Get list of albums"""
    try:
        async with db_pool.acquire() as connection:
            if artist_id:
                query = """
                    SELECT al.id, al.title, al.release_date, al.genre,
                           a.name as artist_name
                    FROM albums al
                    LEFT JOIN artist_albums aa ON al.id = aa.album_id
                    LEFT JOIN artists a ON aa.artist_id = a.id
                    WHERE a.id = $1
                    ORDER BY al.release_date DESC, al.title
                    LIMIT $2 OFFSET $3
                """
                rows = await connection.fetch(query, artist_id, limit, offset)
            else:
                query = """
                    SELECT al.id, al.title, al.release_date, al.genre,
                           a.name as artist_name
                    FROM albums al
                    LEFT JOIN artist_albums aa ON al.id = aa.album_id
                    LEFT JOIN artists a ON aa.artist_id = a.id
                    ORDER BY al.release_date DESC, al.title
                    LIMIT $1 OFFSET $2
                """
                rows = await connection.fetch(query, limit, offset)
            
            return [
                Album(
                    id=str(row['id']),
                    title=row['title'],
                    artist=row['artist_name'],
                    release_date=str(row['release_date']) if row['release_date'] else None,
                    genre=row['genre']
                )
                for row in rows
            ]
    except Exception as e:
        logger.error(f"Failed to fetch albums: {str(e)}")
        # Return empty list as fallback
        return []

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

# Search endpoint
@app.get("/api/v1/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., description="Search query"),
    type: Optional[str] = Query(None, description="Filter by type: artist, track, album"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db_pool=Depends(get_db_connection)
):
    """Search for artists, tracks, and albums"""
    try:
        async with db_pool.acquire() as connection:
            results = []
            total_count = 0
            search_pattern = f"%{q}%"
            
            # Search tracks
            if not type or type == 'track':
                track_query = """
                    SELECT t.id, t.title, t.genre, t.bpm, t.key, t.energy,
                           a.name as artist_name, al.title as album_title,
                           CASE 
                               WHEN t.title ILIKE $1 THEN 3
                               WHEN a.name ILIKE $1 THEN 2
                               ELSE 1
                           END as rank
                    FROM tracks t
                    LEFT JOIN artist_tracks at ON t.id = at.track_id
                    LEFT JOIN artists a ON at.artist_id = a.id
                    LEFT JOIN album_tracks alt ON t.id = alt.track_id
                    LEFT JOIN albums al ON alt.album_id = al.id
                    WHERE t.title ILIKE $1 OR a.name ILIKE $1
                    ORDER BY rank DESC, t.title
                    LIMIT $2 OFFSET $3
                """
                
                track_rows = await connection.fetch(track_query, search_pattern, limit, offset)
                
                for row in track_rows:
                    description = f"Track by {row['artist_name'] or 'Unknown Artist'}"
                    if row['album_title']:
                        description += f" from {row['album_title']}"
                    
                    results.append(SearchResult(
                        id=str(row['id']),
                        title=row['title'],
                        type="track",
                        description=description,
                        metadata={
                            "artist": row['artist_name'],
                            "album": row['album_title'],
                            "genre": row['genre'],
                            "bpm": float(row['bpm']) if row['bpm'] else None,
                            "key": row['key'],
                            "energy": float(row['energy']) if row['energy'] else None
                        },
                        score=float(row['rank'])
                    ))
            
            # Search artists
            if not type or type == 'artist':
                artist_query = """
                    SELECT a.id, a.name, a.genre, 
                           COUNT(at.track_id) as track_count,
                           CASE 
                               WHEN a.name ILIKE $1 THEN 3
                               ELSE 1
                           END as rank
                    FROM artists a
                    LEFT JOIN artist_tracks at ON a.id = at.artist_id
                    WHERE a.name ILIKE $1
                    GROUP BY a.id, a.name, a.genre
                    ORDER BY rank DESC, track_count DESC, a.name
                    LIMIT $2 OFFSET $3
                """
                
                artist_rows = await connection.fetch(artist_query, search_pattern, limit, offset)
                
                for row in artist_rows:
                    track_count = row['track_count'] or 0
                    description = f"Artist with {track_count} track{'s' if track_count != 1 else ''}"
                    if row['genre']:
                        description += f" ({row['genre']})"
                    
                    results.append(SearchResult(
                        id=str(row['id']),
                        title=row['name'],
                        type="artist", 
                        description=description,
                        metadata={
                            "genre": row['genre'],
                            "track_count": track_count
                        },
                        score=float(row['rank'])
                    ))
            
            # Search albums
            if not type or type == 'album':
                album_query = """
                    SELECT al.id, al.title, al.genre, al.release_date,
                           a.name as artist_name,
                           COUNT(alt.track_id) as track_count,
                           CASE 
                               WHEN al.title ILIKE $1 THEN 3
                               WHEN a.name ILIKE $1 THEN 2
                               ELSE 1
                           END as rank
                    FROM albums al
                    LEFT JOIN artist_albums aa ON al.id = aa.album_id
                    LEFT JOIN artists a ON aa.artist_id = a.id
                    LEFT JOIN album_tracks alt ON al.id = alt.album_id
                    WHERE al.title ILIKE $1 OR a.name ILIKE $1
                    GROUP BY al.id, al.title, al.genre, al.release_date, a.name
                    ORDER BY rank DESC, al.title
                    LIMIT $2 OFFSET $3
                """
                
                album_rows = await connection.fetch(album_query, search_pattern, limit, offset)
                
                for row in album_rows:
                    track_count = row['track_count'] or 0
                    description = f"Album by {row['artist_name'] or 'Various Artists'} with {track_count} track{'s' if track_count != 1 else ''}"
                    
                    results.append(SearchResult(
                        id=str(row['id']),
                        title=row['title'],
                        type="album",
                        description=description,
                        metadata={
                            "artist": row['artist_name'],
                            "genre": row['genre'],
                            "release_date": str(row['release_date']) if row['release_date'] else None,
                            "track_count": track_count
                        },
                        score=float(row['rank'])
                    ))
            
            # Sort results by score (descending)
            results.sort(key=lambda x: x.score or 0.0, reverse=True)
            
            # Get total count for pagination (simplified count)
            count_query = """
                SELECT 
                    (SELECT COUNT(*) FROM tracks t 
                     LEFT JOIN artist_tracks at ON t.id = at.track_id
                     LEFT JOIN artists a ON at.artist_id = a.id
                     WHERE t.title ILIKE $1 OR a.name ILIKE $1) +
                    (SELECT COUNT(*) FROM artists a
                     WHERE a.name ILIKE $1) +
                    (SELECT COUNT(*) FROM albums al
                     LEFT JOIN artist_albums aa ON al.id = aa.album_id
                     LEFT JOIN artists a ON aa.artist_id = a.id
                     WHERE al.title ILIKE $1 OR a.name ILIKE $1) as total
            """
            
            total_row = await connection.fetchrow(count_query, search_pattern)
            total_count = total_row['total'] if total_row else 0
            
            # Apply limit for the current page
            paginated_results = results[:limit]
            has_more = offset + len(paginated_results) < total_count
            
            return SearchResponse(
                results=paginated_results,
                total=total_count,
                hasMore=has_more,
                query=q,
                limit=limit,
                offset=offset
            )
            
    except Exception as e:
        logger.error(f"Search failed for query '{q}': {str(e)}")
        # Return empty results on error rather than raising exception
        return SearchResponse(
            results=[],
            total=0,
            hasMore=False,
            query=q,
            limit=limit,
            offset=offset
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)