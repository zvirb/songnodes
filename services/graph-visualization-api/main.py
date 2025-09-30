#!/usr/bin/env python3
"""
Graph Visualization API Service
High-performance FastAPI service for song relationship visualization
Target: <50ms response time, 20,000+ tracks/hour processing capacity
"""

import asyncio
import json
import time
import gzip
import hashlib
import traceback
import re
import uuid
from typing import List, Dict, Optional, Any
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

import uvicorn
import redis.asyncio as redis
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Depends, Request
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import QueuePool
from sqlalchemy import text, select, func, bindparam
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import prometheus_client
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter('graph_api_requests_total', 'Total API requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('graph_api_request_duration_seconds', 'Request duration', ['endpoint'])
ACTIVE_CONNECTIONS = Gauge('graph_api_websocket_connections', 'Active WebSocket connections')
CACHE_HITS = Counter('graph_api_cache_hits_total', 'Cache hits')
CACHE_MISSES = Counter('graph_api_cache_misses_total', 'Cache misses')
DATABASE_QUERY_DURATION = Histogram('graph_api_db_query_duration_seconds', 'Database query duration', ['query_type'])

# Configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://musicdb_user:musicdb_dev_password_2024@musicdb-postgres:5432/musicdb')
REDIS_HOST = os.getenv('REDIS_HOST', 'musicdb-redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
CACHE_TTL = int(os.getenv('CACHE_TTL', 300))  # 5 minutes
MAX_CONNECTIONS = int(os.getenv('MAX_CONNECTIONS', 1000))

# Database engine with 2025 best practices for memory leak prevention
engine = create_async_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=15,  # Reduced from 20 to prevent overflow
    max_overflow=15,  # Reduced from 30 to prevent excessive connections
    pool_pre_ping=True,  # Validate connections before use
    pool_recycle=1800,  # Recycle connections every 30 minutes (reduced from 1 hour)
    pool_timeout=30,  # 30 second timeout for getting connection from pool
    pool_reset_on_return='commit',  # Reset connection state on return
    echo=False,
    # 2025 best practices: connection-level timeouts and settings
    connect_args={
        "command_timeout": 30  # 30 second query timeout
    }
)

async_session = async_sessionmaker(engine, expire_on_commit=False)

# Redis connection pool (2025 best practices)
redis_pool = None
redis_connection_pool = None

# WebSocket connection manager with 2025 memory leak prevention
class ConnectionManager:
    def __init__(self, max_connections_per_room=100, max_total_connections=1000):
        self.active_connections: Dict[str, set] = {}
        self.connection_metadata: Dict[WebSocket, dict] = {}
        self.max_connections_per_room = max_connections_per_room
        self.max_total_connections = max_total_connections
        self.total_connections = 0
        self.cleanup_task = None
    
    async def connect(self, websocket: WebSocket, room_id: str):
        # 2025 best practice: enforce connection limits to prevent memory exhaustion
        if self.total_connections >= self.max_total_connections:
            await websocket.close(code=1013, reason="Server overloaded")
            logger.warning(f"Connection rejected: total connections limit reached ({self.max_total_connections})")
            return False

        if room_id not in self.active_connections:
            self.active_connections[room_id] = set()

        if len(self.active_connections[room_id]) >= self.max_connections_per_room:
            await websocket.close(code=1013, reason="Room capacity exceeded")
            logger.warning(f"Connection rejected: room {room_id} capacity exceeded ({self.max_connections_per_room})")
            return False

        await websocket.accept()
        self.active_connections[room_id].add(websocket)
        self.connection_metadata[websocket] = {
            'room_id': room_id,
            'connected_at': time.time(),
            'last_activity': time.time(),
            'message_count': 0
        }
        self.total_connections += 1
        ACTIVE_CONNECTIONS.inc()
        logger.info(f"Client connected to room {room_id} (total: {self.total_connections})")

        # Start cleanup task if not already running
        if self.cleanup_task is None:
            self.cleanup_task = asyncio.create_task(self._periodic_cleanup())

        return True
    
    def disconnect(self, websocket: WebSocket):
        metadata = self.connection_metadata.get(websocket)
        if metadata:
            room_id = metadata['room_id']
            if room_id in self.active_connections:
                self.active_connections[room_id].discard(websocket)
                if not self.active_connections[room_id]:
                    del self.active_connections[room_id]
            del self.connection_metadata[websocket]
            self.total_connections = max(0, self.total_connections - 1)  # Prevent negative values
            ACTIVE_CONNECTIONS.dec()
            logger.info(f"Client disconnected from room {room_id} (total: {self.total_connections})")

    async def _periodic_cleanup(self):
        """2025 best practice: periodic cleanup of stale connections to prevent memory leaks"""
        while True:
            try:
                await asyncio.sleep(300)  # Run cleanup every 5 minutes
                current_time = time.time()
                stale_connections = []

                # Find stale connections (idle > 30 minutes)
                for websocket, metadata in self.connection_metadata.items():
                    if current_time - metadata.get('last_activity', 0) > 1800:  # 30 minutes
                        stale_connections.append(websocket)

                # Clean up stale connections
                for websocket in stale_connections:
                    try:
                        await websocket.close(code=1001, reason="Connection idle timeout")
                        self.disconnect(websocket)
                        logger.info("Cleaned up stale WebSocket connection")
                    except Exception as e:
                        logger.error(f"Error cleaning up stale connection: {e}")
                        # Force cleanup even if close fails
                        self.disconnect(websocket)

                if stale_connections:
                    logger.info(f"Cleaned up {len(stale_connections)} stale WebSocket connections")

            except asyncio.CancelledError:
                logger.info("WebSocket cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Error in WebSocket cleanup task: {e}")

    def update_activity(self, websocket: WebSocket):
        """Update last activity timestamp for connection"""
        if websocket in self.connection_metadata:
            self.connection_metadata[websocket]['last_activity'] = time.time()
            self.connection_metadata[websocket]['message_count'] += 1
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await self._send_compressed_message(websocket, message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
    
    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[room_id].copy():
                try:
                    await self._send_compressed_message(connection, message)
                except Exception as e:
                    logger.error(f"Error broadcasting to connection: {e}")
                    dead_connections.append(connection)
            
            # Clean up dead connections
            for conn in dead_connections:
                self.disconnect(conn)
    
    async def _send_compressed_message(self, websocket: WebSocket, data: dict):
        message = json.dumps(data).encode('utf-8')
        if len(message) > 1024:  # Compress large messages
            compressed = gzip.compress(message)
            await websocket.send_bytes(compressed)
        else:
            await websocket.send_json(data)

manager = ConnectionManager()

# Circuit breaker implementation
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
    
    async def call(self, func, *args, **kwargs):
        if self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.timeout:
                self.state = 'HALF_OPEN'
            else:
                raise HTTPException(status_code=503, detail="Circuit breaker is OPEN")
        
        try:
            result = await func(*args, **kwargs)
            self.reset()
            return result
        except Exception as e:
            self.record_failure()
            raise e
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'
    
    def reset(self):
        self.failure_count = 0
        self.state = 'CLOSED'

db_circuit_breaker = CircuitBreaker()

# Pydantic models
class NodePosition(BaseModel):
    x: float = Field(..., description="X coordinate")
    y: float = Field(..., description="Y coordinate")

class SearchRequest(BaseModel):
    q: str = Field(..., description="Search query")
    type: str = Field(default="fuzzy", description="Search type")
    fields: List[str] = Field(default=["title", "artist", "album", "genres"], description="Fields to search")
    limit: int = Field(default=20, description="Maximum results to return")
    offset: int = Field(default=0, description="Results offset for pagination")

class SearchResult(BaseModel):
    id: str = Field(..., description="Track ID")
    title: str = Field(..., description="Track title")
    artist: str = Field(..., description="Primary artist name")
    score: float = Field(..., description="Relevance score")
    highlights: Dict[str, str] = Field(default_factory=dict, description="Search highlights")

class SearchResponse(BaseModel):
    results: List[SearchResult] = Field(..., description="Search results")
    total: int = Field(..., description="Total number of results")
    limit: int = Field(..., description="Results limit")
    offset: int = Field(..., description="Results offset")
    query: str = Field(..., description="Original search query")
    suggestions: List[str] = Field(default_factory=list, description="Search suggestions")
    facets: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict, description="Search facets")
    status: str = Field(default="ok", description="Search status")

class GraphNode(BaseModel):
    id: str = Field(..., description="Unique node identifier")
    track_id: str = Field(..., description="Track identifier")
    position: NodePosition = Field(..., description="Node position in graph")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional node metadata")

class GraphEdge(BaseModel):
    id: str = Field(..., description="Unique edge identifier")
    source_id: str = Field(..., description="Source node ID")
    target_id: str = Field(..., description="Target node ID")
    weight: float = Field(default=1.0, description="Edge weight")
    edge_type: str = Field(default="similarity", description="Type of relationship")

class GraphData(BaseModel):
    nodes: List[GraphNode] = Field(..., description="Graph nodes")
    edges: List[GraphEdge] = Field(..., description="Graph edges")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Graph metadata")

class NodeBatch(BaseModel):
    nodes: List[Dict[str, Any]] = Field(..., description="Batch of nodes to process")
    batch_id: str = Field(..., description="Unique batch identifier")

class GraphQuery(BaseModel):
    center_node_id: Optional[str] = Field(None, description="Center node for graph expansion")
    max_depth: int = Field(default=3, ge=1, le=10, description="Maximum traversal depth")
    max_nodes: int = Field(default=100, ge=1, le=1000, description="Maximum nodes to return")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Query filters")

# Caching utilities
def generate_cache_key(func_name: str, *args, **kwargs) -> str:
    """Generate a consistent cache key for function calls."""
    key_data = f'{func_name}:{args}:{sorted(kwargs.items())}'
    return hashlib.md5(key_data.encode()).hexdigest()

def cache_result(ttl: int = CACHE_TTL):
    """Decorator for caching function results in Redis."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            cache_key = generate_cache_key(func.__name__, *args, **kwargs)
            
            try:
                # Try cache first
                cached = await redis_pool.get(cache_key)
                if cached:
                    CACHE_HITS.inc()
                    return json.loads(cached)
                
                CACHE_MISSES.inc()
                
                # Execute function
                result = await func(*args, **kwargs)
                
                # Cache result
                await redis_pool.setex(
                    cache_key, ttl, json.dumps(result, default=str)
                )
                return result
            except Exception as e:
                logger.error(f"Cache error: {e}")
                # Fallback to direct execution
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator

# Database operations
async def get_db_session():
    """Get database session with connection management."""
    async with async_session() as session:
        yield session

@cache_result(ttl=600)  # Cache for 10 minutes
async def get_graph_nodes(
    center_node_id: Optional[str] = None,
    max_depth: int = 3,
    max_nodes: int = 100,
    filters: Dict[str, Any] = None,
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    """Get graph nodes with optional filtering and traversal."""
    with DATABASE_QUERY_DURATION.labels(query_type='get_nodes').time():
        async with async_session() as session:
            try:
                if center_node_id:
                    # Graph traversal query
                    query = text("""
                        WITH RECURSIVE connected_nodes AS (
                            SELECT n.id, n.track_id, n.x_position, n.y_position, n.metadata, 0 as depth
                            FROM musicdb.nodes n WHERE n.id = :center_id
                            UNION ALL
                            SELECT n.id, n.track_id, n.x_position, n.y_position, n.metadata, cn.depth + 1
                            FROM musicdb.nodes n
                            JOIN musicdb.edges e ON (e.source_id = n.id OR e.target_id = n.id)
                            JOIN connected_nodes cn ON (cn.id = e.source_id OR cn.id = e.target_id)
                            WHERE cn.depth < :max_depth AND n.id != cn.id
                        )
                        SELECT DISTINCT id, track_id, x_position, y_position, metadata 
                        FROM connected_nodes 
                        LIMIT :max_nodes
                    """)
                    result = await session.execute(
                        query, 
                        {
                            "center_id": center_node_id, 
                            "max_depth": max_depth, 
                            "max_nodes": max_nodes
                        }
                    )
                else:
                    # Get all nodes from the graph_nodes view
                    # Build metadata object from view columns
                    query = text("""
                        SELECT
                            node_id as id,
                            node_id as track_id,
                            0 as x_position,
                            0 as y_position,
                            json_build_object(
                                'title', label,
                                'artist', artist_name,
                                'node_type', node_type,
                                'category', category,
                                'genre', category,
                                'release_year', release_year,
                                'appearance_count', appearance_count
                            ) as metadata,
                            COUNT(*) OVER() as total_count
                        FROM graph_nodes
                        WHERE node_type = 'song'
                        ORDER BY appearance_count DESC
                        LIMIT :limit OFFSET :offset
                    """)
                    result = await session.execute(query, {
                        "limit": limit,
                        "offset": offset
                    })

                nodes = []
                total_count = 0
                logger.info(f"DEBUG: Query executed, processing results...")
                for row in result:
                    logger.info(f"DEBUG: Processing row: {row}")
                    # Get the metadata from the view
                    metadata = dict(row.metadata) if row.metadata else {}

                    # Add computed fields
                    artist = metadata.get('artist', 'Unknown')
                    title = metadata.get('title', 'Unknown')
                    if artist and artist != 'Unknown':
                        metadata['label'] = f"{artist} - {title}"
                    else:
                        metadata['label'] = title

                    metadata['node_type'] = 'song'
                    metadata['category'] = metadata.get('genre', 'Electronic')
                    metadata['appearance_count'] = 0

                    node_data = {
                        'id': str(row.id),
                        'track_id': str(row.track_id),
                        'position': {
                            'x': float(row.x_position) if row.x_position is not None else 0.0,
                            'y': float(row.y_position) if row.y_position is not None else 0.0
                        },
                        'metadata': metadata
                    }
                    nodes.append(node_data)
                    if hasattr(row, 'total_count'):
                        total_count = row.total_count

                return {
                    'nodes': nodes,
                    'total': total_count or len(nodes),
                    'limit': limit,
                    'offset': offset
                }
                
            except Exception as e:
                logger.error(f"Database error in get_graph_nodes: {e}")
                raise HTTPException(status_code=500, detail="Database query failed")

@cache_result(ttl=180)  # Cache for 3 minutes (shorter for search results)
async def search_tracks(
    query: str,
    search_type: str = "fuzzy",
    fields: List[str] = None,
    limit: int = 20,
    offset: int = 0
) -> Dict[str, Any]:
    """Search tracks using full-text search with PostgreSQL."""
    with DATABASE_QUERY_DURATION.labels(query_type='search_tracks').time():
        async with async_session() as session:
            try:
                if fields is None:
                    fields = ["title", "artist", "album", "genres"]
                
                # Simple search query with basic ILIKE matching (exclude tracks without artists)
                search_query = text("""
                    SELECT
                        t.song_id as id,
                        t.title,
                        a.name as artist,
                        1.0 as relevance_score,
                        COUNT(*) OVER() as total_count
                    FROM songs t
                    JOIN song_artists ta ON t.song_id = ta.song_id AND ta.role = 'primary'
                    JOIN artists a ON ta.artist_id = a.artist_id
                    WHERE (t.title ILIKE :query
                           OR a.name ILIKE :query)
                        AND a.name IS NOT NULL AND a.name != ''
                    ORDER BY t.title
                    LIMIT :limit OFFSET :offset
                """)
                
                # Execute search query
                search_params = {
                    "query": f"%{query}%",
                    "limit": limit,
                    "offset": offset
                }
                
                result = await session.execute(search_query, search_params)
                rows = result.fetchall()
                
                if not rows:
                    return {
                        "results": [],
                        "total": 0,
                        "suggestions": await get_search_suggestions(query, session)
                    }
                
                # Process results
                results = []
                total_count = rows[0].total_count if rows else 0
                
                for row in rows:
                    # Generate highlights for fuzzy search
                    highlights = {}
                    if search_type == "fuzzy" and query.lower() in row.title.lower():
                        highlights["title"] = highlight_text(row.title, query)
                    if row.artist and query.lower() in row.artist.lower():
                        highlights["artist"] = highlight_text(row.artist, query)
                    
                    results.append({
                        "id": str(row.id),
                        "title": row.title,
                        "artist": row.artist,
                        "score": float(row.relevance_score),
                        "highlights": highlights
                    })
                
                # Get suggestions if low result count
                suggestions = []
                if len(results) < 3:
                    suggestions = await get_search_suggestions(query, session)
                
                return {
                    "results": results,
                    "total": total_count,
                    "suggestions": suggestions
                }
                
            except Exception as e:
                logger.error(f"Database error in search_tracks: {e}")
                raise HTTPException(status_code=500, detail="Search query failed")

def highlight_text(text: str, query: str) -> str:
    """Simple text highlighting for search results."""
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    return pattern.sub(f"<mark>{query}</mark>", text)

async def get_search_suggestions(query: str, session) -> List[str]:
    """Get search suggestions based on query."""
    try:
        # Use simpler approach without pg_trgm extension
        suggestion_query = text("""
            SELECT DISTINCT t.title
            FROM musicdb.tracks t
            WHERE t.title ILIKE :query
            ORDER BY t.title
            LIMIT 5
        """)

        result = await session.execute(suggestion_query, {"query": f"%{query}%"})
        suggestions = [row.title for row in result.fetchall()]
        return suggestions
    except Exception as e:
        logger.error(f"Error getting search suggestions: {e}")
        return []

@cache_result(ttl=300)  # Cache for 5 minutes
async def get_graph_edges(
    node_ids: List[str] = None,
    limit: int = 1000,
    offset: int = 0
) -> Dict[str, Any]:
    """Get graph edges, optionally filtered by node IDs."""
    with DATABASE_QUERY_DURATION.labels(query_type='get_edges').time():
        async with async_session() as session:
            try:
                if node_ids:
                    # Extract song IDs from node_ids (format: 'song_<uuid>')
                    raw_song_ids = [nid.replace('song_', '') for nid in node_ids if nid.startswith('song_')]

                    # Convert to UUID objects for proper binding and filter invalid values
                    song_ids: List[uuid.UUID] = []
                    for raw_id in raw_song_ids:
                        try:
                            song_ids.append(uuid.UUID(raw_id))
                        except ValueError:
                            logger.warning(f"Ignoring invalid song UUID in get_graph_edges: {raw_id}")

                    if not song_ids:
                        logger.warning("No valid song IDs provided to get_graph_edges; returning empty result")
                        return {
                            'edges': [],
                            'total': 0,
                            'limit': limit,
                            'offset': offset
                        }

                    query = text("""
                        SELECT
                               ROW_NUMBER() OVER (ORDER BY sa.occurrence_count DESC) as row_number,
                               'song_' || sa.song_id_1::text as source_id,
                               'song_' || sa.song_id_2::text as target_id,
                               sa.occurrence_count::float as weight,
                               'sequential' as edge_type,
                               COUNT(*) OVER() as total_count
                        FROM song_adjacency sa
                        JOIN songs s1 ON sa.song_id_1 = s1.song_id
                        JOIN songs s2 ON sa.song_id_2 = s2.song_id
                        WHERE (sa.song_id_1 = ANY(:song_ids) OR sa.song_id_2 = ANY(:song_ids))
                          AND sa.occurrence_count >= 1  -- Show all adjacency relationships
                          AND s1.primary_artist_id != s2.primary_artist_id  -- Exclude same-artist consecutive tracks
                        ORDER BY occurrence_count DESC
                        LIMIT :limit OFFSET :offset
                    """).bindparams(
                        bindparam('song_ids', type_=ARRAY(UUID(as_uuid=True)))
                    )

                    result = await session.execute(query, {
                        "song_ids": song_ids,
                        "limit": limit,
                        "offset": offset
                    })
                else:
                    # Query song_adjacency for SEQUENTIAL adjacencies only (consecutive tracks in setlists)
                    # Filter to only show the strongest adjacency relationships to reduce visual clutter
                    query = text("""
                        SELECT
                               ROW_NUMBER() OVER (ORDER BY sa.occurrence_count DESC) as row_number,
                               'song_' || sa.song_id_1::text as source_id,
                               'song_' || sa.song_id_2::text as target_id,
                               sa.occurrence_count::float as weight,
                               'sequential' as edge_type,
                               COUNT(*) OVER() as total_count
                        FROM song_adjacency sa
                        JOIN songs s1 ON sa.song_id_1 = s1.song_id
                        JOIN songs s2 ON sa.song_id_2 = s2.song_id
                        WHERE sa.occurrence_count >= 1  -- Show all adjacency relationships
                          AND s1.primary_artist_id != s2.primary_artist_id  -- Exclude same-artist consecutive tracks
                        ORDER BY occurrence_count DESC
                        LIMIT :limit OFFSET :offset
                    """)
                    result = await session.execute(query, {
                        "limit": limit,
                        "offset": offset
                    })
                
                edges = []
                total_count = 0
                for row in result:
                    source_id = str(row.source_id)
                    target_id = str(row.target_id)
                    edge_id = f"{source_id}__{target_id}"

                    edge_data = {
                        'id': edge_id,
                        'source': source_id,
                        'target': target_id,
                        'weight': float(row.weight),
                        'type': row.edge_type,
                        'edge_type': row.edge_type
                    }
                    edges.append(edge_data)
                    if hasattr(row, 'total_count'):
                        total_count = row.total_count

                return {
                    'edges': edges,
                    'total': total_count or len(edges),
                    'limit': limit,
                    'offset': offset
                }
                
            except Exception as e:
                logger.error(f"Database error in get_graph_edges: {e}")
                raise HTTPException(status_code=500, detail="Database query failed")

async def bulk_insert_nodes(nodes_data: List[Dict[str, Any]]) -> int:
    """
    Bulk insert nodes with conflict resolution.
    NOTE: This function is disabled as our architecture uses dynamic views (graph_nodes)
    instead of static node tables. Nodes are generated automatically from songs and artists.
    """
    # Disabled - nodes are generated dynamically from graph_nodes view
    logger.warning("bulk_insert_nodes called but disabled - using dynamic graph_nodes view")
    return 0

    # COMMENTED OUT - Original implementation incompatible with view-based architecture
    # with DATABASE_QUERY_DURATION.labels(query_type='bulk_insert').time():
    #     async with async_session() as session:
    #         try:
    #             # Use direct SQL for better compatibility
    #             inserted_count = 0
    #             for node in nodes_data:
    #                 query = text("""
    #                     INSERT INTO musicdb.nodes (track_id, x_position, y_position, metadata)
    #                     VALUES (:track_id, :x_position, :y_position, :metadata)
    #                     ON CONFLICT (track_id) DO UPDATE SET
    #                         x_position = EXCLUDED.x_position,
    #                         y_position = EXCLUDED.y_position,
    #                         metadata = EXCLUDED.metadata,
    #                         updated_at = NOW()
    #                 """)
    #                 await session.execute(query, {
    #                     "track_id": node.get('track_id'),
    #                     "x_position": node.get('x', 0),
    #                     "y_position": node.get('y', 0),
    #                     "metadata": json.dumps(node.get('metadata', {}))
    #                 })
    #                 inserted_count += 1
    #
    #             await session.commit()
    #             return inserted_count
    #
    #         except Exception as e:
    #             await session.rollback()
    #             logger.error(f"Database error in bulk_insert_nodes: {e}")
    #             raise HTTPException(status_code=500, detail="Bulk insert failed")

# Background task processing
async def process_node_batch(nodes: List[Dict[str, Any]], batch_id: str):
    """Process node batch in background."""
    try:
        result = await bulk_insert_nodes(nodes)
        await update_batch_status(batch_id, 'completed', result)
        logger.info(f"Batch {batch_id} completed: {result} nodes processed")
    except Exception as e:
        await update_batch_status(batch_id, 'failed', str(e))
        logger.error(f"Batch {batch_id} failed: {e}")

async def update_batch_status(batch_id: str, status: str, result: Any):
    """Update batch processing status in Redis."""
    try:
        status_data = {
            'batch_id': batch_id,
            'status': status,
            'result': result,
            'updated_at': datetime.utcnow().isoformat()
        }
        await redis_pool.setex(f"batch:{batch_id}", 3600, json.dumps(status_data, default=str))
    except Exception as e:
        logger.error(f"Failed to update batch status: {e}")

# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup with 2025 best practices
    global redis_pool, redis_connection_pool

    # Create Redis connection pool (2025 best practice for memory leak prevention)
    redis_connection_pool = redis.ConnectionPool(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=0,
        decode_responses=True,
        max_connections=50,  # Limit connection pool size
        retry_on_timeout=True,
        retry_on_error=[redis.ConnectionError, redis.TimeoutError],
        health_check_interval=30  # Health check every 30 seconds
    )
    redis_pool = redis.Redis(connection_pool=redis_connection_pool)

    # Test database connection
    async with async_session() as session:
        await session.execute(text("SELECT 1"))

    # Test Redis connection
    await redis_pool.ping()

    logger.info("Graph Visualization API started successfully with enhanced 2025 configuration")
    yield

    # Shutdown with proper cleanup
    if redis_pool:
        await redis_pool.close()
    if redis_connection_pool:
        redis_connection_pool.disconnect()
    await engine.dispose()
    logger.info("Graph Visualization API shutdown complete")

# FastAPI application
app = FastAPI(
    title="Graph Visualization API",
    description="High-performance API for song relationship visualization",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for non-security-conscious app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request middleware for metrics
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    REQUEST_DURATION.labels(endpoint=request.url.path).observe(duration)
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    return response

# API Routes
@app.get("/api/graph/nodes")
async def get_nodes(
    limit: int = 100,
    offset: int = 0,
    center_node_id: Optional[str] = None,
    max_depth: int = 3
):
    """Get all graph nodes with pagination."""
    try:
        # Temporarily bypass circuit breaker to debug
        logger.info(f"DEBUG: Calling get_graph_nodes directly...")
        result = await get_graph_nodes(
            center_node_id,
            max_depth,
            limit,  # max_nodes parameter
            {},     # filters
            limit,  # limit parameter
            offset  # offset parameter
        )
        logger.info(f"DEBUG: Result from get_graph_nodes: {result}")
        return result

    except Exception as e:
        logger.error(f"Error in get_nodes: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve nodes")

@app.get("/api/graph/edges")
async def get_edges(
    limit: int = 1000,
    offset: int = 0,
    node_ids: Optional[str] = None
):
    """Get all graph edges with pagination."""
    try:
        # If node_ids are not provided, fetch all nodes first
        if not node_ids:
            nodes_result = await get_graph_nodes(limit=10000)  # A large limit to get all nodes
            parsed_node_ids = [node['id'] for node in nodes_result['nodes']]
        else:
            parsed_node_ids = [id.strip() for id in node_ids.split(',')]

        result = await db_circuit_breaker.call(
            get_graph_edges,
            parsed_node_ids,
            limit,
            offset
        )
        return result

    except Exception as e:
        logger.error(f"Error in get_edges: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve edges")

@app.get("/api/graph/data")
async def get_graph_data():
    """Get combined nodes and edges data for frontend visualization."""
    try:
        # First, get all edges to know which nodes we need
        logger.info("Fetching adjacency relationships from database")
        async with async_session() as session:
            # Get all edges (adjacencies)
            edges_query = text("""
                SELECT
                       ROW_NUMBER() OVER (ORDER BY sa.occurrence_count DESC) as row_number,
                       'song_' || sa.song_id_1::text as source_id,
                       'song_' || sa.song_id_2::text as target_id,
                       sa.occurrence_count::float as weight,
                       'sequential' as edge_type,
                       COUNT(*) OVER() as total_count
                FROM song_adjacency sa
                JOIN songs s1 ON sa.song_id_1 = s1.song_id
                JOIN songs s2 ON sa.song_id_2 = s2.song_id
                WHERE sa.occurrence_count >= 1  -- Show all adjacency relationships
                  AND s1.primary_artist_id != s2.primary_artist_id  -- Exclude same-artist consecutive tracks
                ORDER BY occurrence_count DESC
                LIMIT 1000
            """)
            edges_result = await session.execute(edges_query)

            edges = []
            referenced_node_ids = set()

            for row in edges_result:
                source_id = str(row.source_id)
                target_id = str(row.target_id)
                edge_id = f"{source_id}__{target_id}"

                edge_data = {
                    'id': edge_id,
                    'source': source_id,
                    'target': target_id,
                    'weight': float(row.weight),
                    'type': row.edge_type,
                    'edge_type': row.edge_type
                }
                edges.append(edge_data)

                # Track which nodes are referenced by edges
                referenced_node_ids.add(source_id)
                referenced_node_ids.add(target_id)

            logger.info(f"Found {len(edges)} edges referencing {len(referenced_node_ids)} unique nodes")

            # Now get nodes - prioritize nodes that have edges, then add more up to limit
            if referenced_node_ids:
                # Get all nodes that are referenced by edges PLUS additional nodes
                nodes_query = text("""
                    WITH edge_nodes AS (
                        -- First priority: nodes that have edges
                        SELECT
                            node_id as id,
                            node_id as track_id,
                            0 as x_position,
                            0 as y_position,
                            json_build_object(
                                'title', label,
                                'artist', artist_name,
                                'node_type', node_type,
                                'category', category,
                                'genre', category,
                                'release_year', release_year,
                                'appearance_count', appearance_count
                            ) as metadata,
                            1 as priority
                        FROM graph_nodes
                        WHERE node_id = ANY(:node_ids)
                          AND node_type = 'song'
                    ),
                    other_nodes AS (
                        -- Second priority: other nodes to fill up to limit
                        SELECT
                            node_id as id,
                            node_id as track_id,
                            0 as x_position,
                            0 as y_position,
                            json_build_object(
                                'title', label,
                                'artist', artist_name,
                                'node_type', node_type,
                                'category', category,
                                'genre', category,
                                'release_year', release_year,
                                'appearance_count', appearance_count
                            ) as metadata,
                            2 as priority
                        FROM graph_nodes
                        WHERE node_id != ALL(:node_ids)
                          AND node_type = 'song'
                        ORDER BY appearance_count DESC
                        LIMIT :remaining_limit
                    )
                    SELECT * FROM (
                        SELECT * FROM edge_nodes
                        UNION ALL
                        SELECT * FROM other_nodes
                    ) combined
                    ORDER BY priority, appearance_count DESC
                """)

                # Calculate how many additional nodes to fetch
                remaining_limit = max(0, 1000 - len(referenced_node_ids))

                nodes_result = await session.execute(nodes_query, {
                    "node_ids": list(referenced_node_ids),
                    "remaining_limit": remaining_limit
                })
            else:
                # No edges, just get top nodes
                nodes_query = text("""
                    SELECT
                        node_id as id,
                        node_id as track_id,
                        0 as x_position,
                        0 as y_position,
                        json_build_object(
                            'title', label,
                            'artist', artist_name,
                            'node_type', node_type,
                            'category', category,
                            'genre', category,
                            'release_year', release_year,
                            'appearance_count', appearance_count
                        ) as metadata
                    FROM graph_nodes
                    WHERE node_type = 'song'
                    ORDER BY appearance_count DESC
                    LIMIT 1000
                """)
                nodes_result = await session.execute(nodes_query)

            nodes = []
            for row in nodes_result:
                # Get the metadata from the view
                metadata = dict(row.metadata) if row.metadata else {}

                # Add computed fields
                artist = metadata.get('artist', 'Unknown')
                title = metadata.get('title', 'Unknown')
                if artist and artist != 'Unknown':
                    metadata['label'] = f"{artist} - {title}"
                else:
                    metadata['label'] = title

                metadata['node_type'] = 'song'
                metadata['category'] = metadata.get('genre', 'Electronic')
                metadata['appearance_count'] = metadata.get('appearance_count', 0)

                node_data = {
                    'id': str(row.id),
                    'track_id': str(row.track_id),
                    'position': {
                        'x': float(row.x_position) if row.x_position is not None else 0.0,
                        'y': float(row.y_position) if row.y_position is not None else 0.0
                    },
                    'metadata': metadata
                }
                nodes.append(node_data)

        logger.info(f"Returning {len(nodes)} nodes and {len(edges)} edges")
        return {
            'nodes': nodes,
            'edges': edges,
            'metadata': {
                'total_nodes': len(nodes),
                'total_edges': len(edges),
                'generated_at': datetime.utcnow().isoformat()
            }
        }

    except Exception as e:
        logger.error(f"Error in get_graph_data: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve graph data")

@app.get("/api/graph/search")
async def search_graph(
    q: str,
    type: str = "fuzzy",
    fields: str = "title,artist,album,genres",
    limit: int = 20,
    offset: int = 0
):
    """Search graph nodes and tracks."""
    try:
        # Execute search with circuit breaker
        search_results = await db_circuit_breaker.call(
            search_tracks,
            q.strip(),
            type,
            fields.split(','),
            limit,
            offset
        )

        return {
            "results": search_results["results"],
            "total": search_results["total"],
            "limit": limit,
            "offset": offset,
            "query": q,
            "suggestions": search_results.get("suggestions", []),
            "facets": {},
            "status": "ok"
        }

    except Exception as e:
        logger.error(f"Error in search_graph: {e}")
        # Return fallback response for graceful degradation
        return {
            "results": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
            "query": q,
            "suggestions": [],
            "facets": {},
            "status": "Search service temporarily offline"
        }

@app.get("/test/adjacency")
async def test_adjacency():
    """Test endpoint to verify adjacency data directly."""
    try:
        async with async_session() as session:
            query = text("""
                SELECT COUNT(*) as count
                FROM song_adjacency sa
                JOIN songs s1 ON sa.song_id_1 = s1.song_id
                JOIN songs s2 ON sa.song_id_2 = s2.song_id
                WHERE sa.occurrence_count >= 1
                  AND s1.primary_artist_id != s2.primary_artist_id
            """)
            result = await session.execute(query)
            count = result.scalar()

            return {
                "total_adjacencies": count,
                "message": "Direct adjacency query test"
            }
    except Exception as e:
        logger.error(f"Test adjacency endpoint error: {e}")
        return {"error": str(e)}

@app.get("/test/nodes")
async def test_nodes():
    """Simple test endpoint to verify database connection."""
    try:
        async with async_session() as session:
            query = text("SELECT COUNT(*) as count FROM graph_nodes WHERE node_type = 'song'")
            result = await session.execute(query)
            count = result.scalar()

            # Get sample data
            query2 = text("SELECT * FROM graph_nodes WHERE node_type = 'song' LIMIT 3")
            result2 = await session.execute(query2)
            sample_data = [dict(row._mapping) for row in result2]

            return {
                "count": count,
                "sample_data": sample_data
            }
    except Exception as e:
        logger.error(f"Test endpoint error: {e}")
        return {"error": str(e)}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Test database
        async with async_session() as session:
            await session.execute(text("SELECT 1"))
        
        # Test Redis
        await redis_pool.ping()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "graph-visualization-api"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# ----- User Setlists API -----
class UserSetlist(BaseModel):
    name: str
    track_ids: List[str]
    notes: Optional[str] = None

@app.post("/api/user-setlists")
async def create_user_setlist(payload: UserSetlist):
    try:
        async with async_session() as session:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS musicdb.user_setlists (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            """))
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS musicdb.user_setlist_tracks (
                    setlist_id UUID REFERENCES musicdb.user_setlists(id) ON DELETE CASCADE,
                    position INT NOT NULL,
                    track_id UUID NOT NULL,
                    PRIMARY KEY (setlist_id, position)
                );
            """))

            res = await session.execute(text(
                "INSERT INTO musicdb.user_setlists (name, notes) VALUES (:name, :notes) RETURNING id"
            ), {"name": payload.name, "notes": payload.notes})
            setlist_id = res.scalar()

            for i, tid in enumerate(payload.track_ids, start=1):
                await session.execute(text(
                    "INSERT INTO musicdb.user_setlist_tracks (setlist_id, position, track_id) VALUES (:sid, :pos, :tid)"
                ), {"sid": setlist_id, "pos": i, "tid": tid})

            await session.commit()
            return {"status": "ok", "id": str(setlist_id), "tracks": len(payload.track_ids)}
    except Exception as e:
        logger.error(f"Error creating user setlist: {e}")
        raise HTTPException(status_code=500, detail="Failed to save setlist")

@app.get("/api/v1/visualization/search")
async def search_visualization_tracks(
    q: str,
    type: str = "fuzzy", 
    fields: str = "title,artist,album,genres",
    limit: int = 20,
    offset: int = 0
):
    """Search tracks for visualization with database query."""
    try:
        # Execute search with circuit breaker
        search_results = await db_circuit_breaker.call(
            search_tracks,
            q.strip(),
            type,
            fields.split(','),
            limit,
            offset
        )
        
        return {
            "results": search_results["results"],
            "total": search_results["total"],
            "limit": limit,
            "offset": offset,
            "query": q,
            "suggestions": search_results.get("suggestions", []),
            "facets": {},
            "status": "ok"
        }
        
    except Exception as e:
        logger.error(f"Error in search_visualization_tracks: {e}")
        # Return fallback response for graceful degradation
        return {
            "results": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
            "query": q,
            "suggestions": [],
            "facets": {},
            "status": "Search service temporarily offline"
        }

@app.post("/api/v1/visualization/graph")
async def get_visualization_graph(query: GraphQuery):
    """Get graph data for visualization."""
    try:
        # Get nodes
        nodes_result = await db_circuit_breaker.call(
            get_graph_nodes,
            query.center_node_id,
            query.max_depth,
            query.max_nodes,
            query.filters,
            query.max_nodes,  # limit
            0  # offset
        )

        nodes = nodes_result['nodes']

        # Get edges for the nodes
        node_ids = [node['id'] for node in nodes]
        edges_result = await db_circuit_breaker.call(
            get_graph_edges,
            node_ids,
            1000,  # limit
            0      # offset
        )
        edges = edges_result['edges']
        
        graph_data = {
            'nodes': nodes,
            'edges': edges,
            'metadata': {
                'total_nodes': len(nodes),
                'total_edges': len(edges),
                'center_node': query.center_node_id,
                'max_depth': query.max_depth,
                'generated_at': datetime.utcnow().isoformat()
            }
        }
        
        return graph_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_visualization_graph: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve graph data")

@app.post("/api/v1/visualization/nodes/batch")
async def create_nodes_batch(batch: NodeBatch, background_tasks: BackgroundTasks):
    """Create nodes in batch (background processing)."""
    background_tasks.add_task(process_node_batch, batch.nodes, batch.batch_id)
    return {
        'batch_id': batch.batch_id,
        'status': 'processing',
        'node_count': len(batch.nodes)
    }

@app.get("/api/v1/visualization/batch/{batch_id}/status")
async def get_batch_status(batch_id: str):
    """Get batch processing status."""
    try:
        status_data = await redis_pool.get(f"batch:{batch_id}")
        if not status_data:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        return json.loads(status_data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid batch status data")

# WebSocket endpoint for real-time updates
@app.websocket("/api/graph/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for real-time graph collaboration with 2025 memory leak prevention."""
    connection_successful = await manager.connect(websocket, room_id)
    if not connection_successful:
        return  # Connection was rejected due to limits

    try:
        while True:
            data = await websocket.receive_json()

            # 2025 best practice: update activity tracking for memory leak prevention
            manager.update_activity(websocket)

            # Handle different message types
            if data.get('type') == 'graph_update':
                # Broadcast graph updates to room
                await manager.broadcast_to_room(room_id, {
                    'type': 'graph_update',
                    'data': data.get('data'),
                    'timestamp': datetime.utcnow().isoformat()
                })
            elif data.get('type') == 'cursor_position':
                # Broadcast cursor position to room
                await manager.broadcast_to_room(room_id, {
                    'type': 'cursor_position',
                    'user_id': data.get('user_id'),
                    'position': data.get('position'),
                    'timestamp': datetime.utcnow().isoformat()
                })
            elif data.get('type') == 'ping':
                # Handle ping for keepalive
                await manager.send_personal_message({'type': 'pong'}, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"WebSocket disconnected normally from room {room_id}")
    except Exception as e:
        logger.error(f"WebSocket error in room {room_id}: {e}")
        manager.disconnect(websocket)
    finally:
        # 2025 best practice: ensure cleanup in finally block
        try:
            manager.disconnect(websocket)
        except Exception as cleanup_error:
            logger.error(f"Error during WebSocket cleanup: {cleanup_error}")

@app.get("/api/graph/neighborhood/{node_id}")
async def get_node_neighborhood(node_id: str, radius: int = 1):
    """Get neighborhood around specific node for track modal display."""
    try:
        # First, let's get the target node information
        async with async_session() as session:
            # Get the target node info
            node_query = text("""
                SELECT
                    node_id as id,
                    node_id as track_id,
                    0 as x_position,
                    0 as y_position,
                    json_build_object(
                        'title', label,
                        'artist', artist_name,
                        'node_type', node_type,
                        'category', category,
                        'genre', category,
                        'release_year', release_year,
                        'appearance_count', appearance_count
                    ) as metadata
                FROM graph_nodes
                WHERE node_id = :node_id AND node_type = 'song'
            """)

            node_result = await session.execute(node_query, {"node_id": node_id})
            node_row = node_result.fetchone()

            if not node_row:
                raise HTTPException(status_code=404, detail="Node not found")

            # Transform target node to expected format
            target_node_metadata = dict(node_row.metadata) if node_row.metadata else {}
            target_node = {
                'id': str(node_row.id),
                'name': target_node_metadata.get('title', 'Unknown'),
                'artist': target_node_metadata.get('artist', 'Unknown'),
                'label': target_node_metadata.get('title', 'Unknown'),
                'type': 'track',
                'track': {
                    'id': str(node_row.id),
                    'name': target_node_metadata.get('title', 'Unknown'),
                    'artist': target_node_metadata.get('artist', 'Unknown'),
                    'genre': target_node_metadata.get('category', 'Electronic')
                }
            }

            # Now get connected tracks via adjacency
            edges_query = text("""
                SELECT
                    'song_' || sa.song_id_1::text as source_id,
                    'song_' || sa.song_id_2::text as target_id,
                    sa.occurrence_count::float as weight,
                    'adjacency' as edge_type,
                    -- Get connected track info
                    CASE
                        WHEN sa.song_id_1::text = :clean_node_id THEN gn2.label
                        ELSE gn1.label
                    END as connected_title,
                    CASE
                        WHEN sa.song_id_1::text = :clean_node_id THEN gn2.artist_name
                        ELSE gn1.artist_name
                    END as connected_artist,
                    CASE
                        WHEN sa.song_id_1::text = :clean_node_id THEN gn2.category
                        ELSE gn1.category
                    END as connected_genre,
                    CASE
                        WHEN sa.song_id_1::text = :clean_node_id THEN sa.song_id_2::text
                        ELSE sa.song_id_1::text
                    END as connected_id
                FROM song_adjacency sa
                JOIN songs s1 ON sa.song_id_1 = s1.song_id
                JOIN songs s2 ON sa.song_id_2 = s2.song_id
                LEFT JOIN graph_nodes gn1 ON gn1.node_id = 'song_' || sa.song_id_1::text
                LEFT JOIN graph_nodes gn2 ON gn2.node_id = 'song_' || sa.song_id_2::text
                WHERE (sa.song_id_1::text = :clean_node_id OR sa.song_id_2::text = :clean_node_id)
                  AND sa.occurrence_count >= 1
                  AND s1.primary_artist_id != s2.primary_artist_id
                ORDER BY sa.occurrence_count DESC
                LIMIT 20
            """)

            # Extract the UUID part from node_id (remove 'song_' prefix if present)
            clean_node_id = node_id.replace('song_', '') if node_id.startswith('song_') else node_id

            edges_result = await session.execute(edges_query, {"clean_node_id": clean_node_id})

            # Build edges and connected nodes
            edges = []
            connected_nodes = [target_node]  # Include the target node itself

            for row in edges_result:
                # Determine which node is the connected one
                if row.source_id == node_id:
                    connected_node_id = row.target_id
                else:
                    connected_node_id = row.source_id

                # Create connected node info
                connected_node = {
                    'id': connected_node_id,
                    'name': row.connected_title or 'Unknown Track',
                    'artist': row.connected_artist or 'Unknown Artist',
                    'label': row.connected_title or 'Unknown Track',
                    'type': 'track',
                    'track': {
                        'id': row.connected_id,
                        'name': row.connected_title or 'Unknown Track',
                        'artist': row.connected_artist or 'Unknown Artist',
                        'genre': row.connected_genre or 'Electronic'
                    }
                }
                connected_nodes.append(connected_node)

                # Create edge
                edge = {
                    'id': f"{row.source_id}__{row.target_id}",
                    'source': row.source_id,
                    'target': row.target_id,
                    'weight': float(row.weight),
                    'type': row.edge_type
                }
                edges.append(edge)

        # Return in the format expected by the frontend
        return {
            'data': {
                'nodes': connected_nodes,
                'edges': edges
            },
            'status': 'success',
            'timestamp': datetime.utcnow().isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_node_neighborhood: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve node neighborhood")

@app.get("/api/v1/graph")
async def get_combined_graph_data():
    """Get combined nodes and edges data for frontend visualization."""
    try:
        # Get nodes data
        async with async_session() as session:
            nodes_query = text("""
                SELECT
                    node_id as id,
                    node_id as track_id,
                    0 as x_position,
                    0 as y_position,
                    json_build_object(
                        'label', label,
                        'node_type', node_type,
                        'category', category,
                        'release_year', release_year,
                        'appearance_count', appearance_count
                    ) as metadata,
                    CURRENT_TIMESTAMP as created_at
                FROM graph_nodes
                WHERE node_type = 'song'
                ORDER BY appearance_count DESC
                LIMIT 1000
            """)
            nodes_result = await session.execute(nodes_query)
            nodes_data = [dict(row._mapping) for row in nodes_result]

            # Get edges data
            edges_query = text("""
                SELECT
                    ROW_NUMBER() OVER (ORDER BY weight DESC) as id,
                    source as source_id,
                    target as target_id,
                    weight,
                    edge_type,
                    CURRENT_TIMESTAMP as created_at
                FROM graph_edges
                ORDER BY weight DESC
                LIMIT 2000
            """)
            edges_result = await session.execute(edges_query)
            edges_data = [dict(row._mapping) for row in edges_result]

            # Transform to frontend format
            nodes = []
            for node in nodes_data:
                metadata = node.get('metadata', {}) or {}
                nodes.append({
                    'id': str(node['id']),
                    'title': metadata.get('title', 'Unknown'),
                    'artist': metadata.get('artist', 'Unknown'),
                    'type': 'track',
                    'position': {
                        'x': node.get('x_position'),
                        'y': node.get('y_position')
                    },
                    'metadata': metadata
                })

            edges = []
            for edge in edges_data:
                edges.append({
                    'id': str(edge['id']),
                    'source': str(edge['source_id']),
                    'target': str(edge['target_id']),
                    'weight': edge.get('weight', 1),
                    'type': edge.get('edge_type', 'adjacency')
                })

            return {
                'nodes': nodes,
                'edges': edges,
                'total_nodes': len(nodes),
                'total_edges': len(edges)
            }

    except Exception as e:
        logger.error(f"Error getting combined graph data: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve graph data")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8084,
        reload=False,
        workers=1,
        loop="uvloop",
        access_log=True
    )
# Cache bust: 1758790368
# Cache bust: 1758790461
