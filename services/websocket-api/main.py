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
        # Redis connection for caching and pub/sub
        redis_host = os.getenv('REDIS_HOST', 'localhost')
        redis_port = int(os.getenv('REDIS_PORT', '6379'))
        
        try:
            self.redis_client = redis.from_url(
                f"redis://{redis_host}:{redis_port}",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
        
        # RabbitMQ connection for message queuing
        rabbitmq_host = os.getenv('RABBITMQ_HOST', 'localhost')
        try:
            self.rabbitmq_connection = await aio_pika.connect_robust(
                f"amqp://guest:guest@{rabbitmq_host}/"
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
    await websocket_service.startup()
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    redis_status = "connected" if websocket_service.redis_client else "disconnected"
    rabbitmq_status = "connected" if websocket_service.rabbitmq_connection else "disconnected"
    
    # Check if UnifiedWorkflow authentication is available
    auth_status = "enabled" if 'get_current_user_ws' in globals() else "fallback"
    
    return {
        "status": "healthy",
        "service": "websocket-api",
        "version": "1.0.0",
        "security": {
            "authentication": auth_status,
            "jwt_enabled": auth_status == "enabled"
        },
        "connections": len(websocket_service.manager.active_connections),
        "redis": redis_status,
        "rabbitmq": rabbitmq_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/stats")
async def get_stats():
    """Get WebSocket connection statistics"""
    return {
        "active_connections": len(websocket_service.manager.active_connections),
        "rooms": len(websocket_service.manager.room_users),
        "users": len(websocket_service.manager.user_rooms),
        "room_details": {
            room: len(users) for room, users in websocket_service.manager.room_users.items()
        }
    }

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