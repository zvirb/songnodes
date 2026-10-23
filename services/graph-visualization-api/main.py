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
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Depends, Request, Query
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text, select, func, bindparam
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import prometheus_client
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import logging
import os
import catalog

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import secrets manager for unified credential management
try:
    import sys
    sys.path.insert(0, '/app/common')
    from secrets_manager import get_database_url, get_redis_config, validate_secrets
    logger.info("✅ Secrets manager imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import secrets_manager: {e}")
    logger.warning("Falling back to environment variables")

# Prometheus metrics
REQUEST_COUNT = Counter('graph_api_requests_total', 'Total API requests', ['method', 'endpoint', 'status'])
REQUEST_DURATION = Histogram('graph_api_request_duration_seconds', 'Request duration', ['endpoint'])
ACTIVE_CONNECTIONS = Gauge('graph_api_websocket_connections', 'Active WebSocket connections')
CACHE_HITS = Counter('graph_api_cache_hits_total', 'Cache hits')
CACHE_MISSES = Counter('graph_api_cache_misses_total', 'Cache misses')
DATABASE_QUERY_DURATION = Histogram('graph_api_db_query_duration_seconds', 'Database query duration', ['query_type'])

# Configuration - use secrets_manager if available
try:
    DATABASE_URL = get_database_url(async_driver=True, use_connection_pool=True)
    redis_config = get_redis_config()
    REDIS_HOST = redis_config['host']
    REDIS_PORT = redis_config['port']
    REDIS_PASSWORD = redis_config.get('password')
    logger.info(f"✅ Using secrets_manager for database and Redis connection. DATABASE_URL scheme: {DATABASE_URL.split(':')[0]}")
except NameError:
    # Fallback: ensure we use asyncpg driver for async SQLAlchemy
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://musicdb_user:musicdb_secure_pass_2024@db-connection-pool:6432/musicdb')
    REDIS_HOST = os.getenv('REDIS_HOST', 'musicdb-redis')
    REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
    REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')
    logger.warning("⚠️ Using fallback config from environment")

# CRITICAL FIX: Ensure asyncpg driver is used regardless of secrets_manager return value
# The DATABASE_URL from Kubernetes secrets may have postgresql:// scheme, but we MUST use asyncpg
if DATABASE_URL and not DATABASE_URL.startswith('postgresql+asyncpg://'):
    DATABASE_URL = DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://')
    DATABASE_URL = DATABASE_URL.replace('postgresql+psycopg2://', 'postgresql+asyncpg://')
    logger.info(f"✅ Fixed DATABASE_URL scheme to use asyncpg driver: {DATABASE_URL.split('@')[1].split('/')[0] if '@' in DATABASE_URL else 'unknown'}")
CACHE_TTL = int(os.getenv('CACHE_TTL', 300))  # 5 minutes
MAX_CONNECTIONS = int(os.getenv('MAX_CONNECTIONS', 1000))

# Database engine with 2025 best practices for memory leak prevention
engine = create_async_engine(
    DATABASE_URL,
    pool_size=15,  # Reduced from 20 to prevent overflow
    max_overflow=15,  # Reduced from 30 to prevent excessive connections
    pool_pre_ping=True,  # Validate connections before use (REQUIRED)
    pool_recycle=3600,  # Recycle connections after 1 hour (REQUIRED)
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
    max_depth: int = Field(default=3, ge=1, le=3, description="Maximum traversal depth")
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

async def get_graph_nodes(center_node_id=None, max_depth=3, max_nodes=100, filters=None, limit=100, offset=0):
    if not 1 <= max_depth <= 3 or not 1 <= min(limit, max_nodes) <= 15000 or offset < 0:
        raise HTTPException(status_code=422, detail="Invalid graph query bounds")
    async with async_session() as session:
        return await catalog.nodes(session, center_node_id, max_depth, max_nodes, limit, offset)


async def search_tracks(query, search_type="fuzzy", fields=None, limit=20, offset=0):
    async with async_session() as session:
        return await catalog.search(session, query, limit, offset)


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

async def get_graph_edges(node_ids=None, limit=1000, offset=0):
    async with async_session() as session:
        return await catalog.edges(session, node_ids, limit, offset)

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
        if redis_pool is None:
            logger.error("Redis pool not initialized, cannot update batch status")
            return

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

    # Create async Redis connection pool (2025 best practice for memory leak prevention)
    redis_connection_pool = redis.ConnectionPool(
        host=REDIS_HOST,
        port=REDIS_PORT,
        password=REDIS_PASSWORD,
        max_connections=50,
        decode_responses=True
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
        await redis_pool.aclose()
    if redis_connection_pool:
        await redis_connection_pool.disconnect()
    await engine.dispose()
    logger.info("Graph Visualization API shutdown complete")

# FastAPI application
app = FastAPI(
    title="Graph Visualization API",
    description="High-performance API for song relationship visualization",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware - CORS configurable for security
# ✅ FIX: Allow both localhost and 127.0.0.1 origins for browser compatibility
CORS_ALLOWED_ORIGINS = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3006,http://127.0.0.1:3006,http://localhost:3000,http://127.0.0.1:3000'
).split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
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
    limit: int = Query(5000, ge=1, le=15000), offset: int = Query(0, ge=0),
    center_node_id: Optional[str] = None, max_depth: int = Query(3, ge=1, le=3)
):
    return await get_graph_nodes(center_node_id, max_depth, limit, {}, limit, offset)


@app.get("/api/graph/edges")
async def get_edges(
    limit: int = Query(30000, ge=1, le=50000), offset: int = Query(0, ge=0),
    node_ids: Optional[str] = None
):
    parsed = [value.strip() for value in node_ids.split(',') if value.strip()] if node_ids is not None else None
    if parsed is not None and len(parsed) > 15000:
        raise HTTPException(status_code=422, detail="Too many node IDs")
    return await get_graph_edges(parsed, limit, offset)


@app.get("/api/graph/data")
async def get_graph_data(limit: int = Query(5000, ge=1, le=15000)):
    async with async_session() as session:
        # Counts, selected nodes, and induced edges share one PostgreSQL snapshot.
        await session.connection(execution_options={"isolation_level": "REPEATABLE READ"})
        return await catalog.graph(session, limit)


@app.get("/api/graph/stats")
async def get_graph_stats():
    async with async_session() as session:
        return await catalog.statistics(session)

@app.get("/api/graph/search")
@app.get("/api/v1/visualization/search")
async def search_graph(
    q: str = Query(..., min_length=1, max_length=500), type: str = "fuzzy",
    fields: str = "title,artist,album,genres", limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    results = await search_tracks(q, type, fields.split(','), limit, offset)
    return {**results, 'limit': limit, 'offset': offset, 'query': q, 'facets': {}, 'status': 'ok'}

@app.get("/test/adjacency")
async def test_adjacency():
    """Test endpoint to verify adjacency data directly."""
    try:
        async with async_session() as session:
            query = text("""
                SELECT COUNT(*) as count
                FROM silver_track_transitions tr
                JOIN tracks t1 ON tr.from_track_id = t1.id
                JOIN tracks t2 ON tr.to_track_id = t2.id
                WHERE tr.occurrence_count >= 1
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

# =============================================================================
# Container-Aware Memory Monitoring
# =============================================================================

def get_container_memory_usage() -> float:
    """
    Get container memory usage percentage (cgroup-aware).

    Returns container memory usage if running in Docker, otherwise falls back
    to host memory usage. Fixes the health check anti-pattern where containers
    reported "unhealthy" based on host memory instead of their allocated limits.

    Returns:
        float: Memory usage as percentage (0-100)
    """
    from pathlib import Path

    try:
        # Try cgroup v2 first (newer Docker versions)
        memory_current = Path("/sys/fs/cgroup/memory.current")
        memory_max = Path("/sys/fs/cgroup/memory.max")

        if memory_current.exists() and memory_max.exists():
            current = int(memory_current.read_text().strip())
            limit = memory_max.read_text().strip()

            if limit != "max":
                return (current / int(limit)) * 100
    except (FileNotFoundError, ValueError, PermissionError):
        pass

    try:
        # Fall back to cgroup v1 (older Docker versions)
        usage_file = Path("/sys/fs/cgroup/memory/memory.usage_in_bytes")
        limit_file = Path("/sys/fs/cgroup/memory/memory.limit_in_bytes")

        if usage_file.exists() and limit_file.exists():
            current = int(usage_file.read_text().strip())
            limit = int(limit_file.read_text().strip())

            # Sanity check: limit shouldn't be absurdly high
            # (some systems report very large limits for "unlimited")
            if limit < (1024 ** 4):  # Less than 1TB = reasonable limit
                return (current / limit) * 100
    except (FileNotFoundError, ValueError, PermissionError):
        pass

    # Not in container or cgroup unavailable, fall back to host memory
    import psutil
    return psutil.virtual_memory().percent

@app.get("/health")
async def health_check():
    """
    Health check endpoint with comprehensive resource monitoring per CLAUDE.md Section 5.3.4.

    Monitors:
    - Database pool usage (503 if > 80%)
    - System memory (503 if > 85%)
    - Database connectivity
    - Redis connectivity

    Returns health status with resource metrics.
    Raises 503 Service Unavailable if resource thresholds exceeded.
    """
    try:
        import psutil

        # Check database pool usage
        try:
            pool = engine.pool
            pool_size = pool.size()
            pool_max = pool.size() + pool._max_overflow
            pool_usage = pool_size / pool_max if pool_max > 0 else 0

            if pool_usage > 0.8:
                raise HTTPException(
                    status_code=503,
                    detail=f"Database pool exhausted: {pool_usage:.1%} usage (threshold: 80%)"
                )
        except AttributeError:
            # Pool doesn't have expected attributes
            pool_usage = 0

        # Check container memory (cgroup-aware)
        memory_percent = get_container_memory_usage()
        if memory_percent > 85:
            raise HTTPException(
                status_code=503,
                detail=f"Memory usage critical: {memory_percent:.1f}% (threshold: 85%)"
            )

        # Test database connectivity
        db_connected = False
        try:
            async with async_session() as session:
                await session.execute(text("SELECT 1"))
            db_connected = True
        except Exception as db_error:
            logger.error(f"Database health check failed: {db_error}")

        # Test Redis connectivity
        redis_connected = False
        try:
            await redis_pool.ping()
            redis_connected = True
        except Exception as redis_error:
            logger.error(f"Redis health check failed: {redis_error}")

        return {
            "status": "healthy" if (db_connected and redis_connected) else "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "graph-visualization-api",
            "checks": {
                "database_pool": {
                    "status": "ok",
                    "usage": pool_usage,
                    "threshold": 0.8
                },
                "memory": {
                    "status": "ok",
                    "usage": memory_percent,
                    "threshold": 85
                },
                "database": {
                    "status": "ok" if db_connected else "degraded",
                    "connected": db_connected
                },
                "redis": {
                    "status": "ok" if redis_connected else "degraded",
                    "connected": redis_connected
                }
            }
        }
    except HTTPException:
        # Re-raise 503 errors
        raise
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Service unhealthy: {str(e)}"
        )

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
async def get_node_neighborhood(node_id: str, radius: int = Query(1, ge=1, le=2)):
    async with async_session() as session:
        data = await catalog.graph(session, limit=150, center=node_id, depth=radius)
    if not data['nodes']:
        raise HTTPException(status_code=404, detail="Node not found")
    # Preserve the detail-modal envelope and nested track contract.
    for node in data['nodes']:
        node.update(name=node['title'], label=node['title'], type='track', track={
            'id': node['track_id'], 'name': node['title'], 'artist': node['artist'],
            'genre': node['metadata']['genre'],
        })
    return {'data': {'nodes': data['nodes'], 'edges': data['edges']},
            'status': 'success', 'timestamp': data['metadata']['generated_at']}


@app.get("/api/graph")
@app.get("/api/v1/graph")
async def get_combined_graph_data(limit: int = Query(5000, ge=1, le=15000)):
    result = await get_graph_data(limit)
    return {**result, 'total_nodes': len(result['nodes']), 'total_edges': len(result['edges'])}

if __name__ == "__main__":
    import sys

    # Validate secrets before starting service
    if not validate_secrets():
        logger.error("❌ Required secrets missing - exiting")
        sys.exit(1)

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
