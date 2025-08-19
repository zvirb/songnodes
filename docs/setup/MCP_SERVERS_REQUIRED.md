# MCP Servers Required for AI Workflow Orchestration

## Overview
The AI Workflow Orchestration system requires two Model Context Protocol (MCP) servers to function properly:

## 1. Memory MCP Server (`mcp__memory`)

### Purpose
Long-term storage and retrieval of agent outputs, documentation, and knowledge graph management.

### Key Functions
- **Entity Creation**: `mcp__memory__create_entities()` - Store agent outputs and documentation
- **Search/Query**: `mcp__memory__search_nodes()` - Query stored knowledge and context
- **Knowledge Graph**: Maintain relationships between stored entities

### Usage in Workflow
- Phase 0: Query existing knowledge and context
- Phase 5: Store agent outputs (mandatory)
- Phase 9: Store learning patterns and improvements
- Throughout: Query documentation and historical patterns

### Entity Structure
```json
{
  "name": "{agent-name}-{output-type}-{timestamp}",
  "entityType": "agent-output|documentation|knowledge",
  "observations": ["findings", "results", "patterns"]
}
```

### Token Limits
- Maximum entity size: 8000 tokens
- Recommended query size: Under 1000 tokens

## 2. Redis MCP Server (`mcp__redis`)

### Purpose
Real-time coordination and communication between parallel agent streams during orchestration.

### Key Functions
- **Workspace Management**: 
  - `mcp__redis__hset()/hget()/hgetall()` - Shared workspace for agent collaboration
- **Agent Notifications**:
  - `mcp__redis__sadd()/smembers()` - Agent notification system
- **Timeline Tracking**:
  - `mcp__redis__zadd()/zrange()` - Collaboration timeline and event ordering

### Usage in Workflow
- Phase 3-5: Cross-domain agent communication during parallel execution
- Phase 6-7: Validation coordination and evidence sharing
- Throughout: Real-time status updates and conflict prevention

### Data Patterns
```yaml
Workspace: Hash structure for shared context
Notifications: Set structure for agent alerts
Timeline: Sorted set for temporal ordering
```

## Setup Requirements

### Memory MCP
1. Install memory MCP server
2. Configure storage backend (filesystem or database)
3. Set token limits and compression settings
4. Initialize knowledge graph structure

### Redis MCP
1. Install Redis server (version 6.0+)
2. Install Redis MCP connector
3. Configure authentication if required
4. Set up data persistence (optional but recommended)
5. Configure memory limits and eviction policies

## Integration Notes

### Environment Variables
```bash
# Memory MCP Configuration
MEMORY_MCP_ENDPOINT=localhost:5000
MEMORY_MCP_TOKEN_LIMIT=8000

# Redis MCP Configuration  
REDIS_MCP_HOST=localhost
REDIS_MCP_PORT=6379
REDIS_MCP_AUTH=optional_password
```

### Testing Connectivity
```python
# Test Memory MCP
mcp__memory__search_nodes(query="test")

# Test Redis MCP
mcp__redis__hset("test", "key", "value")
mcp__redis__hget("test", "key")
```

## Critical Considerations

1. **Memory MCP**: Essential for knowledge persistence and agent output storage
2. **Redis MCP**: Required for parallel agent coordination and conflict prevention
3. **Both servers must be running before starting orchestration flows**
4. **Fallback behavior**: System should gracefully degrade if MCP servers unavailable
5. **Security**: Implement appropriate authentication and network isolation

## Alternative Implementations

If these specific MCP servers are not available, the system can be adapted to use:
- **Memory Alternative**: Local filesystem with JSON storage
- **Redis Alternative**: In-memory coordination with file-based locking

However, this will reduce system capabilities and performance.