# Developer Guide

## Table of Contents
- [Development Environment Setup](#development-environment-setup)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [API Development](#api-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Development Environment Setup

### Prerequisites
- **Docker**: Version 20.10+ and Docker Compose v2
- **Node.js**: Version 18+ with npm
- **Python**: Version 3.8+ with pip
- **Git**: Version 2.30+

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd songnodes
   ```

2. **Environment configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit configuration for your environment
   nano .env
   ```

3. **Install dependencies**
   ```bash
   # Install all service dependencies
   npm run install:all
   
   # Or install individually per service
   cd services/api-gateway && npm install
   ```

4. **Start development environment**
   ```bash
   # Start all services
   npm run dev
   
   # Or use Docker Compose directly
   docker-compose up -d
   ```

5. **Setup MCP servers (for AI orchestration)**
   ```bash
   # Start integrated MCP server
   npm run mcp:start
   
   # Test MCP connectivity
   npm run mcp:test
   ```

### Verification

```bash
# Check all services are running
docker-compose ps

# Test API Gateway health
curl http://localhost:8080/health

# Check MCP server status
curl http://localhost:8000/health
```

## Project Architecture

### Microservices Structure
```
songnodes/
├── services/
│   ├── api-gateway/         # Main entry point, authentication, routing
│   ├── data-transformer/    # Data processing and transformation
│   ├── db-connection-pool/  # Database connection management
│   └── scraper-orchestrator/ # Web scraping coordination
├── mcp_servers/            # MCP servers for AI orchestration
├── monitoring/             # Grafana + Prometheus monitoring
├── nginx/                  # Reverse proxy configuration
└── sql/                    # Database schemas and migrations
```

### Service Communication
- **API Gateway**: Port 8080 (main entry point)
- **Internal Services**: Communicate via Docker network
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session management and caching
- **MCP Servers**: Port 8000 (AI orchestration)

### Technology Stack
- **Backend**: Node.js (Express), Python (FastAPI)
- **Database**: PostgreSQL with Redis caching
- **Monitoring**: Prometheus + Grafana
- **Orchestration**: Docker Compose
- **AI Integration**: MCP (Model Context Protocol) servers

## Development Workflow

### Feature Development

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Develop with hot-reload**
   ```bash
   # Start development environment
   npm run dev
   
   # Watch logs for specific service
   docker-compose logs -f api-gateway
   ```

3. **Test your changes**
   ```bash
   # Run tests for all services
   npm test
   
   # Run tests for specific service
   cd services/api-gateway && npm test
   ```

4. **Code quality checks**
   ```bash
   # Lint all services
   npm run lint
   
   # Security audit
   npm audit
   ```

### Service-Specific Development

#### API Gateway Development
```bash
cd services/api-gateway

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Security audit
npm run security:audit
```

#### Python Services Development
```bash
cd services/data-transformer

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Run service via Docker Compose (REQUIRED per CLAUDE.md)
docker compose up -d [service-name]

# Run tests inside container
docker compose exec [service-name] pytest
```

### Database Development

#### Schema Changes
```bash
# Edit schema files
nano sql/init/01-schema.sql

# Restart database service to apply changes
docker-compose restart postgres

# Or run migrations manually
docker exec -it songnodes_postgres_1 psql -U postgres -d musicdb -f /docker-entrypoint-initdb.d/01-schema.sql
```

#### Database Access
```bash
# Connect to PostgreSQL
docker exec -it songnodes_postgres_1 psql -U postgres -d musicdb

# View database logs
docker-compose logs postgres
```

## API Development

### Adding New Endpoints

1. **Define OpenAPI specification**
   ```yaml
   # Add to docs/api/openapi.yaml
   /api/v1/new-endpoint:
     get:
       tags:
         - NewFeature
       summary: Description
       # ... rest of specification
   ```

2. **Implement in target service**
   ```javascript
   // For Node.js services
   router.get('/new-endpoint', async (req, res) => {
     try {
       // Implementation
       res.json({ data: result });
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   ```

3. **Add proxy route in API Gateway**
   ```javascript
   // In services/api-gateway/server.js
   const serviceProxies = {
     '/api/v1/new-endpoint': {
       target: 'http://target-service:8082',
       pathRewrite: { '^/api/v1/new-endpoint': '/api/v1/new-endpoint' }
     }
   };
   ```

4. **Add authentication if needed**
   ```javascript
   // Protected route example
   app.use('/api/v1/new-endpoint', authMiddleware.verifyToken);
   ```

### API Documentation
- **OpenAPI Spec**: `docs/api/openapi.yaml`
- **Live Documentation**: http://localhost:8080/api/docs (when implemented)
- **Postman Collection**: Export from OpenAPI spec

### Error Handling
```javascript
// Standard error response format
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "path": "/api/v1/endpoint",
  "timestamp": "2025-01-18T10:30:00Z"
}
```

## Testing

### Unit Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=auth.test.js
```

### Integration Tests
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests
npm run test:integration

# Cleanup test environment
docker-compose -f docker-compose.test.yml down
```

### API Testing
```bash
# Test API endpoints with curl
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test with authentication
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8080/api/v1/tracks
```

### Load Testing
```bash
# Install artillery (if not already installed)
npm install -g artillery

# Run load tests
artillery run tests/load/api-load-test.yml
```

## Deployment

### Development Deployment
```bash
# Deploy to development environment
npm run deploy:dev

# Check deployment status
kubectl get pods -n songnodes-dev
```

### Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
npm run deploy:prod

# Monitor deployment
kubectl logs -f deployment/api-gateway -n songnodes-prod
```

### Environment Variables
Create appropriate `.env` files for each environment:

```bash
# Development
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/musicdb
REDIS_URL=redis://localhost:6379

# Production
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/musicdb
REDIS_URL=redis://prod-redis:6379
JWT_SECRET=your-production-secret
```

## Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check container logs
docker-compose logs [service-name]

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart [service-name]
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
docker-compose logs postgres

# Test connection
docker exec -it songnodes_postgres_1 pg_isready

# Reset database
docker-compose down postgres
docker volume rm songnodes_postgres_data
docker-compose up -d postgres
```

#### MCP Server Issues
```bash
# Check MCP server status
curl http://localhost:8000/health

# View MCP logs
tail -f mcp_servers/logs/memory_mcp.log

# Restart MCP servers
npm run mcp:stop
npm run mcp:start
```

#### Port Conflicts
```bash
# Check what's using a port
sudo lsof -i :8080

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:8080)
```

### Performance Issues

#### Slow API Responses
1. Check database query performance
2. Monitor Redis cache hit rates
3. Review service logs for bottlenecks
4. Use profiling tools

#### Memory Issues
```bash
# Monitor container memory usage
docker stats

# Check for memory leaks
docker exec -it container_name node --inspect
```

### Debug Mode

#### Enable Debug Logging
```bash
# Set debug environment variable
export DEBUG=api-gateway:*

# Start services with debug logging
npm run dev
```

#### Remote Debugging
```bash
# For Node.js services
node --inspect-brk=0.0.0.0:9229 server.js

# For Python services
python -m debugpy --listen 0.0.0.0:5678 main.py
```

## Contributing

### Code Style
- **JavaScript**: ESLint + Prettier
- **Python**: Black + Flake8
- **Documentation**: Markdown with consistent formatting

### Pull Request Process
1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Run full test suite
5. Submit PR with detailed description

### Code Review Guidelines
- Security considerations
- Performance implications
- Test coverage
- Documentation updates
- Breaking changes

## Resources

### Documentation Links
- [API Documentation](api/openapi.yaml)
- [Architecture Guide](architecture/container-architecture.md)
- [Deployment Guide](deployment/deployment-guide.md)
- [Setup Guides](setup/)

### External Resources
- [Docker Documentation](https://docs.docker.com/)
- [Express.js Guide](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)