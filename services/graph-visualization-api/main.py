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
from sqlalchemy import text, select, func
from sqlalchemy.dialects.postgresql import UUID
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

# Database engine with optimized connection pooling
engine = create_async_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False
)

async_session = async_sessionmaker(engine, expire_on_commit=False)

# Redis connection pool
redis_pool = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, set] = {}
        self.connection_metadata: Dict[WebSocket, dict] = {}
    
    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = set()
        self.active_connections[room_id].add(websocket)
        self.connection_metadata[websocket] = {
            'room_id': room_id,
            'connected_at': time.time()
        }
        ACTIVE_CONNECTIONS.inc()
        logger.info(f"Client connected to room {room_id}")
    
    def disconnect(self, websocket: WebSocket):
        metadata = self.connection_metadata.get(websocket)
        if metadata:
            room_id = metadata['room_id']
            if room_id in self.active_connections:
                self.active_connections[room_id].discard(websocket)
                if not self.active_connections[room_id]:
                    del self.active_connections[room_id]
            del self.connection_metadata[websocket]
            ACTIVE_CONNECTIONS.dec()
            logger.info(f"Client disconnected from room {room_id}")
    
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
    filters: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
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
                    # Get all nodes with limit
                    query = text("""
                        SELECT id, track_id, x_position, y_position, metadata 
                        FROM musicdb.nodes 
                        ORDER BY created_at DESC 
                        LIMIT :max_nodes
                    """)
                    result = await session.execute(query, {"max_nodes": max_nodes})
                
                nodes = []
                for row in result:
                    node_data = {
                        'id': str(row.id),
                        'track_id': str(row.track_id),
                        'position': {
                            'x': float(row.x_position) if row.x_position is not None else 0.0,
                            'y': float(row.y_position) if row.y_position is not None else 0.0
                        },
                        'metadata': row.metadata or {}
                    }
                    nodes.append(node_data)
                
                return nodes
                
            except Exception as e:
                logger.error(f"Database error in get_graph_nodes: {e}")
                raise HTTPException(status_code=500, detail="Database query failed")

@cache_result(ttl=300)  # Cache for 5 minutes
async def get_graph_edges(node_ids: List[str] = None) -> List[Dict[str, Any]]:
    """Get graph edges, optionally filtered by node IDs."""
    with DATABASE_QUERY_DURATION.labels(query_type='get_edges').time():
        async with async_session() as session:
            try:
                if node_ids:
                    query = text("""
                        SELECT id, source_id, target_id, weight, edge_type
                        FROM musicdb.edges
                        WHERE source_id = ANY(:node_ids) OR target_id = ANY(:node_ids)
                    """)
                    result = await session.execute(query, {"node_ids": node_ids})
                else:
                    query = text("""
                        SELECT id, source_id, target_id, weight, edge_type
                        FROM musicdb.edges
                        LIMIT 1000
                    """)
                    result = await session.execute(query)
                
                edges = []
                for row in result:
                    edge_data = {
                        'id': str(row.id),
                        'source_id': str(row.source_id),
                        'target_id': str(row.target_id),
                        'weight': float(row.weight),
                        'edge_type': row.edge_type
                    }
                    edges.append(edge_data)
                
                return edges
                
            except Exception as e:
                logger.error(f"Database error in get_graph_edges: {e}")
                raise HTTPException(status_code=500, detail="Database query failed")

async def bulk_insert_nodes(nodes_data: List[Dict[str, Any]]) -> int:
    """Bulk insert nodes with conflict resolution."""
    with DATABASE_QUERY_DURATION.labels(query_type='bulk_insert').time():
        async with async_session() as session:
            try:
                query = text("""
                    SELECT musicdb.bulk_insert_nodes(:node_data)
                """)
                result = await session.execute(
                    query, 
                    {"node_data": json.dumps(nodes_data)}
                )
                await session.commit()
                return result.scalar()
                
            except Exception as e:
                await session.rollback()
                logger.error(f"Database error in bulk_insert_nodes: {e}")
                raise HTTPException(status_code=500, detail="Bulk insert failed")

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
    # Startup
    global redis_pool
    redis_pool = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
    
    # Test database connection
    async with async_session() as session:
        await session.execute(text("SELECT 1"))
    
    logger.info("Graph Visualization API started successfully")
    yield
    
    # Shutdown
    if redis_pool:
        await redis_pool.close()
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
    allow_origins=["*"],  # Configure appropriately for production
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

@app.post("/api/v1/visualization/graph")
async def get_visualization_graph(query: GraphQuery):
    """Get graph data for visualization."""
    try:
        # Get nodes
        nodes = await db_circuit_breaker.call(
            get_graph_nodes,
            query.center_node_id,
            query.max_depth,
            query.max_nodes,
            query.filters
        )
        
        # Get edges for the nodes
        node_ids = [node['id'] for node in nodes]
        edges = await db_circuit_breaker.call(get_graph_edges, node_ids)
        
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

# WebSocket endpoint for real-time collaboration
@app.websocket("/api/v1/visualization/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    """WebSocket endpoint for real-time graph collaboration."""
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_json()
            
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
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

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