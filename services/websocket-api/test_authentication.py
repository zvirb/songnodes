#!/usr/bin/env python3
"""
Test script for WebSocket authentication integration.
This script demonstrates the authentication patterns implemented.
"""

import json
import asyncio
from typing import Optional
from datetime import datetime

# Mock classes for testing
class MockUser:
    def __init__(self, user_id: int, email: str):
        self.id = user_id
        self.email = email

class MockWebSocket:
    def __init__(self):
        self.closed = False
        self.close_code = None
        self.close_reason = None
        self.messages = []

    async def close(self, code: int, reason: str):
        self.closed = True
        self.close_code = code
        self.close_reason = reason
        print(f"WebSocket closed: {code} - {reason}")

    async def send_text(self, message: str):
        self.messages.append(message)
        print(f"WebSocket message sent: {message}")

async def mock_get_current_user_ws(websocket, token: Optional[str] = None):
    """Mock authentication function for testing"""
    if token == "valid_token_123":
        return MockUser(123, "test@example.com")
    elif token == "valid_token_456":
        return MockUser(456, "user@example.com")
    else:
        return None

async def test_authentication_scenarios():
    """Test various authentication scenarios"""
    print("Testing WebSocket Authentication Integration")
    print("=" * 50)
    
    # Test 1: Valid token with matching user_id
    print("\n1. Valid token with matching user_id:")
    websocket = MockWebSocket()
    current_user = await mock_get_current_user_ws(websocket, "valid_token_123")
    user_id = "123"
    
    if current_user and str(current_user.id) == user_id:
        print(f"✅ Authentication successful for user {current_user.id} ({current_user.email})")
        authenticated_user_id = str(current_user.id)
    else:
        print("❌ Authentication failed")
        await websocket.close(code=1008, reason="Unauthorized: User ID mismatch")
    
    # Test 2: Valid token with mismatched user_id
    print("\n2. Valid token with mismatched user_id:")
    websocket = MockWebSocket()
    current_user = await mock_get_current_user_ws(websocket, "valid_token_123")
    user_id = "999"  # Different from token user_id
    
    if current_user and str(current_user.id) != user_id:
        print(f"❌ User ID mismatch: authenticated={current_user.id}, requested={user_id}")
        await websocket.close(code=1008, reason="Unauthorized: User ID mismatch")
    
    # Test 3: Invalid token
    print("\n3. Invalid token:")
    websocket = MockWebSocket()
    current_user = await mock_get_current_user_ws(websocket, "invalid_token")
    user_id = "123"
    
    if not current_user and user_id != "anonymous":
        print(f"❌ Authentication required for user_id: {user_id}")
        await websocket.close(code=1008, reason="Authentication required")
    
    # Test 4: Anonymous access
    print("\n4. Anonymous access:")
    websocket = MockWebSocket()
    current_user = await mock_get_current_user_ws(websocket, None)
    user_id = "anonymous"
    
    if not current_user and user_id == "anonymous":
        print("✅ Anonymous access allowed")
        authenticated_user_id = user_id
    
    # Test 5: Welcome message format
    print("\n5. Welcome message format:")
    current_user = MockUser(123, "test@example.com")
    room_id = "general"
    connection_id = "test_connection_123"
    authenticated_user_id = str(current_user.id)
    
    welcome_message = {
        "type": "welcome",
        "data": {
            "user_id": authenticated_user_id,
            "room_id": room_id,
            "connection_id": connection_id,
            "authenticated": current_user is not None,
            "user_email": current_user.email if current_user else None
        },
        "timestamp": datetime.utcnow().isoformat()
    }
    
    print("✅ Enhanced welcome message:")
    print(json.dumps(welcome_message, indent=2))

if __name__ == "__main__":
    asyncio.run(test_authentication_scenarios())