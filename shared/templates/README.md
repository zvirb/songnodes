# SongNodes Shared Templates

This directory contains reusable templates and shared components for SongNodes microservices to reduce code duplication and maintain consistency across services.

## Templates

### `base-requirements.txt`
Common Python dependencies for all SongNodes microservices. This includes:
- FastAPI core stack (FastAPI, Uvicorn, Pydantic)
- Database connectors (asyncpg, SQLAlchemy, Redis)
- Monitoring tools (Prometheus)
- Security and utilities

**Usage**: Include this as a base and add service-specific dependencies to individual `requirements.txt` files.

### `Dockerfile.base-service`
Base Dockerfile template for SongNodes microservices with:
- Configurable Python version, service name, and port
- Security best practices (non-root user)
- Health checks
- Optimized layer caching

**Usage**: 
```dockerfile
# Copy and customize for specific services
ARG SERVICE_NAME=my-service
ARG SERVICE_PORT=8080
```

### `base_fastapi_service.py`
Base FastAPI service class providing:
- Common middleware (CORS, compression, metrics)
- Health and readiness endpoints
- Database and Redis connection management
- Prometheus metrics integration
- Consistent configuration patterns

**Usage**:
```python
from shared.templates.base_fastapi_service import create_songnodes_service

app = create_songnodes_service("my-service", "1.0.0")

# Add service-specific routes
@app.get("/my-endpoint")
async def my_endpoint():
    return {"message": "Hello from my service"}
```

## Benefits

1. **Reduced Duplication**: Eliminates repeated code across 20+ microservices
2. **Consistency**: Ensures all services follow the same patterns
3. **Maintainability**: Changes to common patterns only need to be made in one place
4. **Security**: Consistent security practices across all services
5. **Monitoring**: Standardized metrics and health checks

## Migration Guide

To migrate existing services to use these templates:

1. Update Dockerfile to use `Dockerfile.base-service` as base
2. Replace FastAPI app creation with `create_songnodes_service()`
3. Consolidate requirements.txt with base-requirements.txt
4. Remove duplicate middleware and health check code

## File Organization Impact

This template system supports the repository cleanup by:
- Reducing 75 similar Dockerfiles to template variations
- Consolidating 34 requirements.txt files
- Standardizing FastAPI patterns across 174+ services
- Providing clear migration path for existing services