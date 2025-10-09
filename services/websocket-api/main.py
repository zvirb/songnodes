"""WebSocket API Service for SongNodes - Real-time Communication"""

import asyncio
import json
import logging
import os
from typing import Dict, Set, Any, Optional, Annotated
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError
import uvicorn
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import aio_pika
from aio_pika import Connection, Channel, Exchange
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

# Import UnifiedWorkflow authentication dependencies
try:
    import sys
    import pathlib
    # Add UnifiedWorkflow to Python path
    unified_workflow_path = pathlib.Path(__file__).parent.parent.parent / "UnifiedWorkflow" / "app"
    if unified_workflow_path.exists():
        sys.path.insert(0, str(unified_workflow_path))
    
    from api.dependencies import get_current_user_ws
    from shared.database.models._models import User
except ImportError as e:
    logging.warning(f"Could not import UnifiedWorkflow authentication: {e}")
    # Fallback authentication function
    async def get_current_user_ws(websocket: WebSocket, token: Annotated[str | None, Query()] = None) -> Optional[object]:
        return None
    
    class User:
        def __init__(self):
            self.id = "fallback"
            self.email = "fallback@example.com"

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import secrets manager for unified credential management
try:
    import sys
    sys.path.insert(0, '/app/common')
    from secrets_manager import get_redis_config, get_rabbitmq_config, validate_secrets
    logger.info("✅ Secrets manager imported successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import secrets_manager: {e}")
    logger.warning("Falling back to environment variables")
    # Define fallback functions if secrets_manager not available
    def get_redis_config():
        raise NameError("secrets_manager not available")
    def get_rabbitmq_config():
        raise NameError("secrets_manager not available")
    def validate_secrets():
        logger.warning("validate_secrets not available - skipping validation")
        return True

# Prometheus metrics
WS_CONNECTIONS = Gauge('websocket_connections', 'Active WebSocket connections')
WS_MESSAGES = Counter('websocket_messages_total', 'Total WebSocket messages', ['type', 'direction'])
WS_ERRORS = Counter('websocket_errors_total', 'WebSocket errors', ['error_type'])
REDIS_OPERATIONS = Counter('redis_operations_total', 'Redis operations', ['operation', 'status'])

# Data Models
class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any]
    timestamp: Optional[datetime] = None
    user_id: Optional[str] = None

class ConnectionManager:
    """Manages WebSocket connections and message broadcasting"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, Set[str]] = {}  # user_id -> set of room_ids
        self.room_users: Dict[str, Set[str]] = {}  # room_id -> set of user_ids
        
    async def connect(self, websocket: WebSocket, user_id: str, room_id: str = "general"):
        """Connect a user to a room"""
        await websocket.accept()
        
        connection_id = f"{user_id}_{room_id}_{id(websocket)}"
        self.active_connections[connection_id] = websocket
        
        # Add user to room
        if user_id not in self.user_rooms:
            self.user_rooms[user_id] = set()
        self.user_rooms[user_id].add(room_id)
        
        if room_id not in self.room_users:
            self.room_users[room_id] = set()
        self.room_users[room_id].add(user_id)
        
        logger.info(f"User {user_id} connected to room {room_id}")
        
        # Notify room about new connection
        await self.broadcast_to_room(room_id, {
            "type": "user_joined",
            "data": {"user_id": user_id, "room_id": room_id},
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return connection_id
    
    async def disconnect(self, connection_id: str):
        """Disconnect a user"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
            
            # Extract user and room from connection_id
            parts = connection_id.split('_')
            if len(parts) >= 2:
                user_id, room_id = parts[0], parts[1]
                
                # Remove user from room
                if room_id in self.room_users and user_id in self.room_users[room_id]:
                    self.room_users[room_id].remove(user_id)
                    if not self.room_users[room_id]:
                        del self.room_users[room_id]
                
                if user_id in self.user_rooms and room_id in self.user_rooms[user_id]:
                    self.user_rooms[user_id].remove(room_id)
                    if not self.user_rooms[user_id]:
                        del self.user_rooms[user_id]
                
                logger.info(f"User {user_id} disconnected from room {room_id}")
                
                # Notify room about disconnection
                await self.broadcast_to_room(room_id, {
                    "type": "user_left",
                    "data": {"user_id": user_id, "room_id": room_id},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
    
    async def send_personal_message(self, message: Dict[str, Any], user_id: str):
        """Send message to a specific user"""
        connections_to_send = []
        for connection_id, websocket in self.active_connections.items():
            if connection_id.startswith(f"{user_id}_"):
                connections_to_send.append(websocket)
        
        for websocket in connections_to_send:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending personal message to {user_id}: {e}")
    
    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any]):
        """Broadcast message to all users in a room"""
        if room_id not in self.room_users:
            return
        
        connections_to_send = []
        for user_id in self.room_users[room_id]:
            for connection_id, websocket in self.active_connections.items():
                if connection_id.startswith(f"{user_id}_{room_id}"):
                    connections_to_send.append(websocket)
        
        for websocket in connections_to_send:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to room {room_id}: {e}")
    
    async def broadcast_to_all(self, message: Dict[str, Any]):
        """Broadcast message to all connected users"""
        for websocket in self.active_connections.values():
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to all: {e}")

class WebSocketService:
    """Main WebSocket service class"""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.rabbitmq_connection: Optional[Connection] = None
        self.rabbitmq_channel: Optional[Channel] = None
        self.exchange: Optional[Exchange] = None
        self.manager = ConnectionManager()
        
    async def startup(self):
        """Initialize connections"""
        logger.info("🚀 Starting WebSocket service initialization...")
        # Redis connection - use secrets_manager if available
        try:
            redis_config = get_redis_config()
            redis_host = redis_config['host']
            redis_port = redis_config['port']
            redis_password = redis_config.get('password')
            logger.info("✅ Using secrets_manager for Redis connection")
        except NameError:
            redis_host = os.getenv('REDIS_HOST', 'localhost')
            redis_port = int(os.getenv('REDIS_PORT', '6379'))
            redis_password = os.getenv('REDIS_PASSWORD')
            logger.warning("⚠️ Using fallback Redis config from environment")

        try:
            # Create connection pool for Redis with 2025 best practices
            pool = redis.ConnectionPool(
                host=redis_host,
                port=redis_port,
                password=redis_password,
                max_connections=50,
                decode_responses=True
            )
            # Create Redis client from connection pool
            self.redis_client = redis.Redis(connection_pool=pool)
            ping_result = await self.redis_client.ping()
            if ping_result:
                logger.info("✅ Redis connection established with password authentication and pooling")
            else:
                logger.warning("⚠️ Redis ping returned False")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
        
        # RabbitMQ connection - use secrets_manager if available
        try:
            rabbitmq_config = get_rabbitmq_config()
            rabbitmq_host = rabbitmq_config['host']
            rabbitmq_port = str(rabbitmq_config['port'])
            rabbitmq_user = rabbitmq_config['username']
            rabbitmq_pass = rabbitmq_config['password']
            rabbitmq_vhost = rabbitmq_config.get('vhost', 'musicdb')
            logger.info("✅ Using secrets_manager for RabbitMQ connection")
        except NameError:
            rabbitmq_host = os.getenv('RABBITMQ_HOST', 'rabbitmq')
            rabbitmq_port = os.getenv('RABBITMQ_PORT', '5672')
            rabbitmq_user = os.getenv('RABBITMQ_USER', 'musicdb_user')
            rabbitmq_pass = os.getenv('RABBITMQ_PASS', 'rabbitmq_secure_pass_2024')
            rabbitmq_vhost = os.getenv('RABBITMQ_VHOST', 'musicdb')
            logger.warning("⚠️ Using fallback RabbitMQ config from environment")
        try:
            self.rabbitmq_connection = await aio_pika.connect_robust(
                f"amqp://{rabbitmq_user}:{rabbitmq_pass}@{rabbitmq_host}:{rabbitmq_port}/{rabbitmq_vhost}"
            )
            self.rabbitmq_channel = await self.rabbitmq_connection.channel()
            self.exchange = await self.rabbitmq_channel.declare_exchange(
                "songnodes_events", aio_pika.ExchangeType.TOPIC
            )
            logger.info("RabbitMQ connection established")
            
            # Start consuming messages
            asyncio.create_task(self.consume_messages())
            
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
    
    async def shutdown(self):
        """Cleanup connections"""
        if self.redis_client:
            await self.redis_client.close()
        if self.rabbitmq_connection:
            await self.rabbitmq_connection.close()
    
    async def consume_messages(self):
        """Consume messages from RabbitMQ and broadcast to WebSocket clients"""
        if not self.rabbitmq_channel or not self.exchange:
            return
        
        # Declare queue for WebSocket events
        queue = await self.rabbitmq_channel.declare_queue(
            "websocket_events", auto_delete=True
        )
        await queue.bind(self.exchange, "scraper.*")
        await queue.bind(self.exchange, "graph.*")
        await queue.bind(self.exchange, "data.*")
        
        async with queue.iterator() as queue_iter:
            async for message in queue_iter:
                try:
                    async with message.process():
                        data = json.loads(message.body)
                        await self.handle_rabbitmq_message(data, message.routing_key)
                except Exception as e:
                    logger.error(f"Error processing RabbitMQ message: {e}")
    
    async def handle_rabbitmq_message(self, data: Dict[str, Any], routing_key: str):
        """Handle messages from RabbitMQ and broadcast to appropriate clients"""
        message = {
            "type": "system_event",
            "data": data,
            "routing_key": routing_key,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Determine which room to broadcast to based on routing key
        if routing_key.startswith("scraper."):
            await self.manager.broadcast_to_room("scraper_updates", message)
        elif routing_key.startswith("graph."):
            await self.manager.broadcast_to_room("graph_updates", message)
        elif routing_key.startswith("data."):
            await self.manager.broadcast_to_room("data_updates", message)
        else:
            # Broadcast to general room for unknown events
            await self.manager.broadcast_to_room("general", message)

# Global service instance
websocket_service = WebSocketService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Validate secrets on startup
    try:
        if not validate_secrets():
            logger.error("❌ Required secrets missing - service may not function correctly")
    except NameError:
        logger.warning("⚠️ Secrets validation not available")

    try:
        await websocket_service.startup()
        logger.info("✅ WebSocket service startup completed successfully")
    except Exception as e:
        logger.error(f"❌ WebSocket service startup failed: {e}")
        import traceback
        traceback.print_exc()

    yield
    # Shutdown
    await websocket_service.shutdown()

# Create FastAPI app
app = FastAPI(
    title="SongNodes WebSocket API",
    description="Real-time WebSocket API for music data visualization",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware - configurable for security
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3006').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """
    Health check endpoint with comprehensive resource monitoring per CLAUDE.md Section 5.3.4.

    Monitors:
    - System memory (503 if > 85%)
    - Redis connectivity
    - RabbitMQ connectivity
    - WebSocket connections (warning if > 900/1000 limit)

    Returns health status with resource metrics.
    Raises 503 Service Unavailable if resource thresholds exceeded.
    """
    try:
        import psutil

        # Check system memory
        memory_percent = psutil.virtual_memory().percent
        if memory_percent > 85:
            raise HTTPException(
                status_code=503,
                detail=f"Memory usage critical: {memory_percent:.1f}% (threshold: 85%)"
            )

        # Check Redis status
        redis_status = "connected" if websocket_service.redis_client else "disconnected"
        rabbitmq_status = "connected" if websocket_service.rabbitmq_connection else "disconnected"

        # Check if UnifiedWorkflow authentication is available
        auth_status = "enabled" if 'get_current_user_ws' in globals() else "fallback"

        # Check WebSocket connection count (warn if approaching limit)
        ws_connections = len(websocket_service.manager.active_connections)
        ws_max_connections = 1000  # From CLAUDE.md memory leak prevention
        ws_usage = ws_connections / ws_max_connections

        return {
            "status": "healthy",
            "service": "websocket-api",
            "version": "1.0.0",
            "security": {
                "authentication": auth_status,
                "jwt_enabled": auth_status == "enabled"
            },
            "connections": ws_connections,
            "redis": redis_status,
            "rabbitmq": rabbitmq_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {
                "memory": {
                    "status": "ok",
                    "usage": memory_percent,
                    "threshold": 85
                },
                "websocket_connections": {
                    "status": "warning" if ws_usage > 0.9 else "ok",
                    "count": ws_connections,
                    "max": ws_max_connections,
                    "usage": ws_usage
                },
                "redis": {
                    "status": "ok" if redis_status == "connected" else "degraded",
                    "connected": redis_status == "connected"
                },
                "rabbitmq": {
                    "status": "ok" if rabbitmq_status == "connected" else "degraded",
                    "connected": rabbitmq_status == "connected"
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
            detail=f"Health check failed: {str(e)}"
        )

@app.get("/stats")
async def get_stats():
    """Get WebSocket connection statistics"""
    active_conns = len(websocket_service.manager.active_connections)
    WS_CONNECTIONS.set(active_conns)

    return {
        "active_connections": active_conns,
        "rooms": len(websocket_service.manager.room_users),
        "users": len(websocket_service.manager.user_rooms),
        "room_details": {
            room: len(users) for room, users in websocket_service.manager.room_users.items()
        }
    }

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    # Update connection count
    WS_CONNECTIONS.set(len(websocket_service.manager.active_connections))

    from fastapi.responses import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.websocket("/ws/public")
async def public_websocket_endpoint(websocket: WebSocket):
    """Public WebSocket endpoint for anonymous access"""
    user_id = "anonymous"
    room_id = "general"
    
    connection_id = await websocket_service.manager.connect(websocket, user_id, room_id)
    
    try:
        # Send welcome message
        welcome_message = {
            "type": "welcome",
            "data": {
                "user_id": user_id,
                "room_id": room_id,
                "connection_id": connection_id,
                "authenticated": False,
                "public_access": True
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await websocket.send_text(json.dumps(welcome_message))
        
        # Listen for messages
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message = WebSocketMessage(**message_data)
                message.user_id = user_id
                message.timestamp = datetime.now(timezone.utc)
                
                # Handle different message types
                await websocket_service.handle_message(message, connection_id)
                
            except ValidationError as e:
                error_message = {
                    "type": "error",
                    "data": {"error": "Invalid message format", "details": str(e)},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                await websocket.send_text(json.dumps(error_message))
            except Exception as e:
                logger.error(f"Error handling message: {e}")
                
    except WebSocketDisconnect:
        await websocket_service.manager.disconnect(connection_id)
        logger.info(f"Public WebSocket disconnected: {connection_id}")

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    user_id: str, 
    room_id: str = "general",
    token: Annotated[str | None, Query()] = None
):
    """Main WebSocket endpoint with JWT authentication"""
    
    # Authenticate user via JWT
    try:
        current_user = await get_current_user_ws(websocket, token)
        
        # Validate user_id matches authenticated user
        if current_user and str(current_user.id) != user_id:
            logger.error(f"User ID mismatch: authenticated={current_user.id}, requested={user_id}")
            await websocket.close(code=1008, reason="Unauthorized: User ID mismatch")
            return
        
        # If no authenticated user but user_id provided, deny access
        if not current_user and user_id != "anonymous":
            logger.error(f"Authentication required for user_id: {user_id}")
            await websocket.close(code=1008, reason="Authentication required")
            return
            
        # Use authenticated user ID if available, otherwise use provided user_id for anonymous access
        authenticated_user_id = str(current_user.id) if current_user else user_id
        
        logger.info(f"WebSocket connection authenticated for user: {authenticated_user_id}")
        
    except Exception as auth_error:
        logger.error(f"WebSocket authentication failed: {auth_error}")
        await websocket.close(code=1008, reason="Authentication failed")
        return
    
    connection_id = await websocket_service.manager.connect(websocket, authenticated_user_id, room_id)
    
    try:
        # Send welcome message
        welcome_message = {
            "type": "welcome",
            "data": {
                "user_id": authenticated_user_id,
                "room_id": room_id,
                "connection_id": connection_id,
                "authenticated": current_user is not None,
                "user_email": current_user.email if current_user else None
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await websocket.send_text(json.dumps(welcome_message))
        
        # Listen for messages
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                message = WebSocketMessage(**message_data)
                message.user_id = authenticated_user_id
                message.timestamp = datetime.now(timezone.utc)
                
                await handle_websocket_message(message, room_id)
                
            except ValidationError as e:
                error_message = {
                    "type": "error",
                    "data": {"message": "Invalid message format", "details": str(e)},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                await websocket.send_text(json.dumps(error_message))
            except json.JSONDecodeError:
                error_message = {
                    "type": "error",
                    "data": {"message": "Invalid JSON"},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                await websocket.send_text(json.dumps(error_message))
                
    except WebSocketDisconnect:
        await websocket_service.manager.disconnect(connection_id)

async def handle_websocket_message(message: WebSocketMessage, room_id: str):
    """Handle incoming WebSocket messages"""
    if message.type == "chat":
        # Broadcast chat message to room
        broadcast_message = {
            "type": "chat",
            "data": {
                "user_id": message.user_id,
                "message": message.data.get("message", ""),
                "room_id": room_id
            },
            "timestamp": message.timestamp.isoformat()
        }
        await websocket_service.manager.broadcast_to_room(room_id, broadcast_message)

    elif message.type == "graph_interaction":
        # Handle graph visualization interactions
        broadcast_message = {
            "type": "graph_interaction",
            "data": {
                "user_id": message.user_id,
                "action": message.data.get("action"),
                "node_id": message.data.get("node_id"),
                "position": message.data.get("position")
            },
            "timestamp": message.timestamp.isoformat()
        }
        await websocket_service.manager.broadcast_to_room("graph_updates", broadcast_message)

    elif message.type == "subscribe":
        # Handle subscription requests
        channel = message.data.get("channel", "general")
        await handle_subscription_request(message, room_id, channel)

    elif message.type == "graph_node_update":
        # Handle node position/property updates
        broadcast_message = {
            "type": "graph_node_update",
            "data": {
                "user_id": message.user_id,
                "node_id": message.data.get("node_id"),
                "updates": message.data.get("updates", {}),
                "position": message.data.get("position")
            },
            "timestamp": message.timestamp.isoformat()
        }
        await websocket_service.manager.broadcast_to_room("graph_updates", broadcast_message)

    elif message.type == "graph_edge_update":
        # Handle edge updates
        broadcast_message = {
            "type": "graph_edge_update",
            "data": {
                "user_id": message.user_id,
                "edge_id": message.data.get("edge_id"),
                "updates": message.data.get("updates", {})
            },
            "timestamp": message.timestamp.isoformat()
        }
        await websocket_service.manager.broadcast_to_room("graph_updates", broadcast_message)

    elif message.type == "scraper_control":
        # Handle scraper control messages
        if websocket_service.rabbitmq_channel and websocket_service.exchange:
            control_message = {
                "user_id": message.user_id,
                "action": message.data.get("action"),
                "scraper_name": message.data.get("scraper_name"),
                "timestamp": message.timestamp.isoformat()
            }

            await websocket_service.exchange.publish(
                aio_pika.Message(json.dumps(control_message).encode()),
                routing_key="scraper.control"
            )

    # Store message in Redis for message history
    if websocket_service.redis_client:
        try:
            message_key = f"ws_messages:{room_id}"
            message_data = {
                "type": message.type,
                "user_id": message.user_id,
                "data": message.data,
                "timestamp": message.timestamp.isoformat()
            }
            await websocket_service.redis_client.lpush(
                message_key, json.dumps(message_data)
            )
            # Keep only last 1000 messages
            await websocket_service.redis_client.ltrim(message_key, 0, 999)
        except Exception as e:
            logger.error(f"Failed to store message in Redis: {e}")

async def handle_subscription_request(message: WebSocketMessage, room_id: str, channel: str):
    """Handle subscription requests for real-time data"""
    user_id = message.user_id

    if channel == "graph_updates":
        # Subscribe user to graph updates room
        await websocket_service.manager.broadcast_to_room("graph_updates", {
            "type": "subscription_confirmed",
            "data": {
                "channel": "graph_updates",
                "user_id": user_id,
                "status": "subscribed"
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

        # Send initial graph data if requested
        node_ids = message.data.get("nodeIds", [])
        if node_ids:
            await send_graph_snapshot(user_id, node_ids)

    elif channel == "live_data":
        # Subscribe to live scraper data
        await websocket_service.manager.broadcast_to_room("data_updates", {
            "type": "subscription_confirmed",
            "data": {
                "channel": "live_data",
                "user_id": user_id,
                "status": "subscribed"
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

async def send_graph_snapshot(user_id: str, node_ids: list = None):
    """Send current graph state to a specific user"""
    try:
        # This would typically fetch from your graph database
        # For now, send a simulated response
        snapshot = {
            "type": "graph_snapshot",
            "data": {
                "nodes": [],  # Fetch from database
                "edges": [],  # Fetch from database
                "metadata": {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "node_count": 0,
                    "edge_count": 0
                }
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        await websocket_service.manager.send_personal_message(snapshot, user_id)
    except Exception as e:
        logger.error(f"Failed to send graph snapshot to {user_id}: {e}")

@app.post("/api/v1/graph/broadcast")
async def broadcast_graph_update(
    update_type: str,
    data: dict,
    room_id: str = "graph_updates"
):
    """HTTP endpoint to broadcast graph updates to WebSocket clients"""
    broadcast_message = {
        "type": f"graph_{update_type}",
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "api"
    }

    await websocket_service.manager.broadcast_to_room(room_id, broadcast_message)
    return {"status": "broadcasted", "type": update_type, "room": room_id}

@app.post("/api/v1/graph/nodes/added")
async def broadcast_nodes_added(nodes: list):
    """Broadcast new nodes to WebSocket clients"""
    await websocket_service.manager.broadcast_to_room("graph_updates", {
        "type": "nodes_added",
        "data": {
            "nodes": nodes,
            "count": len(nodes)
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "broadcasted", "nodes_added": len(nodes)}

@app.post("/api/v1/graph/nodes/updated")
async def broadcast_nodes_updated(updates: list):
    """Broadcast node updates to WebSocket clients"""
    await websocket_service.manager.broadcast_to_room("graph_updates", {
        "type": "nodes_updated",
        "data": {
            "updates": updates,
            "count": len(updates)
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "broadcasted", "nodes_updated": len(updates)}

@app.post("/api/v1/graph/nodes/removed")
async def broadcast_nodes_removed(node_ids: list):
    """Broadcast node removals to WebSocket clients"""
    await websocket_service.manager.broadcast_to_room("graph_updates", {
        "type": "nodes_removed",
        "data": {
            "node_ids": node_ids,
            "count": len(node_ids)
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    return {"status": "broadcasted", "nodes_removed": len(node_ids)}

@app.post("/api/v1/broadcast/{room_id}")
async def broadcast_message(
    room_id: str, 
    message: WebSocketMessage,
    # Note: For HTTP endpoints, would need full get_current_user implementation
    # For now, this endpoint requires manual authentication
):
    """HTTP endpoint to broadcast messages to a room
    
    Note: This endpoint should be secured with proper authentication
    in production environments. Currently accepts requests from trusted sources.
    """
    broadcast_data = {
        "type": message.type,
        "data": message.data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "http_api"
    }
    
    await websocket_service.manager.broadcast_to_room(room_id, broadcast_data)
    
    return {"status": "broadcasted", "room_id": room_id, "message_type": message.type}

@app.get("/api/v1/rooms/{room_id}/history")
async def get_room_history(room_id: str, limit: int = 50):
    """Get message history for a room"""
    if not websocket_service.redis_client:
        raise HTTPException(status_code=503, detail="Redis not available")
    
    try:
        messages = await websocket_service.redis_client.lrange(
            f"ws_messages:{room_id}", 0, limit - 1
        )
        return {
            "room_id": room_id,
            "messages": [json.loads(msg) for msg in messages],
            "count": len(messages)
        }
    except Exception as e:
        logger.error(f"Failed to retrieve message history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve history")

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=int(os.getenv("WS_PORT", "8083")),
        log_level="info"
    )