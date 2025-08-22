# WebSocket API Security Implementation

## JWT Authentication Integration

The SongNodes WebSocket API now includes comprehensive JWT authentication using UnifiedWorkflow security patterns.

### Security Features

#### 1. JWT Token Validation
- **Token Sources**: Query parameter, WebSocket subprotocol, Authorization header
- **Centralized Validation**: Uses UnifiedWorkflow's `jwt_consistency_service`
- **User Verification**: Validates user existence and active status

#### 2. User ID Protection
- **Identity Verification**: Ensures requested `user_id` matches authenticated user
- **Mismatch Prevention**: Blocks access when user IDs don't match
- **Anonymous Access**: Controlled anonymous access for specific use cases

#### 3. Connection Security
- **Authenticated Connections**: All connections validated before establishment
- **Secure Closure**: Proper WebSocket closure with error codes for unauthorized access
- **Session Tracking**: Enhanced welcome messages with authentication status

### Authentication Flow

```
1. Client connects to /ws/{user_id}?token=<jwt_token>
2. Extract JWT token from query, subprotocol, or header
3. Validate token using UnifiedWorkflow JWT service
4. Verify user_id matches authenticated user
5. Establish secure WebSocket connection
6. Send enhanced welcome message with auth status
```

### Error Codes

| Code | Reason | Description |
|------|--------|-------------|
| 1008 | Unauthorized: User ID mismatch | Requested user_id doesn't match authenticated user |
| 1008 | Authentication required | No valid token provided for non-anonymous access |
| 1008 | Authentication failed | Token validation or user lookup failed |

### Connection Examples

#### Authenticated Connection
```javascript
const ws = new WebSocket('ws://localhost:8083/ws/123?token=eyJ0eXAi...');
```

#### Anonymous Connection
```javascript
const ws = new WebSocket('ws://localhost:8083/ws/anonymous');
```

### Integration Points

#### UnifiedWorkflow Dependencies
- `api.dependencies.get_current_user_ws`: WebSocket authentication handler
- `shared.database.models._models.User`: User model for validation
- `shared.services.jwt_consistency_service`: Centralized JWT validation

#### Fallback Security
- Graceful degradation when UnifiedWorkflow unavailable
- Maintains basic validation patterns
- Logs authentication failures for monitoring

### Testing

Run the included test suite:
```bash
python3 test_authentication.py
```

Test scenarios include:
- Valid token with matching user_id ✅
- Valid token with mismatched user_id ❌
- Invalid/missing token ❌
- Anonymous access ✅
- Enhanced welcome message format ✅

### Security Best Practices

1. **Token Security**: Always use HTTPS in production
2. **Token Expiration**: Implement proper token refresh mechanisms
3. **Rate Limiting**: Apply connection rate limiting per user
4. **Monitoring**: Log all authentication failures
5. **Audit Trail**: Track WebSocket connections and user activities

### Production Deployment

#### Environment Variables
```bash
# UnifiedWorkflow integration
UNIFIED_WORKFLOW_PATH=/path/to/UnifiedWorkflow/app

# WebSocket API
WS_PORT=8083
LOG_LEVEL=INFO
```

#### Docker Configuration
The authentication integration works seamlessly within the SongNodes Docker environment:

```yaml
websocket-api:
  build: ./services/websocket-api
  environment:
    - UNIFIED_WORKFLOW_PATH=/app/UnifiedWorkflow/app
  volumes:
    - ./UnifiedWorkflow:/app/UnifiedWorkflow:ro
```

### Security Validation

✅ **JWT Authentication**: Integrated with UnifiedWorkflow patterns
✅ **User Validation**: ID matching and active status verification  
✅ **Error Handling**: Proper WebSocket closure codes
✅ **Fallback Security**: Graceful degradation
✅ **Anonymous Support**: Controlled anonymous access
✅ **Enhanced Logging**: Security events tracking
✅ **Integration Testing**: Comprehensive test coverage

This implementation ensures that all WebSocket connections are properly authenticated while maintaining compatibility with the existing SongNodes infrastructure and scraping workflows.