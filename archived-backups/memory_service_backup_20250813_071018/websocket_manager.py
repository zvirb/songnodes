"""
WebSocket Manager for Memory Service
Handles real-time processing updates and notifications
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Set, Any

from fastapi import WebSocket

from .models import ProcessingStatus, WebSocketMessage

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages WebSocket connections and broadcasting for real-time updates
    Provides processing status updates and notifications to connected clients
    """
    
    def __init__(self):
        # Store active connections by user_id
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # Store processing jobs by user_id for targeted updates
        self.user_processing_jobs: Dict[int, Set[str]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept a WebSocket connection and add to active connections"""
        try:
            await websocket.accept()
            
            async with self._lock:
                if user_id not in self.active_connections:
                    self.active_connections[user_id] = []
                
                self.active_connections[user_id].append(websocket)
                
                # Initialize processing jobs set for user if not exists
                if user_id not in self.user_processing_jobs:
                    self.user_processing_jobs[user_id] = set()
            
            logger.info(f"WebSocket connected for user {user_id}")
            
            # Send connection confirmation
            await self._send_to_websocket(websocket, {
                "type": "connection_established",
                "message": "WebSocket connection established successfully",
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Failed to establish WebSocket connection for user {user_id}: {e}")
            raise
    
    def disconnect(self, user_id: int, websocket: WebSocket = None):
        """Disconnect a WebSocket and remove from active connections"""
        async def _disconnect():
            async with self._lock:
                if user_id in self.active_connections:
                    if websocket:
                        # Remove specific websocket
                        if websocket in self.active_connections[user_id]:
                            self.active_connections[user_id].remove(websocket)
                    
                    # Clean up empty connection lists
                    if not self.active_connections[user_id]:
                        del self.active_connections[user_id]
                        # Also clean up processing jobs
                        if user_id in self.user_processing_jobs:
                            del self.user_processing_jobs[user_id]
            
            logger.info(f"WebSocket disconnected for user {user_id}")
        
        # Schedule the coroutine
        asyncio.create_task(_disconnect())
    
    async def broadcast_processing_status(
        self,
        processing_id: str,
        status: ProcessingStatus,
        message: str,
        data: Dict[str, Any] = None
    ):
        """Broadcast processing status update to relevant users"""
        try:
            # Extract user_id from processing_id (format: proc_{user_id}_{timestamp})
            parts = processing_id.split("_")
            if len(parts) >= 2 and parts[0] == "proc":
                user_id = int(parts[1])
            else:
                logger.warning(f"Cannot extract user_id from processing_id: {processing_id}")
                return
            
            # Track processing job for user
            async with self._lock:
                if user_id not in self.user_processing_jobs:
                    self.user_processing_jobs[user_id] = set()
                
                if status == ProcessingStatus.STARTED:
                    self.user_processing_jobs[user_id].add(processing_id)
                elif status in [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED]:
                    self.user_processing_jobs[user_id].discard(processing_id)
            
            # Create status message
            status_message = WebSocketMessage(
                type="processing_status",
                processing_id=processing_id,
                status=status,
                message=message,
                data=data or {}
            )
            
            # Send to user's connections
            await self._send_to_user(user_id, status_message.dict())
            
        except Exception as e:
            logger.error(f"Failed to broadcast processing status: {e}")
    
    async def broadcast_error(
        self,
        user_id: int,
        error_message: str,
        error_details: Dict[str, Any] = None,
        processing_id: str = None
    ):
        """Broadcast error message to user"""
        try:
            error_msg = WebSocketMessage(
                type="error",
                processing_id=processing_id,
                message=error_message,
                data=error_details or {}
            )
            
            await self._send_to_user(user_id, error_msg.dict())
            
        except Exception as e:
            logger.error(f"Failed to broadcast error: {e}")
    
    async def broadcast_completion(
        self,
        user_id: int,
        processing_id: str,
        completion_data: Dict[str, Any]
    ):
        """Broadcast completion notification to user"""
        try:
            completion_msg = WebSocketMessage(
                type="completion",
                processing_id=processing_id,
                message="Processing completed successfully",
                data=completion_data
            )
            
            await self._send_to_user(user_id, completion_msg.dict())
            
        except Exception as e:
            logger.error(f"Failed to broadcast completion: {e}")
    
    async def _send_to_user(self, user_id: int, message: Dict[str, Any]):
        """Send message to all connections for a specific user"""
        async with self._lock:
            if user_id not in self.active_connections:
                logger.debug(f"No active connections for user {user_id}")
                return
            
            connections = self.active_connections[user_id].copy()
        
        # Send to all connections for this user
        failed_connections = []
        
        for websocket in connections:
            try:
                await self._send_to_websocket(websocket, message)
            except Exception as e:
                logger.warning(f"Failed to send message to websocket for user {user_id}: {e}")
                failed_connections.append(websocket)
        
        # Clean up failed connections
        if failed_connections:
            async with self._lock:
                if user_id in self.active_connections:
                    for failed_ws in failed_connections:
                        if failed_ws in self.active_connections[user_id]:
                            self.active_connections[user_id].remove(failed_ws)
                    
                    # Clean up empty connection lists
                    if not self.active_connections[user_id]:
                        del self.active_connections[user_id]
    
    async def _send_to_websocket(self, websocket: WebSocket, message: Dict[str, Any]):
        """Send message to a specific WebSocket connection"""
        try:
            message_str = json.dumps(message, default=str, ensure_ascii=False)
            await websocket.send_text(message_str)
        except Exception as e:
            logger.debug(f"Failed to send message to websocket: {e}")
            raise
    
    async def get_user_processing_jobs(self, user_id: int) -> List[str]:
        """Get active processing jobs for a user"""
        async with self._lock:
            return list(self.user_processing_jobs.get(user_id, set()))
    
    async def get_connection_count(self, user_id: int = None) -> int:
        """Get connection count for specific user or total"""
        async with self._lock:
            if user_id is not None:
                return len(self.active_connections.get(user_id, []))
            else:
                return sum(len(connections) for connections in self.active_connections.values())
    
    async def get_active_users(self) -> List[int]:
        """Get list of users with active WebSocket connections"""
        async with self._lock:
            return list(self.active_connections.keys())
    
    async def send_system_notification(
        self,
        notification_message: str,
        target_users: List[int] = None,
        notification_data: Dict[str, Any] = None
    ):
        """Send system notification to specific users or all connected users"""
        try:
            notification = WebSocketMessage(
                type="system_notification",
                message=notification_message,
                data=notification_data or {}
            )
            
            async with self._lock:
                if target_users:
                    users_to_notify = [u for u in target_users if u in self.active_connections]
                else:
                    users_to_notify = list(self.active_connections.keys())
            
            # Send to target users
            for user_id in users_to_notify:
                await self._send_to_user(user_id, notification.dict())
                
            logger.info(f"System notification sent to {len(users_to_notify)} users")
            
        except Exception as e:
            logger.error(f"Failed to send system notification: {e}")
    
    async def cleanup_stale_connections(self):
        """Cleanup stale WebSocket connections (called periodically)"""
        try:
            stale_users = []
            
            async with self._lock:
                for user_id, connections in self.active_connections.items():
                    active_connections = []
                    
                    for websocket in connections:
                        try:
                            # Try to ping the connection
                            await websocket.ping()
                            active_connections.append(websocket)
                        except Exception:
                            # Connection is stale
                            logger.debug(f"Removing stale WebSocket for user {user_id}")
                    
                    if active_connections:
                        self.active_connections[user_id] = active_connections
                    else:
                        stale_users.append(user_id)
                
                # Remove users with no active connections
                for user_id in stale_users:
                    del self.active_connections[user_id]
                    if user_id in self.user_processing_jobs:
                        del self.user_processing_jobs[user_id]
            
            if stale_users:
                logger.info(f"Cleaned up stale connections for {len(stale_users)} users")
                
        except Exception as e:
            logger.error(f"Failed to cleanup stale connections: {e}")
    
    async def get_websocket_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        async with self._lock:
            total_connections = sum(len(connections) for connections in self.active_connections.values())
            total_users = len(self.active_connections)
            active_jobs = sum(len(jobs) for jobs in self.user_processing_jobs.values())
            
            return {
                "total_connections": total_connections,
                "connected_users": total_users,
                "active_processing_jobs": active_jobs,
                "users_with_jobs": len([u for u, jobs in self.user_processing_jobs.items() if jobs]),
                "connection_distribution": {
                    str(user_id): len(connections) 
                    for user_id, connections in self.active_connections.items()
                }
            }