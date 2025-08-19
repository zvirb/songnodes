# SongNodes Setup Guide

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js (v18+) and npm
- Python 3.8+

### 1. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Start Development Environment
```bash
# Start all services
./start-dev.sh

# Or start services individually
docker-compose up -d
```

### 3. MCP Server Setup
The system requires MCP servers for AI workflow orchestration:

```bash
# Start integrated MCP server (Memory + Redis)
cd mcp_servers
./start_integrated_mcp.sh

# Start Sequential Thinking server
npx -y @modelcontextprotocol/server-sequential-thinking
```

### 4. Verify Installation
```bash
# Check services
curl http://localhost:8000/health

# Test MCP servers
python3 mcp_servers/test_integrated_mcp.py
```

## Development

### Project Structure
```
songnodes/
├── services/           # Microservices
├── mcp_servers/       # MCP server implementations  
├── docs/              # Documentation
├── monitoring/        # Monitoring stack
├── nginx/             # Reverse proxy
└── sql/               # Database schemas
```

### Available Services
- **API Gateway**: Main entry point (port 8080)
- **REST API**: Core REST endpoints
- **GraphQL API**: Graph-based queries
- **WebSocket API**: Real-time communication
- **Visualization**: Data visualization service

## Detailed Documentation

For detailed setup instructions, see:
- [Complete MCP Setup](docs/setup/COMPLETE_MCP_SETUP_SUMMARY.md)
- [MCP Server Requirements](docs/setup/MCP_SERVERS_REQUIRED.md) 
- [Sequential Thinking Setup](docs/setup/SEQUENTIAL_THINKING_SETUP.md)
- [Workflow Instructions](CLAUDE.md)
- [API Documentation](docs/api/)
- [Architecture Guide](docs/architecture/)
- [Deployment Guide](docs/deployment/)

## Support

For issues and questions:
1. Check the [troubleshooting guide](docs/setup/troubleshooting.md)
2. Review service logs: `docker-compose logs [service]`
3. Verify MCP server status: `curl http://localhost:8000/health`