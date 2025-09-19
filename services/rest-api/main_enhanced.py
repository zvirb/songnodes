"""Enhanced REST API Service for SongNodes with Database Integration"""

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import os
import asyncpg
import json
from datetime import datetime
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SongNodes REST API",
    description="Enhanced REST API for music data operations with database integration",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
DB_CONFIG = {
    'host': os.getenv('POSTGRES_HOST', 'localhost'),
    'port': int(os.getenv('POSTGRES_PORT', 5432)),
    'database': os.getenv('POSTGRES_DB', 'musicdb'),
    'user': os.getenv('POSTGRES_USER', 'musicdb_app'),
    'password': os.getenv('POSTGRES_PASSWORD', 'musicdb_pass'),
}

# Database connection pool
db_pool = None

# Models
class Artist(BaseModel):
    id: Optional[str] = None
    name: str
    normalized_name: Optional[str] = None
    aliases: Optional[List[str]] = None
    spotify_id: Optional[str] = None
    created_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

class Track(BaseModel):
    id: Optional[str] = None
    title: str
    normalized_title: Optional[str] = None
    isrc: Optional[str] = None
    spotify_id: Optional[str] = None
    duration_ms: Optional[int] = None
    bpm: Optional[float] = None
    key: Optional[str] = None
    genre: Optional[str] = None
    is_remix: Optional[bool] = False
    is_mashup: Optional[bool] = False
    artists: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[datetime] = None

class Setlist(BaseModel):
    id: Optional[str] = None
    performer_name: str
    event_name: Optional[str] = None
    venue_name: Optional[str] = None
    set_date: Optional[datetime] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    tracks: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[datetime] = None

class ScrapingJob(BaseModel):
    source: str
    priority: Optional[str] = "medium"
    params: Optional[Dict[str, Any]] = None

class GraphData(BaseModel):
    nodes: List[Dict[str, Any]]
    links: List[Dict[str, Any]]

async def get_db():
    """Get database connection from pool"""
    global db_pool
    if db_pool is None:
        db_pool = await asyncpg.create_pool(**DB_CONFIG)
    return db_pool

@app.on_event("startup")
async def startup_event():
    """Initialize database connection pool on startup"""
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(**DB_CONFIG)
        logger.info("Database connection pool created")
    except Exception as e:
        logger.error(f"Failed to create database pool: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection pool on shutdown"""
    global db_pool
    if db_pool:
        await db_pool.close()
        logger.info("Database connection pool closed")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    db_status = "disconnected"
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("SELECT 1")
        db_status = "connected"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "rest-api-enhanced",
        "version": "2.0.0",
        "database": db_status
    }

@app.get("/api/v1/artists", response_model=List[Artist])
async def get_artists(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None
):
    """Get list of artists with optional search"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            # Set search path
            await conn.execute("SET search_path TO musicdb, public")

            if search:
                query = """
                    SELECT id, name, normalized_name, aliases, spotify_id, created_at, metadata
                    FROM artists
                    WHERE search_vector @@ plainto_tsquery('english', $1)
                       OR name ILIKE $2
                    ORDER BY name
                    LIMIT $3 OFFSET $4
                """
                rows = await conn.fetch(query, search, f"%{search}%", limit, offset)
            else:
                query = """
                    SELECT id, name, normalized_name, aliases, spotify_id, created_at, metadata
                    FROM artists
                    ORDER BY name
                    LIMIT $1 OFFSET $2
                """
                rows = await conn.fetch(query, limit, offset)

            return [
                Artist(
                    id=str(row['id']),
                    name=row['name'],
                    normalized_name=row['normalized_name'],
                    aliases=row['aliases'],
                    spotify_id=row['spotify_id'],
                    created_at=row['created_at'],
                    metadata=row['metadata']
                ) for row in rows
            ]
    except Exception as e:
        logger.error(f"Failed to fetch artists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/tracks", response_model=List[Track])
async def get_tracks(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    artist_id: Optional[str] = None,
    search: Optional[str] = None,
    genre: Optional[str] = None
):
    """Get list of tracks with optional filters"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("SET search_path TO musicdb, public")

            # Base query with track and artist information
            base_query = """
                SELECT DISTINCT t.id, t.title, t.normalized_title, t.isrc, t.spotify_id,
                       t.duration_ms, t.bpm, t.key, t.genre, t.is_remix, t.is_mashup,
                       t.created_at,
                       array_agg(
                           json_build_object(
                               'artist_id', a.id,
                               'artist_name', a.name,
                               'role', ta.role
                           )
                       ) FILTER (WHERE a.id IS NOT NULL) as artists
                FROM tracks t
                LEFT JOIN track_artists ta ON t.id = ta.track_id
                LEFT JOIN artists a ON ta.artist_id = a.id
            """

            conditions = []
            params = []
            param_count = 1

            if search:
                conditions.append(f"t.search_vector @@ plainto_tsquery('english', ${param_count})")
                params.append(search)
                param_count += 1

            if artist_id:
                conditions.append(f"ta.artist_id = ${param_count}")
                params.append(artist_id)
                param_count += 1

            if genre:
                conditions.append(f"t.genre ILIKE ${param_count}")
                params.append(f"%{genre}%")
                param_count += 1

            if conditions:
                base_query += " WHERE " + " AND ".join(conditions)

            query = base_query + f"""
                GROUP BY t.id
                ORDER BY t.title
                LIMIT ${param_count} OFFSET ${param_count + 1}
            """
            params.extend([limit, offset])

            rows = await conn.fetch(query, *params)

            return [
                Track(
                    id=str(row['id']),
                    title=row['title'],
                    normalized_title=row['normalized_title'],
                    isrc=row['isrc'],
                    spotify_id=row['spotify_id'],
                    duration_ms=row['duration_ms'],
                    bpm=row['bpm'],
                    key=row['key'],
                    genre=row['genre'],
                    is_remix=row['is_remix'],
                    is_mashup=row['is_mashup'],
                    artists=row['artists'] or [],
                    created_at=row['created_at']
                ) for row in rows
            ]
    except Exception as e:
        logger.error(f"Failed to fetch tracks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/setlists", response_model=List[Setlist])
async def get_setlists(
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    performer_id: Optional[str] = None,
    venue_id: Optional[str] = None,
    source: Optional[str] = None
):
    """Get list of setlists"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("SET search_path TO musicdb, public")

            base_query = """
                SELECT s.id, p.name as performer_name, e.name as event_name,
                       v.name as venue_name, s.set_date, s.source, s.source_url,
                       s.created_at
                FROM setlists s
                LEFT JOIN performers p ON s.performer_id = p.id
                LEFT JOIN events e ON s.event_id = e.id
                LEFT JOIN venues v ON e.venue_id = v.id
            """

            conditions = []
            params = []
            param_count = 1

            if performer_id:
                conditions.append(f"s.performer_id = ${param_count}")
                params.append(performer_id)
                param_count += 1

            if venue_id:
                conditions.append(f"e.venue_id = ${param_count}")
                params.append(venue_id)
                param_count += 1

            if source:
                conditions.append(f"s.source = ${param_count}")
                params.append(source)
                param_count += 1

            if conditions:
                base_query += " WHERE " + " AND ".join(conditions)

            query = base_query + f"""
                ORDER BY s.set_date DESC NULLS LAST
                LIMIT ${param_count} OFFSET ${param_count + 1}
            """
            params.extend([limit, offset])

            rows = await conn.fetch(query, *params)

            return [
                Setlist(
                    id=str(row['id']),
                    performer_name=row['performer_name'] or "Unknown",
                    event_name=row['event_name'],
                    venue_name=row['venue_name'],
                    set_date=row['set_date'],
                    source=row['source'],
                    source_url=row['source_url'],
                    created_at=row['created_at']
                ) for row in rows
            ]
    except Exception as e:
        logger.error(f"Failed to fetch setlists: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/graph/nodes", response_model=GraphData)
async def get_graph_nodes(
    limit: int = Query(500, le=2000),
    node_type: Optional[str] = Query(None, regex="^(artist|track|setlist)$")
):
    """Get graph visualization nodes and edges"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("SET search_path TO musicdb, public")

            nodes = []
            links = []

            # Get artist nodes
            if not node_type or node_type == "artist":
                artist_query = """
                    SELECT a.id, a.name,
                           COUNT(DISTINCT ta.track_id) as track_count,
                           COUNT(DISTINCT s.id) as setlist_count
                    FROM artists a
                    LEFT JOIN track_artists ta ON a.id = ta.artist_id
                    LEFT JOIN performers p ON a.name = p.name
                    LEFT JOIN setlists s ON p.id = s.performer_id
                    GROUP BY a.id, a.name
                    HAVING COUNT(DISTINCT ta.track_id) > 0
                    ORDER BY track_count DESC
                    LIMIT $1
                """
                artist_rows = await conn.fetch(artist_query, limit // 2)

                for row in artist_rows:
                    nodes.append({
                        "id": f"artist_{row['id']}",
                        "label": row['name'],
                        "type": "artist",
                        "size": min(50, 10 + row['track_count']),
                        "metadata": {
                            "track_count": row['track_count'],
                            "setlist_count": row['setlist_count']
                        }
                    })

            # Get track nodes
            if not node_type or node_type == "track":
                track_query = """
                    SELECT t.id, t.title, t.genre,
                           COUNT(DISTINCT st.setlist_id) as setlist_count,
                           string_agg(DISTINCT a.name, ', ') as artists
                    FROM tracks t
                    LEFT JOIN track_artists ta ON t.id = ta.track_id
                    LEFT JOIN artists a ON ta.artist_id = a.id
                    LEFT JOIN setlist_tracks st ON t.id = st.track_id
                    GROUP BY t.id, t.title, t.genre
                    HAVING COUNT(DISTINCT st.setlist_id) > 0
                    ORDER BY setlist_count DESC
                    LIMIT $1
                """
                track_rows = await conn.fetch(track_query, limit // 2)

                for row in track_rows:
                    nodes.append({
                        "id": f"track_{row['id']}",
                        "label": row['title'],
                        "type": "track",
                        "size": min(30, 5 + row['setlist_count']),
                        "metadata": {
                            "genre": row['genre'],
                            "artists": row['artists'],
                            "setlist_count": row['setlist_count']
                        }
                    })

            # Get artist-track relationships
            link_query = """
                SELECT DISTINCT a.id as artist_id, t.id as track_id, ta.role
                FROM artists a
                JOIN track_artists ta ON a.id = ta.artist_id
                JOIN tracks t ON ta.track_id = t.id
                WHERE EXISTS (
                    SELECT 1 FROM setlist_tracks st WHERE st.track_id = t.id
                )
                LIMIT $1
            """
            link_rows = await conn.fetch(link_query, limit)

            for row in link_rows:
                links.append({
                    "source": f"artist_{row['artist_id']}",
                    "target": f"track_{row['track_id']}",
                    "type": row['role'],
                    "strength": 1.0
                })

            return GraphData(nodes=nodes, links=links)

    except Exception as e:
        logger.error(f"Failed to fetch graph data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/scrape/trigger")
async def trigger_scrape(job: ScrapingJob):
    """Trigger web scraping job via scraper orchestrator"""
    try:
        # Send request to scraper orchestrator
        orchestrator_url = os.getenv('SCRAPER_ORCHESTRATOR_URL', 'http://scraper-orchestrator:8001')

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{orchestrator_url}/tasks/submit",
                json={
                    "scraper": job.source,
                    "priority": job.priority,
                    "params": job.params or {}
                },
                timeout=10.0
            )

            if response.status_code == 200:
                result = response.json()
                return {
                    "status": "queued",
                    "task_id": result.get("task_id"),
                    "source": job.source,
                    "message": "Scraping job has been queued successfully"
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Scraper orchestrator error: {response.text}"
                )
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Scraper orchestrator is unavailable")
    except Exception as e:
        logger.error(f"Failed to trigger scrape: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/scrape/status/{task_id}")
async def get_scrape_status(task_id: str):
    """Get status of a scraping job"""
    try:
        orchestrator_url = os.getenv('SCRAPER_ORCHESTRATOR_URL', 'http://scraper-orchestrator:8001')

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{orchestrator_url}/tasks/{task_id}",
                timeout=10.0
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(status_code=404, detail="Task not found")
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Scraper orchestrator error: {response.text}"
                )
    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="Scraper orchestrator is unavailable")
    except Exception as e:
        logger.error(f"Failed to get scrape status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/stats")
async def get_database_stats():
    """Get database statistics"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("SET search_path TO musicdb, public")

            stats = {}

            # Count tables
            tables = ['artists', 'tracks', 'setlists', 'performers', 'venues', 'events']
            for table in tables:
                count_query = f"SELECT COUNT(*) as count FROM {table}"
                result = await conn.fetchrow(count_query)
                stats[f"{table}_count"] = result['count']

            # Recent scraping activity
            recent_query = """
                SELECT source, COUNT(*) as count, MAX(created_at) as last_update
                FROM setlists
                WHERE created_at > NOW() - INTERVAL '7 days'
                GROUP BY source
                ORDER BY count DESC
            """
            recent_rows = await conn.fetch(recent_query)
            stats['recent_scraping'] = [
                {
                    'source': row['source'],
                    'count': row['count'],
                    'last_update': row['last_update']
                } for row in recent_rows
            ]

            return stats

    except Exception as e:
        logger.error(f"Failed to fetch stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/setlists/{setlist_id}/tracks")
async def get_setlist_tracks(setlist_id: str):
    """Get tracks in a specific setlist"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("SET search_path TO musicdb, public")

            query = """
                SELECT t.id, t.title, t.genre, st.position, st.notes,
                       string_agg(DISTINCT a.name, ', ' ORDER BY ta.role) as artists
                FROM setlist_tracks st
                JOIN tracks t ON st.track_id = t.id
                LEFT JOIN track_artists ta ON t.id = ta.track_id
                LEFT JOIN artists a ON ta.artist_id = a.id
                WHERE st.setlist_id = $1
                GROUP BY t.id, t.title, t.genre, st.position, st.notes
                ORDER BY st.position
            """

            rows = await conn.fetch(query, setlist_id)

            return [
                {
                    "id": str(row['id']),
                    "title": row['title'],
                    "artists": row['artists'],
                    "genre": row['genre'],
                    "position": row['position'],
                    "notes": json.loads(row['notes']) if row['notes'] else {}
                } for row in rows
            ]

    except Exception as e:
        logger.error(f"Failed to fetch setlist tracks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Live performance data endpoint compatible with frontend expectations
@app.get("/live-performance-data.json")
async def get_live_performance_data():
    """Get live performance data in expected frontend format"""
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.execute("SET search_path TO musicdb, public")

            # Get recent setlists with track information
            query = """
                SELECT s.id, p.name as performer_name, e.name as event_name,
                       v.name as venue_name, s.set_date, s.source,
                       array_agg(
                           json_build_object(
                               'title', t.title,
                               'artists', COALESCE(
                                   (SELECT string_agg(a.name, ', ')
                                    FROM track_artists ta
                                    JOIN artists a ON ta.artist_id = a.id
                                    WHERE ta.track_id = t.id), 'Unknown'
                               ),
                               'position', st.position
                           ) ORDER BY st.position
                       ) FILTER (WHERE t.id IS NOT NULL) as tracks
                FROM setlists s
                LEFT JOIN performers p ON s.performer_id = p.id
                LEFT JOIN events e ON s.event_id = e.id
                LEFT JOIN venues v ON e.venue_id = v.id
                LEFT JOIN setlist_tracks st ON s.id = st.setlist_id
                LEFT JOIN tracks t ON st.track_id = t.id
                GROUP BY s.id, p.name, e.name, v.name, s.set_date, s.source
                ORDER BY s.set_date DESC NULLS LAST
                LIMIT 50
            """

            rows = await conn.fetch(query)

            # Transform to expected frontend format (exclude entries without valid performer names)
            performances = []
            for row in rows:
                # Skip performances without valid performer names
                if not row['performer_name'] or row['performer_name'].strip() == '':
                    continue

                performance = {
                    "id": str(row['id']),
                    "artist": row['performer_name'],
                    "event": row['event_name'] or "Unknown Event",
                    "venue": row['venue_name'] or "Unknown Venue",
                    "date": row['set_date'].isoformat() if row['set_date'] else None,
                    "source": row['source'] or "unknown",
                    "tracks": row['tracks'] or []
                }
                performances.append(performance)

            return {"performances": performances}

    except Exception as e:
        logger.error(f"Failed to fetch live performance data: {str(e)}")
        # Return empty data on error to avoid frontend breaking
        return {"performances": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)